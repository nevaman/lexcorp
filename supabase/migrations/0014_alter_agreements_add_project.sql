alter table public.agreements
add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists agreements_project_id_idx on public.agreements (project_id);

