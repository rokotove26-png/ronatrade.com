// Deterministic source integration in the existing release build, never a record-specific patch.
// Bounded unique hunks preserve every unrelated source byte. Repeated builds are idempotent.
import fs from 'node:fs';
export function prepareApplicationConsumers(){
 for(const file of edits){
  let source=fs.readFileSync(file.path,'utf8');
  for(const edit of file.edits){
   if(source.includes(edit.after)){
    if(source.split(edit.after).length!==2||source.replace(edit.after,'').includes(edit.before))throw new Error('APPLICATION_BUILD_MIXED_SOURCE:'+file.path);
    continue;
   }
   if(source.split(edit.before).length!==2)throw new Error('APPLICATION_BUILD_SOURCE_MISMATCH:'+file.path);
   source=source.replace(edit.before,edit.after);
  }
  fs.writeFileSync(file.path,source);
 }
}
const edits=[
  {
    "path": "functions/portal/main-ui/index.js",
    "edits": [
      {
        "before": "import { onRequest as serveCurrentAdminUi } from '../admin-main-ui-cur",
        "after": "import {patchApplicationBusinessRuntime} from './application-business-runtime-v2.js';\nimport { onRequest as serveCurrentAdminUi } from '../admin-main-ui-cur"
      },
      {
        "before": ",ADMIN_BOOTSTRAP_TO)+applicationPassportRuntime;\n  const patched=patchPaymentsV7Runtime(patchedBase);\n  const headers=new Headers(response.headers);\n  headers.set('conte",
        "after": ",ADMIN_BOOTSTRAP_TO)+applicationPassportRuntime;\n  const patched=patchApplicationBusinessRuntime(patchPaymentsV7Runtime(patchedBase));\n  const headers=new Headers(response.headers);\n  headers.set('conte"
      }
    ]
  },
  {
    "path": "functions/portal/api/[[path]].js",
    "edits": [
      {
        "before": "const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';\nconst S",
        "after": "import { validateApplicationProjection, projectionFromData } from '../application-business-contract-v2.js';\nconst SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';\nconst S"
      },
      {
        "before": "ageObjectId??null;return out}\nfunction safeClientApplication(a){return{application_id:a?.application_id??null,product:a?.product??null,quantity_tonnes:a?.quantity_tonnes?",
        "after": "ageObjectId??null;return out}\nfunction safeClientApplication(a){return {application_id:a?.application_id??null,business_contract:a?.business_contract??null,record_kind:a?.record_kind??null,client_id:a?.client_id??null,client_name:a?.client_name??null,legal_name:a?.legal_name??null,contract_id:a?.contract_id??null,product:a?.product??null,quantity_tonnes:a?.quantity_tonnes?"
      },
      {
        "before": "destination:a?.destination??null,payment_terms:a?.payment_terms??null,price_mode:a?.price_mode??null,proposed_price:a?.proposed_price??null,proposed_currency:a?.proposed_currency??null,application_price:a?.application_price??null,application_currency:a?.application_currency??null,resource_status:a?.resource_status??null,resource_label:a?.reso",
        "after": "destination:a?.destination??null,payment_terms:a?.payment_terms??null,application_price:a?.application_price??null,application_currency:a?.application_currency??null,price_is_agreed:a?.price_is_agreed??null,price_is_owner_agreed:a?.price_is_owner_agreed??null,price_source:a?.price_source??null,price_unit:a?.price_unit??null,counter_offer_active:a?.counter_offer_active??null,counter_price:a?.counter_price??null,counter_currency:a?.counter_currency??null,client_counter_response:a?.client_counter_response??null,supplier_approved_at:a?.supplier_approved_at??null,resource_status:a?.resource_status??null,resource_label:a?.reso"
      },
      {
        "before": "ce_confirmed_at:a?.resource_confirmed_at??null,status:a?.status??null,deal_id:a?.deal_id??null,submitted_at:a?.submitted_at??null,updated_at:a?.updated_at??null}}\nfunction safeCompanyMetrics(m){if(!m||typeof m!=='object')ret",
        "after": "ce_confirmed_at:a?.resource_confirmed_at??null,status:a?.status??null,owner_status:a?.owner_status??null,business_bucket:a?.business_bucket??null,lifecycle_state:a?.lifecycle_state??null,deal_id:a?.deal_id??null,submitted_at:a?.submitted_at??null,updated_at:a?.updated_at??null,intake_id:a?.intake_id??null,durable_id:a?.durable_id??null,source_id:a?.source_id??null}}\nfunction safeCompanyMetrics(m){if(!m||typeof m!=='object')ret"
      },
      {
        "before": "MED_CURRENT',verification_source:'AUTHORITATIVE_CONTRACT_ACCESS_GATE'};out.applications=(Array.isArray(data?.applications)?data.applications",
        "after": "MED_CURRENT',verification_source:'AUTHORITATIVE_CONTRACT_ACCESS_GATE'};validateApplicationProjection(projectionFromData(data));out.application_business_contract=data.application_business_contract;out.application_kpi=data.application_kpi;out.applications=(Array.isArray(data?.applications)?data.applications"
      },
      {
        "before": "safeClientBootstrap(payload.data);else if(path==='/v1/client/context')payload.data=safeClientContext(payload.data);else if(path==='/v1/agent/bootstrap')payload.data=safeAgentBootstrap(p",
        "after": "safeClientBootstrap(payload.data);else if(path==='/v1/client/context'){try{payload.data=safeClientContext(payload.data)}catch{return json({ok:false,code:'APPLICATION_CANONICAL_PROJECTION_REQUIRED'},503)}}else if(path==='/v1/agent/bootstrap')payload.data=safeAgentBootstrap(p"
      },
      {
        "before": "election.base}${path}${query}`;\n    return fetch(target,init);\n  };\n  let response=await forward(access);\n  if(response.status===401&&refres",
        "after": "election.base}${path}${query}`;\n    return fetch(target,init);\n  };\n  if(request.method==='POST'&&(path==='/v1/client/applications'||path==='/v1/events')){\n    const candidate=await request.clone().json().catch(()=>null);\n    const requiresAtomic=path==='/v1/client/applications'||candidate?.payload?.message_type==='DELIVERED_PRICE_CALCULATION_REQUEST_V1';\n    if(requiresAtomic){\n      const readCapability=token=>fetch(`${selection.base}/v1/client/applications/capabilities`,{headers:{authorization:`Bearer ${token}`,accept:'application/json'}});\n      let capability=await readCapability(access);\n      if(capability.status===401&&refresh){const next=await authRefresh(refresh);if(next.ok&&next.data?.access_token&&next.data?.refresh_token){access=next.data.access_token;refresh=next.data.refresh_token;setCookies=tokenCookies(next.data);capability=await readCapability(access)}}\n      const contract=await capability.json().catch(()=>null);\n      if(!capability.ok||contract?.business_contract!=='RONA_APPLICATION_BUSINESS_V2'||contract?.atomic_submit!==true)return json({ok:false,code:'ATOMIC_APPLICATION_BACKEND_NOT_READY'},503,setCookies);\n    }\n  }\n  let response=await forward(access);\n  if(response.status===401&&refres"
      }
    ]
  },
  {
    "path": "scripts/materialize-portal-client-applications-canonical-v1.mjs",
    "edits": [
      {
        "before": "import { readFile, writeFile } from 'node:fs/promises';\nimport { creat",
        "after": "import {wireClientBusinessRuntime} from './application-business-v2/client-runtime.mjs';\nimport { readFile, writeFile } from 'node:fs/promises';\nimport { creat"
      },
      {
        "before": "w Error(`CLIENT_COUNTER_OFFER_CANONICAL_EMIT_MISSING: ${required}`);\n\nawait writeFile(runtimePath,runtime,'utf8');\nlet html=await readFile(h",
        "after": "w Error(`CLIENT_COUNTER_OFFER_CANONICAL_EMIT_MISSING: ${required}`);\n\nruntime=wireClientBusinessRuntime(runtime,await readFile('functions/portal/application-business-contract-v2.js','utf8'));\nawait writeFile(runtimePath,runtime,'utf8');\nlet html=await readFile(h"
      }
    ]
  },
  {
    "path": "scripts/qa-pr431-system-admin-one-shot-v1.mjs",
    "edits": [
      {
        "before": "import { readFile } from 'node:fs/promises';\nimport vm from 'node:vm';",
        "after": "import {validateApplicationProjection,projectionFromData} from '../functions/portal/application-business-contract-v2.js';\nimport { readFile } from 'node:fs/promises';\nimport vm from 'node:vm';"
      },
      {
        "before": "_MISSING');\n\nconst sandbox={URL,Headers,Response,Blob,FormData,console};vm.createContext(sandbox);\nconst executable=text.proxy.replace('export async function onRequest','async function onRequest')",
        "after": "_MISSING');\n\nconst sandbox={URL,Headers,Response,Blob,FormData,console,validateApplicationProjection,projectionFromData};vm.createContext(sandbox);\nconst executable=text.proxy.replace(/^import .*application-business-contract-v2.*;\\n/m,'').replace('export async function onRequest','async function onRequest')"
      }
    ]
  }

];
prepareApplicationConsumers();
