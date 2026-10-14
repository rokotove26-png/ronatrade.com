-- RONA Trade: append-only signed-agent agreement archive (technical storage, not legal approval).
create table if not exists portal_private.agent_company_documents_v1 (
  id uuid primary key default gen_random_uuid(),
  agent_legal_entity_key uuid not null references portal_private.agent_legal_entities(id) on delete restrict,
  document_kind text not null check (document_kind in ('AGENCY_CONTRACT','AGENCY_ADDENDUM')),
  document_number text null check (document_number is null or (length(btrim(document_number)) between 1 and 120)),
  original_filename text not null check (length(btrim(original_filename)) between 1 and 240),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size between 1 and 15728640),
  storage_bucket text not null default 'rona-portal-private' check (storage_bucket = 'rona-portal-private'),
  storage_path text not null unique,
  uploaded_by uuid not null references portal_private.portal_users(id) on delete restrict,
  admin_signed_attested boolean not null default false check (admin_signed_attested = true),
  review_status text not null default 'UPLOADED' check (review_status in ('UPLOADED','LEGAL_CONFIRMED','REJECTED')),
  source_system text not null default 'ADMIN_AGENT_ARCHIVE_V1',
  uploaded_at timestamptz not null default now(),
  unique (agent_legal_entity_key, sha256)
);
create index if not exists agent_company_documents_v1_agent_recent_idx
  on portal_private.agent_company_documents_v1(agent_legal_entity_key, uploaded_at desc);
alter table portal_private.agent_company_documents_v1 enable row level security;
revoke all on portal_private.agent_company_documents_v1 from anon, authenticated;
comment on table portal_private.agent_company_documents_v1 is
  'Agent legal entity PDF archive. Upload attestation does not create a confirmed legal contract, commission term, or payment authority. No destructive UI endpoint.';
