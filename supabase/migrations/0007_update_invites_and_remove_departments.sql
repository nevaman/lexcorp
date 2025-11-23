drop table if exists public.branch_departments cascade;

alter table if exists public.branch_admin_invites rename to branch_invites;

alter index if exists branch_admin_invites_org_idx rename to branch_invites_org_idx;
alter index if exists branch_admin_invites_office_idx rename to branch_invites_office_idx;

alter table public.branch_invites
  add column if not exists role text not null default 'branch_admin' check (role in ('branch_admin','branch_user')),
  add column if not exists full_name text,
  add column if not exists department text,
  add column if not exists title text,
  add column if not exists contact_email text;



