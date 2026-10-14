-- Agent Rewards: deal-scoped signed agency addendum and services-act lifecycle.
-- Additive only. No mutation of bank facts, Finance authority, settlements or historical signed PDFs.
create table if not exists portal_private.agent_reward_deal_addenda_v1 (
 id uuid primary key default gen_random_uuid(),
 deal_key uuid not null references portal_private.deals(id) on delete restrict,
 assignment_id uuid not null references portal_private.agent_client_assignments(id) on delete restrict,
 agent_legal_entity_key uuid not null references portal_private.agent_legal_entities(id) on delete restrict,
 agency_document_key uuid not null references portal_private.agent_agency_contract_documents(id) on delete restrict,
 agent_deal_term_key uuid references portal_private.agent_deal_terms(id) on delete restrict,
 lifecycle_state text not null default 'SOURCE_RECEIVED'
   check (lifecycle_state in ('SOURCE_RECEIVED','LEGAL_VERIFIED','SUPERSEDED')),
 is_current boolean not null default true,
 linked_at timestamptz not null default now(),
 linked_by uuid not null,
 legal_conclusion_ref text,
 legal_verified_at timestamptz,
 unique(deal_key,assignment_id,agency_document_key)
);
create unique index if not exists agent_reward_deal_addenda_v1_one_current
 on portal_private.agent_reward_deal_addenda_v1(deal_key,assignment_id) where is_current;
create index if not exists agent_reward_deal_addenda_v1_company_document
 on portal_private.agent_reward_deal_addenda_v1(agent_legal_entity_key,agency_document_key);
alter table portal_private.agent_reward_deal_addenda_v1 enable row level security;
revoke all on portal_private.agent_reward_deal_addenda_v1 from public,anon,authenticated;

create table if not exists portal_private.agent_reward_act_requests_v1 (
 id uuid primary key default gen_random_uuid(),
 deal_key uuid not null references portal_private.deals(id) on delete restrict,
 assignment_id uuid not null references portal_private.agent_client_assignments(id) on delete restrict,
 addendum_binding_key uuid not null references portal_private.agent_reward_deal_addenda_v1(id) on delete restrict,
 owner_correction_key uuid not null references portal_private.agent_reward_owner_corrections_v1(id) on delete restrict,
 correction_version integer not null,
 stage text not null default 'PENDING_FINANCE_LEGAL'
   check(stage in ('PENDING_FINANCE_LEGAL','FINANCE_REVIEWED','LEGAL_REVIEWED',
                   'READY_FOR_SIGNATURE','SIGNED_ARCHIVED','REJECTED','SUPERSEDED')),
 financial_source_snapshot jsonb not null,
 contractual_term_snapshot jsonb not null,
 finance_conclusion_ref text,
 legal_conclusion_ref text,
 verified_amount numeric,
 verified_currency varchar(3),
 generated_pdf_object_key uuid references portal_private.storage_objects(id) on delete restrict,
 signed_pdf_object_key uuid references portal_private.storage_objects(id) on delete restrict,
 signed_filename text,
 signed_sha256 text,
 requested_at timestamptz not null default now(),
 requested_by uuid not null,
 updated_at timestamptz not null default now(),
 signed_uploaded_at timestamptz,
 signed_uploaded_by uuid,
 unique(deal_key,assignment_id,addendum_binding_key,owner_correction_key),
 check ((stage <> 'SIGNED_ARCHIVED') or
   (signed_pdf_object_key is not null and signed_sha256 is not null and
    finance_conclusion_ref is not null and legal_conclusion_ref is not null))
);
create index if not exists agent_reward_act_requests_v1_lookup
 on portal_private.agent_reward_act_requests_v1(deal_key,assignment_id,requested_at desc);
alter table portal_private.agent_reward_act_requests_v1 enable row level security;
revoke all on portal_private.agent_reward_act_requests_v1 from public,anon,authenticated;

comment on table portal_private.agent_reward_deal_addenda_v1 is
 'Source-preserving deal-to-archived-signed-agency-addendum link; upload never implies Legal approval.';
comment on table portal_private.agent_reward_act_requests_v1 is
 'Owner-correction snapshot and Finance/Legal review request; pending request never creates payable or approved PDF.';
