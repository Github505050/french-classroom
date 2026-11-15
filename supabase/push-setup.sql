-- Phone Web Push backend, deployed to Supabase project dgycxjejmkdeoflbfiyw.
-- No VAPID private keys are kept in this public repository. Keys are created
-- by the signed-in server on the first consent and encrypted in Supabase Vault.
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.classroom_push_subscriptions(
 endpoint text primary key,
 owner_uid text not null,
 p256dh text not null,
 auth text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint push_endpoint_https check (left(endpoint,8)='https://'),
 constraint push_endpoint_size check (char_length(endpoint)<=2048),
 constraint push_crypto_sizes check (char_length(p256dh) between 30 and 256 and char_length(auth) between 10 and 256)
);
create index if not exists classroom_push_owner on public.classroom_push_subscriptions(owner_uid);
alter table public.classroom_push_subscriptions enable row level security;
revoke all on public.classroom_push_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.classroom_push_subscriptions to service_role;
create table if not exists public.classroom_push_settings(
 singleton integer primary key default 1 check(singleton=1),
 public_key text not null,
 created_at timestamptz not null default now()
);
alter table public.classroom_push_settings enable row level security;
revoke all on public.classroom_push_settings from public,anon,authenticated;
grant select,insert on public.classroom_push_settings to service_role;

create or replace function public.classroom_push_secret(secret_name text)
returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if secret_name not in ('classroom_push_vapid_private','classroom_push_hook') then
  raise exception 'Unauthorized secret name';
 end if;
 select decrypted_secret into result from vault.decrypted_secrets where name=secret_name limit 1;
 return result;
end
$$;
revoke all on function public.classroom_push_secret(text) from public,anon,authenticated;
grant execute on function public.classroom_push_secret(text) to service_role;

create or replace function public.classroom_push_initialize(p_private text,p_public text,p_hook text)
returns text language plpgsql security definer set search_path='' as $$
declare v_public text;
begin
 perform pg_catalog.pg_advisory_xact_lock(795024683);
 select public_key into v_public from public.classroom_push_settings where singleton=1;
 if v_public is not null then return v_public; end if;
 if char_length(p_private) not between 40 and 80 or char_length(p_public) not between 80 and 120 or char_length(p_hook) not between 40 and 120 then
   raise exception 'Invalid key configuration';
 end if;
 perform vault.create_secret(p_private,'classroom_push_vapid_private','VAPID private signing key');
 perform vault.create_secret(p_hook,'classroom_push_hook','Authenticated test publish trigger');
 insert into public.classroom_push_settings(singleton,public_key) values(1,p_public);
 return p_public;
end
$$;
revoke all on function public.classroom_push_initialize(text,text,text) from public,anon,authenticated;
grant execute on function public.classroom_push_initialize(text,text,text) to service_role;

create schema if not exists private;
create or replace function private.notify_classroom_test_published()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_hook text;
begin
 select decrypted_secret into v_hook from vault.decrypted_secrets where name='classroom_push_hook' limit 1;
 if v_hook is not null then
  perform net.http_post(
   url:='https://dgycxjejmkdeoflbfiyw.supabase.co/functions/v1/notebook-tests',
   body:=pg_catalog.jsonb_build_object('action','internalTestPush','testId',new.test_id,'title',new.title),
   headers:=pg_catalog.jsonb_build_object('Content-Type','application/json','X-Classroom-Push-Hook',v_hook),
   timeout_milliseconds:=10000
  );
 end if;
 return new;
end
$$;
drop trigger if exists classroom_new_test_push on public.notebook_test_definitions;
create trigger classroom_new_test_push after insert on public.notebook_test_definitions
for each row execute function private.notify_classroom_test_published();
