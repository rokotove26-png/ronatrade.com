import { readFile } from 'node:fs/promises';

const [router,client]=await Promise.all([
  readFile('supabase/functions/rona-portal-api/index.ts','utf8'),
  readFile('supabase/functions/rona-portal-api/client.ts','utf8')
]);
const must=(v,code)=>{if(!v)throw new Error(code)};
for(const token of ['import { clientBootstrap, clientShipments } from "./client.ts"','route==="/v1/client/shipments"','CLIENT_CONTRACT_CONTEXT_REQUIRED','clientShipments(c,clientId,contractId)','route==="/v1/client/rail"','cl.client_id=${clientId}','ct.contract_id=${contractId}','client_user_has_contract_access','client_user_has_deal_access'])must(router.includes(token),`CLIENT_BACKEND_CONTEXT_SCOPE_MISSING:${token}`);
must(!router.includes('server_client_shipments(${c.auth}::uuid,${c.sid},null::uuid)'), 'CLIENT_SHIPMENTS_ALL_CONTEXT_ROUTE_FORBIDDEN');
for(const token of ['export async function clientShipments','cl.client_id=${clientId}','ct.contract_id=${contractId}','client_user_has_contract_access','client_user_has_shipment_access','s.client_key=cl.id'])must(client.includes(token),`CLIENT_SHIPMENT_PROJECTION_SCOPE_MISSING:${token}`);
for(const hardcoded of [/RONA-C\d{3}-CTR-2026-\d{3}/u,/DEAL-2026-\d{3}/u,/FARGONA\s+GAZ/iu,/UNIVERSAL\s+SOLYARIS/iu])must(!hardcoded.test(client),`CLIENT_SHIPMENT_PROJECTION_HARDCODE:${hardcoded}`);
for(const invariant of [
  'adminStorageObject(adminStorageMatch[1])',
  'executiveRecordSupplierResponse(c,req,requestId)',
  "payment_status:dealFinance,payment_label:dealFinance==='OVERDUE'?'Оплата просрочена':'Ожидается оплата',payment_received_amount:null,payment_obligation_amount:null,payment_currency:currency,payment_percent:null,payment_source:'DEAL_FINANCE_STATUS'"
])must(router.includes(invariant),`CLIENT_BACKEND_UNRELATED_SEMANTICS_DRIFT:${invariant}`);
for(const forbidden of ['adminStorageObject(clientStorageMatch[1])','executiveRecordSupplierResponse(c,req,supplierRequestMatch[1])'])must(!router.includes(forbidden),`CLIENT_BACKEND_UNRELATED_ROUTING_DRIFT:${forbidden}`);
console.log('CLIENT_BACKEND_CONTEXT_SCOPE_QA=PASS deals=client+contract shipments=client+contract rail=client+contract unrelated-semantics=preserved');
