begin;

create table if not exists portal_private.owner_application_workflow (
  application_key uuid primary key references portal_private.client_applications(id) on delete cascade,
  business_status text not null default 'NEW' check (business_status in ('NEW','ACCEPTED','SUPPLIER_REVIEW','COUNTER_OFFERED','CLIENT_COUNTER_ACCEPTED','REJECTED','SUPPLIER_APPROVED','DEAL')),
  counter_price numeric null,
  counter_currency char(3) null,
  counter_offer_used boolean not null default false,
  client_counter_response text null check (client_counter_response is null or client_counter_response in ('ACCEPTED','DECLINED')),
  admin_decided_by uuid null references portal_private.portal_users(id),
  admin_decided_at timestamptz null,
  supplier_approved_by uuid null references portal_private.portal_users(id),
  supplier_approved_at timestamptz null,
  finalized_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_application_workflow_status_idx
  on portal_private.owner_application_workflow(business_status, updated_at desc);

create table if not exists portal_private.owner_deal_workflow (
  deal_key uuid primary key references portal_private.deals(id) on delete cascade,
  payment_handoff_state text not null default 'NOT_SENT' check (payment_handoff_state in ('NOT_SENT','READY','SENT')),
  payment_handoff_at timestamptz null,
  payment_handoff_by uuid null references portal_private.portal_users(id),
  signed_supplement_document_key uuid null references portal_private.documents(id),
  signed_supplement_checked_at timestamptz null,
  signed_supplement_checked_by uuid null references portal_private.portal_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_private.owner_payment_plan (
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id) on delete cascade,
  tranche_no integer not null check (tranche_no > 0),
  share_text text null,
  planned_amount numeric not null check (planned_amount >= 0),
  currency char(3) not null,
  due_at timestamptz null,
  status text not null default 'EXPECTED' check (status in ('EXPECTED','PARTIAL','RECEIVED','CANCELLED')),
  source_system text not null default 'FINANCE_CONTOUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(deal_key, tranche_no)
);

create index if not exists owner_payment_plan_deal_idx
  on portal_private.owner_payment_plan(deal_key, status, tranche_no);

create table if not exists portal_private.owner_cash_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  currency char(3) not null default 'RUB',
  opening_balance numeric not null default 0,
  received_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  closing_balance numeric not null default 0,
  source_system text not null default 'FINANCE_CONTOUR',
  updated_by uuid null references portal_private.portal_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(snapshot_date, currency)
);

create table if not exists portal_private.owner_radio_items (
  id uuid primary key default gen_random_uuid(),
  item_kind text not null check (item_kind in ('MESSAGE','NOTIFICATION','ANNOUNCEMENT')),
  target_scope text not null check (target_scope in ('CLIENT','AGENT','ALL_CLIENTS','ALL_AGENTS')),
  target_id text null,
  delivery_channel text not null default 'PORTAL' check (delivery_channel in ('PORTAL','EMAIL','SMS','PUSH')),
  body_text text not null check (length(btrim(body_text)) > 0),
  active_from timestamptz not null default now(),
  active_until timestamptz null,
  created_by uuid null references portal_private.portal_users(id),
  source_system text not null default 'ADMIN_PORTAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_scope in ('ALL_CLIENTS','ALL_AGENTS') and target_id is null) or (target_scope in ('CLIENT','AGENT') and nullif(btrim(target_id),'') is not null))
);

create index if not exists owner_radio_items_active_idx
  on portal_private.owner_radio_items(item_kind, target_scope, active_from desc);

revoke all on portal_private.owner_application_workflow from anon, authenticated;
revoke all on portal_private.owner_deal_workflow from anon, authenticated;
revoke all on portal_private.owner_payment_plan from anon, authenticated;
revoke all on portal_private.owner_cash_snapshots from anon, authenticated;
revoke all on portal_private.owner_radio_items from anon, authenticated;

commit;
