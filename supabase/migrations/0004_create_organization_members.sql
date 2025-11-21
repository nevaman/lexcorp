create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('org_admin', 'branch_admin')),
  branch_office_id uuid references public.branch_offices (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists organization_members_user_org_idx
  on public.organization_members (user_id, organization_id);

