-- Adds indexes to support high-traffic project detail queries.
create index if not exists briefs_project_id_idx on public.briefs (project_id);
create index if not exists invoices_project_id_issued_created_idx on public.invoices (project_id, issued_at desc, created_at desc);
create index if not exists clients_name_idx on public.clients (name);
create index if not exists profiles_full_name_idx on public.profiles (full_name);
create index if not exists comments_project_id_created_idx on public.comments (project_id, created_at desc);
create index if not exists files_project_id_created_idx on public.files (project_id, created_at desc);
create index if not exists project_stage_events_project_id_changed_idx on public.project_stage_events (project_id, changed_at desc);
create index if not exists projects_created_at_idx on public.projects (created_at desc);
