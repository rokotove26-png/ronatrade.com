begin;

create table if not exists portal_private.owner_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_publication_item_key uuid null references portal_private.publication_items(id) on delete set null,
  product text not null,
  producer text null,
  supplier text null,
  purchase_price numeric null,
  rail_tariff numeric null,
  rail_segments jsonb not null default '[]'::jsonb,
  basis text null,
  border_crossing text null,
  final_station text null,
  landed_cost numeric null,
  rona_margin numeric null,
  sale_price numeric not null,
  currency char(3) not null,
  payment_terms text null,
  commercial_terms text null,
  source_reference text null,
  business_status text not null default 'AGREED' check (business_status in ('AGREED','PUBLISHED','SUPERSEDED')),
  agreed_at timestamptz not null default now(),
  published_at timestamptz null,
  published_by uuid null references portal_private.portal_users(id),
  source_system text not null default 'EXECUTIVE_WORK_CONTOUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_price_snapshots_status_idx
  on portal_private.owner_price_snapshots(business_status, agreed_at desc);

create table if not exists portal_private.owner_deal_documents (
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id) on delete cascade,
  document_key uuid not null references portal_private.documents(id) on delete cascade,
  document_kind text not null check (document_kind in ('ADDENDUM','INVOICE','SIGNED_ADDENDUM')),
  checked_by_admin boolean not null default false,
  checked_at timestamptz null,
  checked_by uuid null references portal_private.portal_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(deal_key, document_key, document_kind)
);

create index if not exists owner_deal_documents_deal_idx
  on portal_private.owner_deal_documents(deal_key, document_kind, updated_at desc);

insert into portal_private.owner_application_workflow(application_key,business_status,created_at,updated_at)
select a.id,
       case a.status::text
         when 'DEAL_REGISTERED' then 'DEAL'
         when 'REJECTED' then 'REJECTED'
         when 'ACCEPTED_AWAITING_DEAL_REGISTRATION' then 'SUPPLIER_REVIEW'
         when 'UNDER_REVIEW' then 'SUPPLIER_REVIEW'
         else 'NEW'
       end,
       coalesce(a.created_at,now()),
       coalesce(a.updated_at,now())
from portal_private.client_applications a
on conflict (application_key) do nothing;

insert into portal_private.owner_deal_workflow(deal_key,created_at,updated_at)
select d.id,coalesce(d.created_at,now()),coalesce(d.updated_at,now())
from portal_private.deals d
on conflict (deal_key) do nothing;

create unique index if not exists agent_client_one_current_owner_assignment_idx
  on portal_private.agent_client_assignments(client_key)
  where status='ACTIVE'::portal_private.binding_status_enum
    and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and valid_to is null;

revoke all on portal_private.owner_price_snapshots from anon, authenticated;
revoke all on portal_private.owner_deal_documents from anon, authenticated;

commit;
