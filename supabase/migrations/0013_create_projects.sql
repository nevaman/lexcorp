create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_office_id uuid references public.branch_offices (id) on delete set null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','onhold','completed')),
  start_date date,
  end_date date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists projects_org_idx on public.projects (organization_id);
create index if not exists projects_branch_idx on public.projects (branch_office_id);
create index if not exists projects_status_idx on public.projects (status);

drop trigger if exists set_projects_updated_at on public.projects;

create trigger set_projects_updated_at
before update on public.projects
for each row
execute procedure public.set_updated_at();

  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_office_id uuid references public.branch_offices (id) on delete set null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','onhold','completed')),
  start_date date,
  end_date date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists projects_org_idx on public.projects (organization_id);
create index if not exists projects_branch_idx on public.projects (branch_office_id);
create index if not exists projects_status_idx on public.projects (status);

drop trigger if exists set_projects_updated_at on public.projects;

create trigger set_projects_updated_at
before update on public.projects
for each row
execute procedure public.set_updated_at();

