-- Corporate agency documents live under legal entity keys, not client contracts.
-- This additive, isolated registry is the canonical archive for signed agency PDF evidence.
-- Storage remains rona-portal-private with existing byte limit and mime policy.
-- A signed PDF upload does not approve an agent commission, terms, or a payable.
create table if not exists portal_private.agent_agency_contract_documents (
  id uuid primary key default gen_random_uuid(),
  document_id text not null unique
    check (document_id ~ '^AGENCY-S-[0-9]{3,}-[A-Z0-9]{8}$'),
  agent_legal_entity_key uuid not null
    references portal_private.agent_legal_entities(id) on delete restrict,
  storage_object_key uuid not null unique
    references portal_private.storage_objects(id) on delete restrict,
  document_kind text not null
    check (document_kind in ('AGENCY_CONTRACT','AGENCY_ADDENDUM')),
  contract_reference text
    check (contract_reference is null or length(btrim(contract_reference)) between 1 and 180),
  authoritative_filename text not null
    check (length(btrim(authoritative_filename)) between 5 and 180),
  sha256 text not null check (sha256 ~ '^[0-9a-fA-F]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  uploaded_by uuid not null
    references portal_private.portal_users(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  authority_state portal_private.authority_state_enum not null
    default 'SOURCE_RECEIVED'::portal_private.authority_state_enum,
  lifecycle_state portal_private.lifecycle_state_enum not null
    default 'ACTIVE'::portal_private.lifecycle_state_enum,
  source_system text not null default 'ADMIN_PORTAL',
  source_version text not null default 'AGENCY_SIGNED_PDF_ARCHIVE_V1',
  constraint agent_agency_document_unique_source unique(agent_legal_entity_key,sha256)
);
create index if not exists agent_agency_docs_legal_uploaded
  on portal_private.agent_agency_contract_documents(agent_legal_entity_key,uploaded_at desc);
alter table portal_private.agent_agency_contract_documents enable row level security;
revoke all on portal_private.agent_agency_contract_documents from public, anon, authenticated;
comment on table portal_private.agent_agency_contract_documents is
  'Company-owned canonical agency PDF evidence. ADMIN-only private API.
   No client-contract FK. No auto-approval, no agent deal terms, no payable.
   Upload and download are audited. File bytes are held in private storage.';
