-- Run in the Supabase SQL Editor as project owner.
-- Private storage bucket; access occurs only through the validated Edge Function.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('notebook-tests','notebook-tests',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create table if not exists public.notebook_submissions (
 id uuid primary key default gen_random_uuid(),
 owner_uid text not null,
 student_email text not null,
 test_id text not null,
 images text[] not null,
 page_count int not null check(page_count between 1 and 8),
 submitted_at timestamptz not null default now()
);
create index if not exists notebook_submissions_owner_test_idx on public.notebook_submissions(owner_uid,test_id,submitted_at desc);
alter table public.notebook_submissions enable row level security;
-- No anon/authenticated table policies: only server-held service-role credentials can access the private tables.
revoke all on public.notebook_submissions from anon, authenticated;
-- Grant no direct browser access to the private bucket.
drop policy if exists "notebook teachers public read" on storage.objects;
drop policy if exists "notebook students public upload" on storage.objects;
-- Teacher access uses the existing Firebase roles/{uid} document. No duplicate Supabase teacher role records are needed.

-- Edge Functions connect using the Supabase service role. RLS still blocks browser roles.
grant usage on schema public to service_role;
grant select, insert on public.notebook_submissions to service_role;
grant select on public.notebook_test_definitions to service_role;
grant select, insert, update on public.notebook_test_results to service_role;
