-- RONA Agent Rewards deal-specific documents and agent act request V1.
-- TECHNICAL REGISTRY ONLY. A PDF receipt does not set contract authority, commission rate,
-- payable state, Finance/Legal approval, or change any current payment/OWNER correction.
-- Every act request snapshots existing immutable source IDs; changes require a new request.
create table if not exists portal_private.agent_reward_deal_addenda_v1(
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id) on delete restrict,
  assignment_id uuid not null references portal_private.agent_client_assignments(id) on delete restrict,
  agent_legal_entity_key uuid not null references portal_private.agent_legal_entities(id) on delete restrict,
  agency_document_key uuid not null references portal_private.agent_agency_contract_documents(id) on delete restrict,
  term_key uuid references portal_private.agent_deal_terms(id) on delete restrict,
  document_reference text not null check(length(btrim(document_reference)) between 3 and 180),
  evidence_status text not null default 'RECEIVED_NOT_LEGALLY_VERIFIED'
    check(evidence_status in ('RECEIVED_NOT_LEGALLY_VERIFIED','REVIEW_REQUESTED','VERIFIED_BY_EXISTING_AUTHORITY','SUPERSEDED')),
  is_current boolean not null default true,
  source_system text not null default 'OWNER_AGENT_REWARDS' check(source_system='OWNER_AGENT_REWARDS'),
  source_version text not null default 'DEAL_SIGNED_ADDENDUM_EVIDENCE_V1',
  linked_by uuid not null references portal_private.portal_users(id) on delete restrict,
  linked_at timestamptz not null default now(),
  unique(deal_key,assignment_id,agency_document_key)
);
create unique index if not exists agent_reward_deal_addenda_current_v1
  on portal_private.agent_reward_deal_addenda_v1(deal_key,assignment_id)
  where is_current=true;
create index if not exists agent_reward_deal_addenda_agent_v1
  on portal_private.agent_reward_deal_addenda_v1(agent_legal_entity_key,linked_at desc);
alter table portal_private.agent_reward_deal_addenda_v1 enable row level security;
revoke all on portal_private.agent_reward_deal_addenda_v1 from public,anon,authenticated;

create table if not exists portal_private.agent_reward_act_requests_v1(
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id) on delete restrict,
  assignment_id uuid not null references portal_private.agent_client_assignments(id) on delete restrict,
  addendum_key uuid not null references portal_private.agent_reward_deal_addenda_v1(id) on delete restrict,
  owner_correction_key uuid not null references portal_private.agent_reward_owner_corrections_v1(id) on delete restrict,
  correction_version integer not null check(correction_version>0),
  term_key uuid references portal_private.agent_deal_terms(id) on delete restrict,
  request_status text not null default 'REVIEW_REQUESTED'
    check(request_status in ('REVIEW_REQUESTED','FINANCE_LEGAL_REVIEW','DRAFT_READY',
      'OWNER_SIGNED','AWAITING_AGENT_SIGNATURE','SIGNED_ARCHIVED','SUPERSEDED','REJECTED')),
  finance_review_record_id uuid references portal_private.ai_coordination_records(record_id) on delete restrict,
  legal_review_record_id uuid references portal_private.ai_coordination_records(record_id) on delete restrict,
  finance_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(finance_snapshot)='object'),
  legal_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(legal_snapshot)='object'),
  source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object'),
  generated_document_number text,
  prepared_at timestamptz,
  dispatched_at timestamptz,
  dispatch_evidence_ref text,
  completed_at timestamptz,
  requested_by uuid not null references portal_private.portal_users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  source_version text not null default 'AGENT_ACT_WORKFLOW_V1',
  unique(deal_key,assignment_id,addendum_key,owner_correction_key)
);
create index if not exists agent_reward_act_requests_deal_v1
  on portal_private.agent_reward_act_requests_v1(deal_key,requested_at desc);
alter table portal_private.agent_reward_act_requests_v1 enable row level security;
revoke all on portal_private.agent_reward_act_requests_v1 from public,anon,authenticated;

create table if not exists portal_private.agent_reward_act_documents_v1(
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null references portal_private.agent_reward_act_requests_v1(id) on delete restrict,
  storage_object_key uuid not null unique references portal_private.storage_objects(id) on delete restrict,
  document_stage text not null
    check(document_stage in ('FINANCE_LEGAL_DRAFT','OWNER_SIGNED','BOTH_SIGNED')),
  filename text not null check(length(btrim(filename)) between 5 and 180),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check(byte_size>0 and byte_size<=20971520),
  signed_attestation boolean not null default false,
  uploaded_by uuid not null references portal_private.portal_users(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  source_version text not null default 'AGENT_ACT_SIGNED_ARCHIVE_V1',
  unique(request_key,document_stage,sha256)
);
create index if not exists agent_reward_act_docs_request_v1
  on portal_private.agent_reward_act_documents_v1(request_key,uploaded_at desc);
alter table portal_private.agent_reward_act_documents_v1 enable row level security;
revoke all on portal_private.agent_reward_act_documents_v1 from public,anon,authenticated;

comment on table portal_private.agent_reward_deal_addenda_v1 is
'Existing agent-company signed PDF linked to a specific deal/assignment. Receipt never authorizes an agent payment.';
comment on table portal_private.agent_reward_act_requests_v1 is
'Immutable OWNER correction and addendum source references for draft legal/finance review. Request does not create payable or signed act.';
comment on table portal_private.agent_reward_act_documents_v1 is
'Private PDF proof at draft/owner-signed/both-signed stages. Never serves as authorization for external settlement.';
