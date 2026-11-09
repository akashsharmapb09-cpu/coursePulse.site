-- CoursePulse has exactly one Platform Super Admin owner.
-- This partial product has a single platform operator; additional memberships
-- must never be created by signup, HOD invitation, or ordinary admin tooling.

do $$
declare
  v_memberships bigint;
begin
  select count(*) into v_memberships from private.platform_admins;
  if v_memberships > 1 then
    raise exception 'Multiple Platform Super Admin memberships already exist; reconcile the owner before applying this migration';
  end if;
end;
$$;

-- A unique expression index on a constant allows at most one row, regardless
-- of user_id. It also protects against privileged service-role code paths.
create unique index if not exists platform_admins_single_owner_idx
  on private.platform_admins ((true));

-- Normal clients must not provision, transfer, or revoke the platform owner.
-- Trusted out-of-band database operator access remains the only provisioning path.
revoke insert, update, delete, truncate, references, trigger
  on table private.platform_admins
  from public, anon, authenticated;

comment on index private.platform_admins_single_owner_idx is
  'Enforces a single CoursePulse Platform Super Admin membership across the entire platform.';
