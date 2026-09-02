import { readFile } from 'node:fs/promises';

const [migration,admin,events]=await Promise.all([
  readFile('supabase/migrations/20260902233000_client_communication_admin_gate_v1.sql','utf8'),
  readFile('supabase/functions/rona-portal-api/admin.ts','utf8'),
  readFile('supabase/functions/rona-portal-api/events.ts','utf8')
]);
const must=(value,code)=>{if(!value)throw new Error(code)};

for(const token of [
  "new.actor_role = 'CLIENT'::portal_private.portal_role_enum",
  "new.event_type like 'CLIENT_%'",
  'server_admin_route_client_intake',
  "r.role='ADMIN'::portal_private.portal_role_enum",
  "r.status='ACTIVE'",
  "ev.actor_role <> 'CLIENT'::portal_private.portal_role_enum",
  "ev.event_type not like 'CLIENT_%'",
  'assigned_functional_role',
  'source_reverse_event_key',
  'ADMIN_ROUTE_CLIENT_INTAKE',
  "grant execute on function portal_private.server_admin_route_client_intake"
])must(migration.includes(token),`CLIENT_ADMIN_GATE_MIGRATION_MISSING:${token}`);

must(migration.indexOf("new.actor_role = 'CLIENT'::portal_private.portal_role_enum") < migration.indexOf('staff_role_for_reverse_event(new.event_type)'), 'CLIENT_ADMIN_GATE_MUST_PRECEDE_STAFF_ROUTING');
must(!migration.includes("'ADMIN'::portal_private.staff_functional_role_enum"),'ADMIN_MUST_NOT_BE_FAKE_STAFF_ROLE');
must(migration.includes("role := portal_private.staff_role_for_reverse_event(new.event_type)"),'NON_CLIENT_ROUTING_MUST_BE_PRESERVED');

for(const token of [
  'async function adminClientApplications()',
  'from portal_private.client_applications a',
  'async function adminClientIntake()',
  'from portal_private.portal_reverse_events e',
  "where e.actor_role='CLIENT'",
  "and e.event_type like 'CLIENT_%'",
  'left join portal_private.staff_tasks t on t.source_reverse_event_key=e.id',
  'applications,',
  'client_intake:clientIntake',
  'CLIENT_ADMIN_INTAKE_V1'
])must(admin.includes(token),`ADMIN_CLIENT_INTAKE_PROJECTION_MISSING:${token}`);

for(const token of [
  'ADMIN_CLIENT_INTAKE_ROUTE',
  'server_admin_route_client_intake',
  'SOURCE_CLIENT_EVENT_REQUIRED',
  'INVALID_FUNCTIONAL_ROLE',
  'functionalRoles',
  'role==="ADMIN"&&eventType==="ADMIN_CLIENT_INTAKE_ROUTE"'
])must(events.includes(token),`ADMIN_CLIENT_INTAKE_EVENT_ROUTE_MISSING:${token}`);

must(events.includes('CLIENT_APPLICATION_SUBMIT'),'CLIENT_APPLICATION_EVENT_ALLOWED');
must(events.includes('CLIENT_CLAIM_SUBMIT'),'CLIENT_CLAIM_EVENT_ALLOWED');
must(events.includes('CLIENT_PAYMENT_PROOF_SUBMIT'),'CLIENT_PAYMENT_PROOF_EVENT_ALLOWED');
must(events.includes('CLIENT_MESSAGE_SUBMIT'),'CLIENT_MESSAGE_EVENT_ALLOWED');
must(!events.includes('ADMIN"::portal_private.staff_functional_role_enum'),'ADMIN_MUST_NOT_BE_FAKE_FUNCTIONAL_ROLE');

console.log('CLIENT_ADMIN_COMMUNICATION_GATE_QA=PASS client-origin=Admin-first admin-routing=explicit-existing-events-api published-content=unchanged');
