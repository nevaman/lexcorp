create table if not exists public.branch_departments (
  id uuid primary key default gen_random_uuid(),
  branch_office_id uuid not null references public.branch_offices (id) on delete cascade,
  name text not null,
  lead text,
  contact_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists branch_departments_office_idx
  on public.branch_departments (branch_office_id);

drop trigger if exists set_branch_departments_updated_at on public.branch_departments;

create trigger set_branch_departments_updated_at
before update on public.branch_departments
for each row
execute procedure public.set_updated_at();



