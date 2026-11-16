-- Private teacher-reviewed student correction report attachments.
-- Apply in Supabase SQL editor or via the database migration workflow.
-- Reports remain in the EXISTING non-public 'notebook-tests' Storage bucket;
-- only the authenticated Edge Function creates short-lived download URLs.
alter table public.notebook_test_results
 add column if not exists report_path text,
 add column if not exists report_name text;
alter table public.notebook_test_results
 drop constraint if exists notebook_report_path_safe;
alter table public.notebook_test_results
 add constraint notebook_report_path_safe
 check (report_path is null or (char_length(report_path)<500 and report_path like 'reports/%'));
alter table public.notebook_test_results
 drop constraint if exists notebook_report_name_safe;
alter table public.notebook_test_results
 add constraint notebook_report_name_safe
 check (report_name is null or char_length(report_name)<=150);
