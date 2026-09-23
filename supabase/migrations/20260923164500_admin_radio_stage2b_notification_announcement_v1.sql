-- Admin Radio Stage 2B: durable notification/announcement publication metadata.
-- MESSAGE remains canonical in portal_reverse_events and is not migrated here.

alter table portal_private.owner_radio_items
  add column if not exists idempotency_key text null,
  add column if not exists request_id uuid null,
  add column if not exists correlation_id uuid null;

create unique index if not exists owner_radio_items_actor_idempotency_uq
  on portal_private.owner_radio_items(created_by,idempotency_key)
  where idempotency_key is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='portal_private.owner_radio_items'::regclass
      and conname='owner_radio_items_idempotency_key_check'
  ) then
    alter table portal_private.owner_radio_items
      add constraint owner_radio_items_idempotency_key_check
      check (idempotency_key is null or (length(btrim(idempotency_key)) between 1 and 160));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='portal_private.owner_radio_items'::regclass
      and conname='owner_radio_items_active_window_check'
  ) then
    alter table portal_private.owner_radio_items
      add constraint owner_radio_items_active_window_check
      check (active_until is null or active_until >= active_from);
  end if;
end $$;

comment on column portal_private.owner_radio_items.idempotency_key is
  'Stage 2B Admin Radio idempotency key. Unique per creator when present.';
comment on column portal_private.owner_radio_items.request_id is
  'Request lineage for controlled Admin Radio publication.';
comment on column portal_private.owner_radio_items.correlation_id is
  'Correlation lineage for controlled Admin Radio publication.';

revoke all on portal_private.owner_radio_items from anon, authenticated;
