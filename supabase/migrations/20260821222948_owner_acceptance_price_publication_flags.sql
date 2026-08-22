begin;

alter table portal_private.owner_price_snapshots
  add column if not exists publish_client boolean not null default false,
  add column if not exists publish_agent boolean not null default false,
  add column if not exists client_published_at timestamptz null,
  add column if not exists agent_published_at timestamptz null;

create index if not exists owner_price_snapshots_client_idx
  on portal_private.owner_price_snapshots(publish_client, business_status, agreed_at desc);
create index if not exists owner_price_snapshots_agent_idx
  on portal_private.owner_price_snapshots(publish_agent, business_status, agreed_at desc);

commit;
