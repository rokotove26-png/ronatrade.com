create table if not exists portal_private.owner_claims (
  id uuid primary key default gen_random_uuid(),
  claim_id text not null unique,
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  deal_key uuid null references portal_private.deals(id),
  category text not null,
  subject text not null,
  description text null,
  status text not null default 'REVIEW' check (status in ('REVIEW','ACCEPTED','REJECTED')),
  primary_document_key uuid not null references portal_private.documents(id),
  response_document_key uuid null references portal_private.documents(id),
  legal_handoff_record_id uuid null references portal_private.ai_coordination_records(record_id),
  received_at timestamptz not null default now(),
  decision_at timestamptz null,
  created_by uuid not null references portal_private.portal_users(id),
  updated_by uuid not null references portal_private.portal_users(id),
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'::portal_private.lifecycle_state_enum,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_claims_status_idx on portal_private.owner_claims(status, updated_at desc);
create index if not exists owner_claims_client_idx on portal_private.owner_claims(client_key, updated_at desc);
create index if not exists owner_claims_contract_idx on portal_private.owner_claims(contract_key, updated_at desc);
create index if not exists owner_claims_deal_idx on portal_private.owner_claims(deal_key, updated_at desc) where deal_key is not null;

comment on table portal_private.owner_claims is 'Authoritative Admin Portal claims registry. Legal AI analysis is carried through immutable ai_coordination_records; authoritative claim status remains ADMIN-controlled.';
