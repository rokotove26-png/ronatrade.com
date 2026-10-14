-- RONA Trade: Agent legal-entity signed agreement archive, additive only.
-- Legal companies are NOT agent persons; uploading does not approve the economic term
-- or create an agent payable. Signed bytes are kept in the existing private bucket
-- with documents / document_versions / storage_objects canonical metadata.
create table if not exists portal_private.agent_agency_contract_documents (
  id uuid primary key default gen_random_uuid(),
  agent_legal_entity_key uuid not null
    references portal_private.agent_legal_entities(id) on delete restrict,
  document_key uuid not null unique
    references portal_private.documents(id) on delete restrict,
  document_kind text not null
    check (document_kind in ('AGENCY_CONTRACT', 'AGENCY_ADDENDUM')),
  contract_reference text null
    check (contract_reference is null or length(btrim(contract_reference)) between 1 and 180),
  uploaded_by uuid not null references portal_private.portal_users(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  constraint agent_agency_document_legal_unique unique(agent_legal_entity_key,document_key)
);
create index if not exists agent_agency_docs_legal_uploaded
  on portal_private.agent_agency_contract_documents(agent_legal_entity_key, uploaded_at desc);
alter table portal_private.agent_agency_contract_documents enable row level security;
revoke all on portal_private.agent_agency_contract_documents from public, anon, authenticated;
comment on table portal_private.agent_agency_contract_documents is
  'Append-only owner-authenticated archive links for agency contracts/addenda.
   Source-received does not imply Legal approval or payment authority.
   All reads/uploads/downloads require verified ADMIN session in RONA Edge API.';
