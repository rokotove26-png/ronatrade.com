import { readFile } from 'node:fs/promises';

const [router,client,marketScope]=await Promise.all([
  readFile('supabase/functions/rona-portal-api/index.ts','utf8'),
  readFile('supabase/functions/rona-portal-api/client.ts','utf8'),
  readFile('supabase/functions/rona-portal-api/client-market-scope.ts','utf8')
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
for(const route of ['/v1/client/deals','/v1/client/documents','/v1/client/payments'])must(router.includes(`"${route}"`),`CLIENT_UNIVERSAL_MODULE_ROUTE_MISSING:${route}`);
for(const token of ['const moduleKey=route.slice(route.lastIndexOf("/")+1)','projection[moduleKey]||[]'])must(router.includes(token),`CLIENT_UNIVERSAL_MODULE_PROJECTION_MISSING:${token}`);
for(const token of ['import { clientMarketSafeScoped } from "./client-market-scope.ts"','route==="/v1/client/market"','clientMarketSafeScoped(c,clientId,contractId)','market:[]'])must(router.includes(token),`CLIENT_MARKET_CONTEXT_SCOPE_MISSING:${token}`);
for(const forbidden of ['data.market=await filterAuthoritativePublishedRows(await clientMarketSafe(c))','clientMarketSafe(c))}):send'])must(!router.includes(forbidden),`CLIENT_MARKET_UNSCOPED_ROUTE_FORBIDDEN:${forbidden}`);
for(const token of ['export async function clientMarketSafeScoped','cl.client_id=${clientId}','ct.contract_id=${contractId}','client_user_has_contract_access','pct.client_key=${clientKey}::uuid'])must(marketScope.includes(token),`CLIENT_MARKET_SCOPE_PROJECTION_MISSING:${token}`);
for(const hardcoded of [/RONA-C\d{3}/u,/DEAL-\d{4}-\d{3,}/u,/FARGONA\s+GAZ/iu,/UNIVERSAL\s+SOLYARIS/iu])must(!hardcoded.test(marketScope),`CLIENT_MARKET_SCOPE_HARDCODE:${hardcoded}`);
console.log('CLIENT_BACKEND_CONTEXT_SCOPE_QA=PASS deals=client+contract documents=client+contract payments=client+contract market=client+contract shipments=client+contract rail=client+contract unrelated-semantics=preserved');
