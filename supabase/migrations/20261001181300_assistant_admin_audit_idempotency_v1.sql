-- Idempotent audit support for RONA Assistant administrative mutations.
alter table portal_private.assistant_admin_audit_v1
  add column if not exists idempotency_key_hash text,
  add column if not exists payload_hash text,
  add column if not exists result jsonb;

alter table portal_private.assistant_admin_audit_v1
  drop constraint if exists assistant_admin_audit_v1_idempotency_key_hash_check;
alter table portal_private.assistant_admin_audit_v1
  add constraint assistant_admin_audit_v1_idempotency_key_hash_check
  check (idempotency_key_hash is null or idempotency_key_hash ~ '^[0-9a-f]{64}$');

alter table portal_private.assistant_admin_audit_v1
  drop constraint if exists assistant_admin_audit_v1_payload_hash_check;
alter table portal_private.assistant_admin_audit_v1
  add constraint assistant_admin_audit_v1_payload_hash_check
  check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$');

create unique index if not exists assistant_admin_audit_v1_idem_uq
  on portal_private.assistant_admin_audit_v1(identity_id,tool_name,idempotency_key_hash)
  where idempotency_key_hash is not null;
