-- Head-only AI insight snapshots. Inputs are privacy-suppressed monthly aggregates only.
create table public.monthly_ai_insights (
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete restrict,
  report_month date not null,
  model text not null check (char_length(model) between 1 and 120),
  overall_summary text not null check (char_length(overall_summary) between 20 and 2400),
  priorities jsonb not null check (
    jsonb_typeof(priorities)='array'
    and jsonb_array_length(priorities)<=8
    and pg_column_size(priorities)<=16000
  ),
  generated_by uuid references public.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  primary key (organization_id,report_month)
);

create index monthly_ai_insights_generated_by_idx
  on public.monthly_ai_insights(generated_by)
  where generated_by is not null;

alter table public.monthly_ai_insights enable row level security;
revoke all on public.monthly_ai_insights from anon,authenticated;
grant select on public.monthly_ai_insights to authenticated;

create policy monthly_ai_insights_head_read
  on public.monthly_ai_insights for select to authenticated
  using (
    organization_id=private.current_organization_id()
    and private.is_admin()
  );

create policy monthly_ai_insights_tenant_boundary
  on public.monthly_ai_insights as restrictive for all to authenticated
  using (organization_id=private.current_organization_id())
  with check (organization_id=private.current_organization_id());

comment on table public.monthly_ai_insights is
  'Head-only AI summaries generated from minimum-five-suppressed aggregate reports; never contains raw answers or student identities.';
