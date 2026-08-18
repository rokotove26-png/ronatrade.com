create table if not exists portal_private.ai_coordination_records (
  record_id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('FUNCTIONAL_CONCLUSION','TASK_ACKNOWLEDGEMENT','TASK_PROGRESS','HANDOFF_REQUEST','BUSINESS_CHANGE_PROPOSAL','OPERATIONS_INTERNAL_DECISION')),
  functional_role portal_private.ai_business_role_enum not null,
  identity_id text not null,
  token_id uuid,
  client_id text not null,
  server_slug text not null,
  tool_name text not null,
  target_type text not null,
  target_id text not null,
  target_role portal_private.ai_business_role_enum,
  parent_record_id uuid references portal_private.ai_coordination_records(record_id),
  version integer not null default 1 check (version >= 1),
  supersedes_id uuid references portal_private.ai_coordination_records(record_id),
  idempotency_key_hash text not null check (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs)='array'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  payload jsonb not null,
  status text not null,
  correlation_id uuid not null,
  mcp_request_id uuid not null,
  qa_only boolean not null default false,
  created_at timestamptz not null default now(),
  unique(identity_id,tool_name,idempotency_key_hash)
);
create index if not exists idx_ai_coordination_target_feed on portal_private.ai_coordination_records(target_role,created_at desc) where qa_only=false;
create index if not exists idx_ai_coordination_role_feed on portal_private.ai_coordination_records(functional_role,created_at desc) where qa_only=false;
create index if not exists idx_ai_coordination_parent on portal_private.ai_coordination_records(parent_record_id,created_at desc);
create unique index if not exists uq_ai_coordination_conclusion_version on portal_private.ai_coordination_records(functional_role,target_type,target_id,version) where record_type='FUNCTIONAL_CONCLUSION';

create table if not exists portal_private.ai_coordination_audit_events (
  attempt_id uuid primary key default gen_random_uuid(),
  event_at timestamptz not null default now(),
  functional_role portal_private.ai_business_role_enum not null,
  identity_id text not null,
  token_id uuid,
  client_id text,
  server_slug text not null,
  tool_name text not null,
  target_type text,
  target_id text,
  correlation_id uuid not null,
  mcp_request_id uuid not null,
  idempotency_key_hash text,
  payload_hash text,
  result text not null check (result in ('SUCCESS','IDEMPOTENT_REPLAY','DENIED','CONFLICT','ERROR')),
  denial_code text,
  resulting_record_id uuid,
  resulting_version integer,
  qa_only boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_ai_coordination_audit_role_time on portal_private.ai_coordination_audit_events(functional_role,event_at desc);
create index if not exists idx_ai_coordination_audit_corr on portal_private.ai_coordination_audit_events(correlation_id,event_at desc);

create or replace function portal_private.prevent_ai_coordination_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, portal_private
as $$
begin
  if tg_op='DELETE' and old.qa_only and current_setting('rona.coord_qa_cleanup',true)='on' then
    return old;
  end if;
  raise exception 'AI_COORDINATION_IMMUTABLE' using errcode='55000';
end;
$$;

drop trigger if exists trg_ai_coordination_records_immutable on portal_private.ai_coordination_records;
create trigger trg_ai_coordination_records_immutable before update or delete on portal_private.ai_coordination_records for each row execute function portal_private.prevent_ai_coordination_mutation();
drop trigger if exists trg_ai_coordination_audit_immutable on portal_private.ai_coordination_audit_events;
create trigger trg_ai_coordination_audit_immutable before update or delete on portal_private.ai_coordination_audit_events for each row execute function portal_private.prevent_ai_coordination_mutation();

revoke all on portal_private.ai_coordination_records from anon, authenticated;
revoke all on portal_private.ai_coordination_audit_events from anon, authenticated;
revoke all on function portal_private.prevent_ai_coordination_mutation() from public;
