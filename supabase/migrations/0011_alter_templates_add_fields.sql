alter table public.templates
  add column if not exists department text,
  add column if not exists visibility text not null default 'organization' check (visibility in ('organization','branch','department'));

