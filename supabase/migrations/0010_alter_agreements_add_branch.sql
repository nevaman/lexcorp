alter table public.agreements
  add column if not exists branch_office_id uuid references public.branch_offices (id) on delete set null;

create index if not exists agreements_branch_office_id_idx on public.agreements (branch_office_id);

