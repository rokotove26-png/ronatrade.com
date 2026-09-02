import fs from 'node:fs';

const assert=(value,message)=>{if(!value)throw new Error(message)};
const api=fs.readFileSync('supabase/functions/rona-portal-api/index.ts','utf8');
const module=fs.readFileSync('supabase/functions/rona-portal-api/client-communications.ts','utf8');
const admin=fs.readFileSync('supabase/functions/rona-portal-api/admin.ts','utf8');
const gate=fs.readFileSync('supabase/migrations/20260902233000_client_communication_admin_gate_v1.sql','utf8');
const migration=fs.readFileSync('supabase/migrations/20260903001500_client_message_admin_response_v1.sql','utf8');

for(const token of ['/v1/client/messages','/v1/client/archive','CLIENT_CONTRACT_CONTEXT_REQUIRED','clientMessages','submitClientMessage','clientArchive']){
  assert(api.includes(token),`client communication route missing ${token}`);
}
assert(api.includes('adminClientResponseMatch')&&api.includes('adminPublishClientResponse(c,req,eventId)'),'Admin response route missing');
assert(!api.includes('/v1/staff/client-intake')&&!api.includes('/v1/staff/client-messages'),'Direct staff-to-client route forbidden');

for(const token of [
  'client_user_has_contract_access',
  'client_user_has_deal_access',
  'client_user_has_archive_contract_access',
  'client_user_has_archive_deal_access',
  'client_user_has_archive_document_access',
  'CLIENT_MESSAGE_SUBMIT',
  'CLIENT_CONTEXT_ARCHIVE_V1',
  'server_submit_reverse_event'
])assert(module.includes(token),`messages/archive server scope missing ${token}`);
assert(!module.includes('staff_task_messages'),'Client-facing module must not read internal staff messaging');
assert(!module.includes('create table')&&!module.includes('client_messages'),'Messages/archive must not create a parallel business table');
assert(module.includes("e.actor_user_id=${c.user}::uuid"),'Client message ownership scope missing');

for(const token of [
  "new.actor_role = 'CLIENT'::portal_private.portal_role_enum",
  "new.event_type like 'CLIENT_%'",
  'server_admin_route_client_intake'
])assert(gate.includes(token),`Admin-first intake gate missing ${token}`);

for(const token of [
  'client_user_has_archive_contract_access',
  'client_user_has_archive_deal_access',
  'client_user_has_archive_document_access',
  "b.lifecycle_state='ARCHIVED'",
  "b.status='REVOKED'",
  "b.authority_state='SUPERSEDED'",
  "ct.lifecycle_state='ARCHIVED'",
  'alter table portal_private.portal_reverse_events',
  'server_admin_publish_client_response',
  'portal_user_roles',
  'staff_task_messages',
  'internal_only=true',
  'source_reverse_event_key=ev.id',
  "ev.acknowledgement_state='REJECTED'",
  'ADMIN_PUBLISH_CLIENT_RESPONSE'
])assert(migration.includes(token),`Admin-mediated response/archive IAM migration missing ${token}`);

assert(migration.includes('revoke all on function portal_private.client_user_has_archive_contract_access')&&migration.includes('to service_role'),'Archive IAM privilege contract missing');
assert(migration.includes('revoke all on function portal_private.server_admin_publish_client_response')&&migration.includes('grant execute on function portal_private.server_admin_publish_client_response')&&migration.includes('to service_role'),'Response authority privilege contract missing');
assert(admin.includes('staff_messages')&&admin.includes('client_response_text')&&admin.includes('client_response_published_at'),'Admin intake response projection missing');

for(const pattern of [/RONA-C\d{3,}/,/RONA-C\d{3,}-CTR-/,/DEAL-2026-\d{3,}/]){
  assert(!pattern.test(module),`hardcoded business identifier ${pattern}`);
}

console.log('CLIENT_MESSAGES_ARCHIVE_QA=PASS context=client+contract client-to-admin=true admin-to-client=true staff-direct=false archive=projection-only historical-iam=canonical-bindings');
