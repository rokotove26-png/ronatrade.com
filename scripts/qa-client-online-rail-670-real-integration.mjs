import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { onRequest as clientRailRequest } from '../functions/portal/client-rail-current-ui.js';

const apiUrl=String(process.env.ISSUE670_SUPABASE_URL||'').replace(/\/$/,'');
const anonKey=String(process.env.ISSUE670_ANON_KEY||'');
const serviceKey=String(process.env.ISSUE670_SERVICE_ROLE_KEY||'');
const edgeUrl=String(process.env.ISSUE670_EDGE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const dbContainer=String(process.env.ISSUE670_DB_CONTAINER||'');
for(const [name,value] of Object.entries({apiUrl,anonKey,serviceKey,dbContainer})){
  if(!value)throw new Error('ISSUE670_INTEGRATION_ENV_MISSING_'+name);
}

const EMAIL='issue670-client@example.test';
const ADMIN_EMAIL='issue670-admin@example.test';
const PASSWORD='Issue670-'+crypto.randomUUID()+'!aA1';
const ADMIN_PASSWORD='Issue670-Admin-'+crypto.randomUUID()+'!aA1';
const PORTAL_USER='90000000-0000-4000-8000-000000000001';
const ADMIN_PORTAL_USER='90000000-0000-4000-8000-000000000002';
const CLIENT_A='CLIENT-QA-A', CONTRACT_A='CONTRACT-QA-A';
const CLIENT_B='CLIENT-QA-B', CONTRACT_B='CONTRACT-QA-B';
const CLIENT_U='CLIENT-QA-UNAUTHORIZED', CONTRACT_U='CONTRACT-QA-UNAUTHORIZED';
const CLIENT_A_KEY='10000000-0000-4000-8000-000000000001';
const CLIENT_B_KEY='10000000-0000-4000-8000-000000000002';
const CLIENT_U_KEY='10000000-0000-4000-8000-000000000003';
const CONTRACT_A_KEY='20000000-0000-4000-8000-000000000001';
const CONTRACT_B_KEY='20000000-0000-4000-8000-000000000002';
const CONTRACT_U_KEY='20000000-0000-4000-8000-000000000003';
const DEAL_A1='30000000-0000-4000-8000-000000000001';
const DEAL_A2='30000000-0000-4000-8000-000000000002';
const DEAL_B1='30000000-0000-4000-8000-000000000003';
const DEAL_U1='30000000-0000-4000-8000-000000000004';
const DEAL_A3='30000000-0000-4000-8000-000000000005';
const DEAL_A1_ID='DEAL-QA-A1', DEAL_A2_ID='DEAL-QA-A2', DEAL_B1_ID='DEAL-QA-B1', DEAL_U1_ID='DEAL-QA-U1', DEAL_A3_ID='DEAL-QA-A3';

const assert=(value,message)=>{if(!value)throw new Error(message)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function execSql(sql){
  return execFileSync('docker',['exec','-i',dbContainer,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{
    input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']
  }).trim();
}
async function jsonFetch(url,options={}){
  const response=await fetch(url,options);
  const body=await response.json().catch(()=>({}));
  return {response,body};
}
async function createAuthenticatedUser(email,password){
  const create=await jsonFetch(apiUrl+'/auth/v1/admin/users',{
    method:'POST',
    headers:{apikey:serviceKey,authorization:'Bearer '+serviceKey,'content-type':'application/json'},
    body:JSON.stringify({email,password,email_confirm:true}),
  });
  assert(create.response.ok,'AUTH_ADMIN_CREATE_FAILED '+create.response.status+' '+JSON.stringify(create.body));
  const authUserId=String(create.body?.id||create.body?.user?.id||'');
  assert(authUserId,'AUTH_USER_ID_MISSING');
  const login=await jsonFetch(apiUrl+'/auth/v1/token?grant_type=password',{
    method:'POST',headers:{apikey:anonKey,'content-type':'application/json'},
    body:JSON.stringify({email,password}),
  });
  assert(login.response.ok,'AUTH_PASSWORD_LOGIN_FAILED '+login.response.status+' '+JSON.stringify(login.body));
  const accessToken=String(login.body?.access_token||'');
  assert(accessToken,'AUTH_ACCESS_TOKEN_MISSING');
  const payload=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url').toString('utf8'));
  assert(typeof payload.session_id==='string'&&payload.session_id.length>20,'AUTH_SESSION_ID_MISSING');
  return {authUserId,accessToken,sessionId:payload.session_id};
}
function q(value){return String(value).replaceAll("'","''")}
function routeNodes(d){
  return JSON.stringify([
    {sequence:1,stationCode:d.o,station:d.on,lat:d.olat,lng:d.olng,waypointRole:'ORIGIN'},
    {sequence:2,stationCode:d.d,station:d.dn,lat:d.dlat,lng:d.dlng,waypointRole:'DESTINATION'},
  ]).replaceAll("'","''");
}
const deals=[
  {key:DEAL_A1,id:DEAL_A1_ID,client:CLIENT_A_KEY,contract:CONTRACT_A_KEY,doc:'40000000-0000-4000-8000-000000000001',wagon:'90000001',o:'111111',on:'Origin A1',olat:54.1,olng:27.1,d:'111112',dn:'Station A1',dlat:53.1,dlng:28.1},
  {key:DEAL_A2,id:DEAL_A2_ID,client:CLIENT_A_KEY,contract:CONTRACT_A_KEY,doc:'40000000-0000-4000-8000-000000000002',wagon:'90000002',o:'222221',on:'Origin A2',olat:55.1,olng:29.1,d:'222222',dn:'Station A2',dlat:54.1,dlng:30.1},
  {key:DEAL_B1,id:DEAL_B1_ID,client:CLIENT_B_KEY,contract:CONTRACT_B_KEY,doc:'40000000-0000-4000-8000-000000000003',wagon:'90000003',o:'333331',on:'Origin B1',olat:52.1,olng:31.1,d:'333332',dn:'Station B1',dlat:51.1,dlng:32.1},
  {key:DEAL_U1,id:DEAL_U1_ID,client:CLIENT_U_KEY,contract:CONTRACT_U_KEY,doc:'40000000-0000-4000-8000-000000000004',wagon:'90000004',o:'444441',on:'Origin U1',olat:50.1,olng:33.1,d:'444442',dn:'Station U1',dlat:49.1,dlng:34.1},
];

function seedSql(authUserId,adminAuthUserId){
  const geo=deals.flatMap(d=>[[d.o,d.on,d.olat,d.olng],[d.d,d.dn,d.dlat,d.dlng]]);
  return `
begin;
insert into portal_private.portal_users(id,auth_user_id,display_name) values
('${PORTAL_USER}'::uuid,'${q(authUserId)}'::uuid,'Issue 670 Client'),
('${ADMIN_PORTAL_USER}'::uuid,'${q(adminAuthUserId)}'::uuid,'Issue 670 Admin');
insert into portal_private.portal_user_roles(user_id,role,status) values
('${PORTAL_USER}'::uuid,'CLIENT','ACTIVE'),
('${ADMIN_PORTAL_USER}'::uuid,'ADMIN','ACTIVE');
insert into portal_private.clients(id,client_id,lifecycle_state,authority_state) values
('${CLIENT_A_KEY}'::uuid,'${CLIENT_A}','ACTIVE','CONFIRMED'),
('${CLIENT_B_KEY}'::uuid,'${CLIENT_B}','ACTIVE','CONFIRMED'),
('${CLIENT_U_KEY}'::uuid,'${CLIENT_U}','ACTIVE','CONFIRMED');
insert into portal_private.contracts(id,contract_id,client_key,contract_status,lifecycle_state,authority_state,signed_contract_confirmed_at,current_external_contract_number,effective_from) values
('${CONTRACT_A_KEY}'::uuid,'${CONTRACT_A}','${CLIENT_A_KEY}'::uuid,'ACTIVE','ACTIVE','CONFIRMED',now(),'EXT-QA-A',current_date-1),
('${CONTRACT_B_KEY}'::uuid,'${CONTRACT_B}','${CLIENT_B_KEY}'::uuid,'ACTIVE','ACTIVE','CONFIRMED',now(),'EXT-QA-B',current_date-1),
('${CONTRACT_U_KEY}'::uuid,'${CONTRACT_U}','${CLIENT_U_KEY}'::uuid,'ACTIVE','ACTIVE','CONFIRMED',now(),'EXT-QA-U',current_date-1);
insert into portal_private.client_user_bindings(id,user_id,client_key,contract_key,status,valid_from,lifecycle_state,authority_state,deal_scope_mode) values
('60000000-0000-4000-8000-000000000001'::uuid,'${PORTAL_USER}'::uuid,'${CLIENT_A_KEY}'::uuid,'${CONTRACT_A_KEY}'::uuid,'ACTIVE',now()-interval '1 day','ACTIVE','CONFIRMED','ALL_CONTRACT_DEALS'),
('60000000-0000-4000-8000-000000000002'::uuid,'${PORTAL_USER}'::uuid,'${CLIENT_B_KEY}'::uuid,'${CONTRACT_B_KEY}'::uuid,'ACTIVE',now()-interval '1 day','ACTIVE','CONFIRMED','ALL_CONTRACT_DEALS');
insert into portal_private.deals(id,deal_id,client_key,contract_key,business_status,lifecycle_state,authority_state) values
${deals.map(d=>`('${d.key}'::uuid,'${d.id}','${d.client}'::uuid,'${d.contract}'::uuid,'DEAL','ACTIVE','CONFIRMED')`).join(',\n')};
insert into portal_private.rail_station_geo_directory_v1(id,esr_code,canonical_station_name,latitude,longitude,authority_state,source_system,source_url,corroboration_refs) values
${geo.map(([code,name,lat,lng],i)=>`('50000000-0000-4000-8000-${String(i+1).padStart(12,'0')}'::uuid,'${code}','${name}',${lat},${lng},'CONFIRMED','ISSUE670_REAL_INTEGRATION','https://example.invalid/issue670','[]'::jsonb)`).join(',\n')};
insert into portal_private.rail_documents(id,deal_key,rail_document_id,gu12_number,document_number,document_date,route_text,source_system,source_version,source_timestamp,lifecycle_state) values
${deals.map(d=>`('${d.doc}'::uuid,'${d.key}'::uuid,'RAIL-${d.id}','GU12-${d.id}','DOC-${d.id}',current_date,'${d.o} -> ${d.d}','ISSUE670_REAL_INTEGRATION','v1',now(),'ACTIVE')`).join(',\n')};
insert into portal_private.rail_xlsx_dislocation_current_position_v1(effective_deal_key,wagon_number,current_rail_document_key,current_station_name,current_station_code,current_operation,current_event_at,current_event_at_local,current_raw_timestamp,current_source_timezone,current_source_timezone_status,current_source_time_domain,current_comparison_domain,position_status,comparison_domain_count,candidate_observation_count,effective_resolution_status,source_policy,source_contract_version,source_system_snapshot,source_object_type_snapshot,source_version_snapshot,source_object_id,source_received_at,resolution_authority_type,resolution_actor_ref,source_provenance) values
${deals.map(d=>`('${d.key}'::uuid,'${d.wagon}','${d.doc}'::uuid,'${d.dn}','${d.d}','ARRIVED',now(),now()::timestamp,'2026-09-19 12:30','UTC','RESOLVED','UTC','UTC','TRUSTED',1,1,'MATCHED','EXPEDITOR_XLSX_VIA_RAIL_AI','v1','ISSUE670_REAL_INTEGRATION','XLSX','v1','ROW-${d.id}',now(),'FIXTURE','ISSUE670','{}'::jsonb)`).join(',\n')};
insert into portal_private.rail_xlsx_dislocation_effective_v1(effective_deal_key,station_code,station_name,parsed_event_at,event_at_local,source_received_at,position_status,is_superseded) values
${deals.map(d=>`('${d.key}'::uuid,'${d.d}','${d.dn}',now(),now()::timestamp,now(),'TRUSTED',false)`).join(',\n')};
insert into portal_private.rail_deal_route_assignments_v1(deal_key,origin_esr_code,destination_esr_code,origin_authority,destination_authority,resolution_state,route_nodes,route_hop_count,route_source_refs,resolved_at,refreshed_at) values
${deals.map(d=>`('${d.key}'::uuid,'${d.o}','${d.d}','FIXTURE','FIXTURE','RESOLVED','${routeNodes(d)}'::jsonb,1,'[{"source":"ISSUE670_REAL_INTEGRATION"}]'::jsonb,now(),now())`).join(',\n')};
commit;`;
}

function newDealSql(){
  return `
begin;
insert into portal_private.deals(id,deal_id,client_key,contract_key,business_status,lifecycle_state,authority_state)
values ('${DEAL_A3}'::uuid,'${DEAL_A3_ID}','${CLIENT_A_KEY}'::uuid,'${CONTRACT_A_KEY}'::uuid,'DEAL','ACTIVE','CONFIRMED');
insert into portal_private.rail_station_geo_directory_v1(id,esr_code,canonical_station_name,latitude,longitude,authority_state,source_system,source_url) values
('50000000-0000-4000-8000-000000000009'::uuid,'555551','Origin A3',48.1,35.1,'CONFIRMED','ISSUE670_REAL_INTEGRATION','https://example.invalid/issue670'),
('50000000-0000-4000-8000-000000000010'::uuid,'555552','Station A3',47.1,36.1,'CONFIRMED','ISSUE670_REAL_INTEGRATION','https://example.invalid/issue670');
insert into portal_private.rail_documents(id,deal_key,rail_document_id,gu12_number,document_number,document_date,route_text,source_system,source_version,source_timestamp,lifecycle_state)
values ('40000000-0000-4000-8000-000000000005'::uuid,'${DEAL_A3}'::uuid,'RAIL-${DEAL_A3_ID}','GU12-${DEAL_A3_ID}','DOC-${DEAL_A3_ID}',current_date,'555551 -> 555552','ISSUE670_REAL_INTEGRATION','v1',now(),'ACTIVE');
insert into portal_private.rail_xlsx_dislocation_current_position_v1(effective_deal_key,wagon_number,current_rail_document_key,current_station_name,current_station_code,current_operation,current_event_at,current_event_at_local,current_raw_timestamp,current_source_timezone,current_source_timezone_status,current_source_time_domain,current_comparison_domain,position_status,comparison_domain_count,candidate_observation_count,effective_resolution_status,source_policy,source_contract_version,source_system_snapshot,source_object_type_snapshot,source_version_snapshot,source_object_id,source_received_at,resolution_authority_type,resolution_actor_ref,source_provenance)
values ('${DEAL_A3}'::uuid,'90000005','40000000-0000-4000-8000-000000000005'::uuid,'Station A3','555552','ARRIVED',now(),now()::timestamp,'2026-09-19 13:00','UTC','RESOLVED','UTC','UTC','TRUSTED',1,1,'MATCHED','EXPEDITOR_XLSX_VIA_RAIL_AI','v1','ISSUE670_REAL_INTEGRATION','XLSX','v1','ROW-${DEAL_A3_ID}',now(),'FIXTURE','ISSUE670','{}'::jsonb);
insert into portal_private.rail_xlsx_dislocation_effective_v1(effective_deal_key,station_code,station_name,parsed_event_at,event_at_local,source_received_at,position_status,is_superseded)
values ('${DEAL_A3}'::uuid,'555552','Station A3',now(),now()::timestamp,now(),'TRUSTED',false);
insert into portal_private.rail_deal_route_assignments_v1(deal_key,origin_esr_code,destination_esr_code,origin_authority,destination_authority,resolution_state,route_nodes,route_hop_count,route_source_refs,resolved_at,refreshed_at)
values ('${DEAL_A3}'::uuid,'555551','555552','FIXTURE','FIXTURE','RESOLVED','[{"sequence":1,"stationCode":"555551","station":"Origin A3","lat":48.1,"lng":35.1,"waypointRole":"ORIGIN"},{"sequence":2,"stationCode":"555552","station":"Station A3","lat":47.1,"lng":36.1,"waypointRole":"DESTINATION"}]'::jsonb,1,'[{"source":"ISSUE670_REAL_INTEGRATION"}]'::jsonb,now(),now());
commit;`;
}

async function waitForEdge(accessToken){
  let last='';
  for(let i=0;i<80;i++){
    try{
      const r=await fetch(edgeUrl+'/v1/client/rail-canonical?clientId='+encodeURIComponent(CLIENT_A)+'&contractId='+encodeURIComponent(CONTRACT_A),{headers:{authorization:'Bearer '+accessToken,accept:'application/json'}});
      if([200,404,503].includes(r.status))return;
      last='HTTP '+r.status;
    }catch(error){last=String(error?.message||error)}
    await sleep(250);
  }
  throw new Error('EDGE_NOT_READY '+last);
}
async function edgeGet(accessToken,clientId,contractId,extra=''){
  return jsonFetch(edgeUrl+'/v1/client/rail-canonical?clientId='+encodeURIComponent(clientId)+'&contractId='+encodeURIComponent(contractId)+extra,{
    headers:{authorization:'Bearer '+accessToken,accept:'application/json'}
  });
}

const auth=await createAuthenticatedUser(EMAIL,PASSWORD);
const adminAuth=await createAuthenticatedUser(ADMIN_EMAIL,ADMIN_PASSWORD);
execSql(seedSql(auth.authUserId,adminAuth.authUserId));
await waitForEdge(auth.accessToken);

assert(execSql("select has_function_privilege('authenticated','portal_private.rona_rail_deal_map_read_model_core_v1(uuid,text)','EXECUTE');")==='f','CORE_EXECUTE_NOT_REVOKED_FROM_AUTHENTICATED');

let own=await edgeGet(auth.accessToken,CLIENT_A,CONTRACT_A);
assert(own.response.status===200,'AUTHORIZED_CONTEXT_NOT_200 '+own.response.status+' '+JSON.stringify(own.body));
assert(own.body?.ok===true,'AUTHORIZED_CONTEXT_NOT_OK');
assert(own.body?.data?.railReadModel?.modelVersion==='RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4','CANONICAL_MODEL_VERSION_MISMATCH');
assert(own.body?.data?.railReadModel?.sourcePolicy==='PUBLIC_SOURCE_ROUTE_GRAPH_PLUS_TRUSTED_DISLOCATION_HISTORY_V1','CANONICAL_SOURCE_POLICY_MISMATCH');
assert(Array.isArray(own.body?.data?.deals)&&own.body.data.deals.length===2,'AUTHORIZED_DEAL_DISCOVERY_MISMATCH');
assert(!JSON.stringify(own.body).includes(DEAL_U1_ID),'UNAUTHORIZED_DEAL_LEAKED');

const dealTamper=await edgeGet(auth.accessToken,CLIENT_A,CONTRACT_A,'&dealId='+encodeURIComponent(DEAL_U1_ID));
assert(dealTamper.response.status===200&&!JSON.stringify(dealTamper.body).includes(DEAL_U1_ID),'DEAL_QUERY_TAMPER_LEAK');

const foreign=await edgeGet(auth.accessToken,CLIENT_U,CONTRACT_U);
assert(foreign.response.status===404&&foreign.body?.code==='CONTEXT_NOT_FOUND','FOREIGN_CONTEXT_NOT_FAIL_CLOSED');

const adminRpc=await jsonFetch(apiUrl+'/rest/v1/rpc/rona_admin_rail_deal_map_read_model_v4',{
  method:'POST',headers:{apikey:anonKey,authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},
  body:JSON.stringify({p_deal_id:DEAL_A1_ID})
});
assert(!adminRpc.response.ok,'CLIENT_EXECUTED_ADMIN_V4');

const adminAllowed=await jsonFetch(apiUrl+'/rest/v1/rpc/rona_admin_rail_deal_map_read_model_v4',{
  method:'POST',headers:{apikey:anonKey,authorization:'Bearer '+adminAuth.accessToken,'content-type':'application/json'},
  body:JSON.stringify({p_deal_id:DEAL_A1_ID})
});
assert(adminAllowed.response.ok,'ADMIN_V4_REJECTED_REAL_ADMIN '+adminAllowed.response.status+' '+JSON.stringify(adminAllowed.body));
assert(adminAllowed.body?.modelVersion==='RONA_ADMIN_RAIL_DEAL_MAP_READ_MODEL_V4','ADMIN_V4_MODEL_VERSION_CHANGED');
assert(Array.isArray(adminAllowed.body?.deals)&&adminAllowed.body.deals.length===1&&adminAllowed.body.deals[0]?.dealId===DEAL_A1_ID,'ADMIN_V4_SCOPE_CHANGED');

const coreRpc=await jsonFetch(apiUrl+'/rest/v1/rpc/rona_rail_deal_map_read_model_core_v1',{
  method:'POST',headers:{apikey:anonKey,authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},
  body:JSON.stringify({p_deal_key:DEAL_A1,p_deal_id:DEAL_A1_ID})
});
assert(!coreRpc.response.ok,'CLIENT_EXECUTED_INTERNAL_CORE');

execSql(newDealSql());
own=await edgeGet(auth.accessToken,CLIENT_A,CONTRACT_A);
assert(own.response.status===200&&own.body?.data?.deals?.some(d=>d.deal_id===DEAL_A3_ID),'NEW_ACTIVE_DEAL_NOT_AUTO_DISCOVERED');

const adapterResponse=await clientRailRequest({});
assert(adapterResponse.status===200,'CLIENT_RAIL_ADAPTER_SOURCE_FAILED');
const clientRailScript=await adapterResponse.text();

let proxyRequests=0, degraded=false;
const html=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#07131f;color:#fff;font-family:Arial,sans-serif}#page-monitoring{padding:12px}.rona-owner-page-content{width:100%}</style><script>
window.__qaCtx={client_id:'${CLIENT_A}',contract_id:'${CONTRACT_A}'};
window.__qaSubscriber=null;
window.RONA_CLIENT_CONTEXT={getCurrentContext(){return window.__qaCtx},async whenReady(){return window.__qaCtx},subscribe(fn){window.__qaSubscriber=fn;return()=>{}}};
window.__qaSetContext=function(next){window.__qaCtx=next;if(window.__qaSubscriber)window.__qaSubscriber(next)};
</script></head><body><section id="page-monitoring" class="active"><div class="rona-owner-page-content"></div></section><script src="/portal/client-rail-current-ui.js"></script></body></html>`;

function send(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(body)}
const proxy=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1');
  if(u.pathname==='/portal/client')return send(res,200,html,'text/html; charset=utf-8');
  if(u.pathname==='/portal/client-rail-current-ui.js')return send(res,200,clientRailScript,'application/javascript; charset=utf-8');
  if(u.pathname==='/portal/api/v1/client/rail-canonical'){
    proxyRequests++;
    const rr=await fetch(edgeUrl+'/v1/client/rail-canonical'+u.search,{headers:{authorization:'Bearer '+auth.accessToken,accept:'application/json'}});
    return send(res,rr.status,await rr.text(),rr.headers.get('content-type')||'application/json; charset=utf-8');
  }
  if(u.pathname==='/qa/state')return send(res,200,JSON.stringify({proxyRequests,degraded}),'application/json');
  if(u.pathname==='/qa/degrade'){
    if(!degraded){
      execSql(`update portal_private.rail_deal_route_assignments_v1 set route_nodes='[{"sequence":"BROKEN","stationCode":"333331","lat":52.1,"lng":31.1}]'::jsonb where deal_key='${DEAL_B1}'::uuid;`);
      degraded=true;
    }
    return send(res,200,JSON.stringify({ok:true,degraded}),'application/json');
  }
  if(u.pathname.startsWith('/portal/map-assets/osm/'))return send(res,204,'','image/png');
  return send(res,404,'not found');
});
await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(0,'127.0.0.1',resolve)});
const origin='http://127.0.0.1:'+proxy.address().port;

const evidence={authenticated:true,sessionId:auth.sessionId,authorizedHttp200:true,adminV4ClientDenied:true,adminV4AdminAllowed:true,internalCoreClientDenied:true,crossClientFailClosed:true,dealQueryTamperFailClosed:true,autoDealDiscovery:true,hardReloadReady:false,dealSwitchIsolation:false,idleNoPolling:false,eventDrivenRefresh:false,contextSwitchClears:false,degradedHttp503:false,degradedRefreshPreservesLastGood:false,tariffMatrixAbsent:false};
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(m.text())});

  await page.goto(origin+'/portal/client',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey&&document.querySelector('.rona-rail-v6-select'),{timeout:12000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey&&document.querySelector('.rona-rail-v6-select'),{timeout:12000});
  evidence.hardReloadReady=true;

  const options=await page.locator('.rona-rail-v6-select option').evaluateAll(xs=>xs.map(x=>({value:x.value,text:x.textContent})));
  assert(options.length===3&&options.some(x=>x.value===DEAL_A1)&&options.some(x=>x.value===DEAL_A2)&&options.some(x=>x.value===DEAL_A3),'REAL_SERVER_DEAL_SELECTOR '+JSON.stringify(options));
  assert(!options.some(x=>x.value===DEAL_U1),'UNAUTHORIZED_DEAL_IN_SELECTOR');

  await page.locator('.rona-rail-v6-select').selectOption(DEAL_A2);
  await page.waitForFunction(key=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey===key,DEAL_A2);
  let view=await page.evaluate(()=>({text:document.querySelector('#page-monitoring')?.textContent||'',authority:{...window.__RONA_CLIENT_RAIL_AUTHORITY_STATE__}}));
  assert(view.text.includes('GU12-'+DEAL_A2_ID)&&view.text.includes('90000002'),'REAL_DEAL_A2_CONTENT_MISSING');
  assert(!view.text.includes('GU12-'+DEAL_A1_ID)&&!view.text.includes(DEAL_U1_ID),'REAL_DEAL_SWITCH_INHERITANCE');
  evidence.dealSwitchIsolation=true;
  evidence.tariffMatrixAbsent=!view.text.includes('Матрица ЖД-тарифов');
  assert(evidence.tariffMatrixAbsent,'TARIFF_MATRIX_RETURNED');

  const beforeIdle=(await fetch(origin+'/qa/state').then(r=>r.json())).proxyRequests;
  await sleep(650);
  const afterIdle=(await fetch(origin+'/qa/state').then(r=>r.json())).proxyRequests;
  assert(afterIdle===beforeIdle,'REAL_IDLE_CLIENT_RAIL_POLLED_WITHOUT_CHANGE');
  evidence.idleNoPolling=true;

  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('rona:client-rail-invalidated')));
  let afterInvalidation=afterIdle;
  for(let attempt=0;attempt<30&&afterInvalidation===afterIdle;attempt++){
    await sleep(50);
    afterInvalidation=(await fetch(origin+'/qa/state').then(r=>r.json())).proxyRequests;
  }
  assert(afterInvalidation===afterIdle+1,'REAL_EVENT_DRIVEN_REFRESH_NOT_EXACTLY_ONCE');
  evidence.eventDrivenRefresh=true;

  await page.evaluate(({clientId,contractId})=>window.__qaSetContext({client_id:clientId,contract_id:contractId}),{clientId:CLIENT_U,contractId:CONTRACT_U});
  await sleep(500);
  view=await page.evaluate(()=>({text:document.querySelector('#page-monitoring')?.textContent||'',selected:window.__RONA_RAIL_SELECTED_DEAL_KEY__,context:window.__RONA_CLIENT_RAIL_CONTEXT_KEY__}));
  assert(view.context===CLIENT_U+'|'+CONTRACT_U&&view.selected===null,'UNAUTHORIZED_CONTEXT_NOT_CLEARED');
  assert(!view.text.includes(DEAL_A2_ID)&&!view.text.includes('90000002'),'UNAUTHORIZED_CONTEXT_RETAINED_OLD_RAIL');
  evidence.contextSwitchClears=true;

  await page.evaluate(({clientId,contractId})=>window.__qaSetContext({client_id:clientId,contract_id:contractId}),{clientId:CLIENT_B,contractId:CONTRACT_B});
  await page.waitForFunction(key=>window.__RONA_RAIL_CURRENT_STATE__?.selectedDealKey===key,DEAL_B1,{timeout:8000});
  view=await page.evaluate(()=>({text:document.querySelector('#page-monitoring')?.textContent||'',context:window.__RONA_CLIENT_RAIL_CONTEXT_KEY__}));
  assert(view.context===CLIENT_B+'|'+CONTRACT_B&&view.text.includes(DEAL_B1_ID)&&view.text.includes('90000003'),'AUTHORIZED_CONTEXT_B_NOT_LOADED');
  assert(!view.text.includes(DEAL_A1_ID)&&!view.text.includes(DEAL_A2_ID),'CONTEXT_B_INHERITED_CONTEXT_A');

  await page.evaluate(()=>window.__RONA_CLIENT_RAIL_REFRESH__());
  await sleep(250);
  const beforeDegraded=await page.locator('#page-monitoring').textContent();
  await fetch(origin+'/qa/degrade');
  const degradedResponse=await edgeGet(auth.accessToken,CLIENT_B,CONTRACT_B);
  assert(degradedResponse.response.status===503&&degradedResponse.body?.code==='CLIENT_RAIL_CANONICAL_READ_MODEL_UNAVAILABLE','DEGRADED_BACKEND_NOT_503');
  evidence.degradedHttp503=true;

  await page.evaluate(()=>window.__RONA_CLIENT_RAIL_REFRESH__());
  await sleep(450);
  const afterDegraded=await page.locator('#page-monitoring').textContent();
  assert(afterDegraded===beforeDegraded&&afterDegraded.includes(DEAL_B1_ID),'DEGRADED_REFRESH_DID_NOT_PRESERVE_LAST_GOOD');
  evidence.degradedRefreshPreservesLastGood=true;

  assert(errors.length===0,'BROWSER_ERRORS '+errors.join(' | '));
}finally{
  if(browser)await browser.close().catch(()=>{});
  await new Promise(resolve=>proxy.close(resolve));
}
writeFileSync('/tmp/issue670-real-integration-summary.json',JSON.stringify(evidence,null,2));
for(const [key,value] of Object.entries(evidence))console.log('ISSUE670_REAL_'+key.toUpperCase()+'='+String(value).toUpperCase());
console.log('ISSUE670_REAL_INTEGRATION=PASS');
