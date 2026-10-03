begin;

create table if not exists portal_private.owner_radio_notification_reads (
  viewer_user_id uuid not null
    references portal_private.portal_users(id) on delete restrict,
  viewer_client_key uuid not null
    references portal_private.clients(id) on delete restrict,
  radio_item_id uuid not null
    references portal_private.owner_radio_items(id) on delete cascade,
  read_at timestamptz not null default now(),
  read_by_actor_user_id uuid null
    references portal_private.portal_users(id) on delete set null,
  read_via text not null default 'CLIENT_PORTAL',
  constraint owner_radio_notification_reads_v1_pkey
    primary key (viewer_user_id, viewer_client_key, radio_item_id),
  constraint owner_radio_notification_reads_v1_read_via_check
    check (read_via in ('CLIENT_PORTAL','ADMIN_IMPERSONATION'))
);

create index if not exists owner_radio_notification_reads_v1_item_idx
  on portal_private.owner_radio_notification_reads(radio_item_id, viewer_user_id, viewer_client_key);

comment on table portal_private.owner_radio_notification_reads is
  'Durable read receipts for Client Radio NOTIFICATION items. Receipts are scoped by viewer portal user plus client context so Admin entity preview cannot suppress another client and does not consume the real client user receipt.';

revoke all on table portal_private.owner_radio_notification_reads from anon, authenticated;

commit;
