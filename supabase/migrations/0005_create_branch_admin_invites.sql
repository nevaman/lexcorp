create table if not exists public.branch_admin_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_office_id uuid not null references public.branch_offices (id) on delete cascade,
  email text not null,
  invite_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists branch_admin_invites_org_idx
  on public.branch_admin_invites (organization_id);

create index if not exists branch_admin_invites_office_idx
  on public.branch_admin_invites (branch_office_id);

