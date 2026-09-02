import { readFile } from 'node:fs/promises';

const [router,claims]=await Promise.all([
  readFile('supabase/functions/rona-portal-api/index.ts','utf8'),
  readFile('supabase/functions/rona-portal-api/client-claims.ts','utf8')
]);
const must=(value,code)=>{if(!value)throw new Error(code)};
for(const token of ['import { clientClaims } from "./client-claims.ts"','route==="/v1/client/claims"','CLIENT_CONTRACT_CONTEXT_REQUIRED','clientClaims(c,clientId,contractId)'])must(router.includes(token),`CLIENT_CLAIMS_ROUTE_SCOPE_MISSING:${token}`);
for(const token of ['portal_private.owner_claims','cl.client_id=${clientId}','ct.contract_id=${contractId}','client_user_has_contract_access','client_user_has_deal_access','client_user_has_document_access',"oc.lifecycle_state='ACTIVE'"])must(claims.includes(token),`CLIENT_CLAIMS_PROJECTION_SCOPE_MISSING:${token}`);
for(const forbidden of [/RONA-C\d{3}/u,/DEAL-\d{4}-\d{3,}/u,/FARGONA\s+GAZ/iu,/UNIVERSAL\s+SOLYARIS/iu])must(!forbidden.test(claims),`CLIENT_CLAIMS_HARDCODE:${forbidden}`);
for(const forbidden of ['staff_task_messages','addStaffTaskMessage','recipient_role','employee_role','staff_recipient'])must(!claims.includes(forbidden),`CLIENT_CLAIMS_DIRECT_STAFF_CHANNEL_FORBIDDEN:${forbidden}`);
must(!claims.includes('legal_handoff_record_id'),'CLIENT_CLAIMS_INTERNAL_HANDOFF_EXPOSURE');
must(!claims.includes('created_by'),'CLIENT_CLAIMS_INTERNAL_ACTOR_EXPOSURE');
must(claims.includes('portal_private.owner_claims'),'CLIENT_CLAIMS_ADMIN_CONTOUR_SOURCE_REQUIRED');
console.log('CLIENT_CLAIMS_CONTEXT_SCOPE_QA=PASS admin-mediated-read-projection=true direct-staff-channel=false');
