-- Make Clear all a private dismissal rather than a destructive delete.
alter table public.teacher_notifications
  add column if not exists dismissed_at timestamptz;

revoke delete on public.teacher_notifications from authenticated;
drop policy if exists teacher_notifications_recipient_delete on public.teacher_notifications;
grant update (read_at, dismissed_at) on public.teacher_notifications to authenticated;

create or replace function private.guard_teacher_notification_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recipient_id is distinct from old.recipient_id
     or new.created_by is distinct from old.created_by
     or new.category is distinct from old.category
     or new.period_start is distinct from old.period_start
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.organization_id is distinct from old.organization_id then
    raise exception 'Notification content is immutable';
  end if;

  if new.created_at is distinct from old.created_at then
    if old.category = 'NEW_FEEDBACK'::text
       and new.created_at > old.created_at
       and new.read_at is null
       and new.dismissed_at is null then
      return new;
    end if;
    raise exception 'Notification creation time is immutable';
  end if;

  if old.read_at is not null and new.read_at is null then
    raise exception 'Read notifications cannot be marked unread';
  end if;

  if new.dismissed_at is distinct from old.dismissed_at then
    if old.dismissed_at is not null
       or new.dismissed_at is null
       or (select auth.uid()) is distinct from old.recipient_id then
      raise exception 'Notification dismissal is not permitted';
    end if;
  end if;
  return new;
end;
$$;

comment on column public.teacher_notifications.dismissed_at is
  'Private soft-dismissal timestamp; dismissed reminders remain deduplicated for their period.';
