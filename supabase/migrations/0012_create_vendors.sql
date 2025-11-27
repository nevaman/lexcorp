create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_office_id uuid references public.branch_offices (id) on delete set null,
  name text not null,
  tin text not null,
  contact_email text,
  contact_phone text,
  notes text,
  documents jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists vendors_org_idx on public.vendors (organization_id);
create index if not exists vendors_branch_idx on public.vendors (branch_office_id);

drop trigger if exists set_vendors_updated_at on public.vendors;

create trigger set_vendors_updated_at
before update on public.vendors
for each row
execute procedure public.set_updated_at();

