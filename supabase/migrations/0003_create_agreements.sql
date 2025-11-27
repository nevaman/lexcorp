create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete set null,
  title text not null,
  counterparty text not null,
  department text,
  owner text,
  effective_date date,
  renewal_date date,
  value numeric not null default 0,
  risk_level text not null default 'Low',
  status text not null default 'Draft',
  sections jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  version integer not null default 1,
  comments jsonb not null default '[]'::jsonb,
  audit_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agreements_organization_id_idx on public.agreements (organization_id);

drop trigger if exists set_agreements_updated_at on public.agreements;

create trigger set_agreements_updated_at
before update on public.agreements
for each row
execute procedure public.set_updated_at();
