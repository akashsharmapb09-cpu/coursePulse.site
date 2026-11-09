create index monthly_report_settings_updated_by_idx
  on public.monthly_report_settings(updated_by)
  where updated_by is not null;
