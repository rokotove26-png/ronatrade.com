
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const fileSha=bytes=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\\0'.replace('\\0','\0')),bytes])).digest('hex');
const here=new URL('.',import.meta.url);
const expected=Object.freeze({
 'qa-client-owner-retest-real-browser-v4.mjs':'c22b6a6fcd284bc5c48ae4d4d870f7f2e78309b3',
 'qa-client-owner-retest-authoritative-company-metrics-v5.mjs':'4e7ffaf5018893d6159413d9aa57c8c4d45e28e4',
 'materialize-portal-client-applications-canonical-v1.mjs':'bc4b380931fd2d13d36e09d3111030b25a04da24'
});
for(const [path,sha] of Object.entries(expected)){
 const bytes=await readFile(new URL('./'+path,here));
 const actual=fileSha(bytes);
 if(actual!==sha)throw new Error('QA_V6_PROTECTED_SOURCE_SHA_MISMATCH '+path+' expected='+sha+' actual='+actual);
}
const generatorPath=new URL('./qa-client-owner-retest-authoritative-company-metrics-v5.mjs',here);
const generatorText=await readFile(generatorPath,'utf8');
const anchor="const generatedPath=fileURLToPath(generatedUrl);";
const adapter="const qaRawAnchor=\"const RAW={A:raw('A'),B:raw('B')};\";\nconst qaV6Fixture=\"\\nconst QA_V6_CONTRACT='RONA_APPLICATION_BUSINESS_V2';\\nfor(const qaName of ['A','B']){\\n  const qa=RAW[qaName],owner=FIX[qaName];\\n  if(!qa||!owner||!Array.isArray(qa.applications))throw new Error('QA_V6_FIXTURE_SCOPE_MISSING');\\n  qa.applications=qa.applications.map((row)=>{\\n    const bucket=['CANCELLED','CLOSED','REJECTED','DEAL_REGISTERED','ARCHIVED'].includes(upper(row.status))?'COMPLETED':upper(row.status)==='UNDER_REVIEW'?'WORK':'NEW';\\n    return {...row,business_contract:QA_V6_CONTRACT,record_kind:'CLIENT_APPLICATION',client_id:owner.client_id,client_name:owner.legal,legal_name:owner.legal,contract_id:owner.contract_id,lifecycle_state:row.status,business_bucket:bucket,application_price:Number(row.proposed_price),application_currency:row.proposed_currency,price_is_agreed:false,price_is_owner_agreed:false};\\n  });\\n  const rows=qa.applications,byBucket=v=>rows.filter(x=>x.business_bucket===v).length;\\n  qa.application_business_contract=QA_V6_CONTRACT;\\n  qa.application_kpi={source:QA_V6_CONTRACT,total:rows.length,active:rows.length-byBucket('COMPLETED'),new:byBucket('NEW'),in_work:byBucket('WORK'),decision:byBucket('DECISION'),completed:byBucket('COMPLETED'),deal_registered:rows.filter(x=>upper(x.status)==='DEAL_REGISTERED').length,tonnage:rows.reduce((total,x)=>total+Number(x.quantity_tonnes),0),amounts:null};\\n  for(const row of rows)if(!/^.+-IN-[0-9]{4}-[0-9]{3,}$/.test(row.application_id)||row.client_id!==owner.client_id||row.contract_id!==owner.contract_id)throw new Error('QA_V6_FIXTURE_TENANT_SCOPE');\\n}\\n\";\nif(source.split(qaRawAnchor).length!==2)throw new Error('QA_V6_RAW_SOURCE_LOCK_MISMATCH');\nsource=source.replace(qaRawAnchor,qaRawAnchor+'\\n'+qaV6Fixture);\nconst qaRouteAnchor=\"else if(u.pathname.startsWith('/portal/api/v1/client/'))b={ok:true,data:{}};\";\nconst qaV6Routes=\"\\nelse if(u.pathname==='/portal/api/v1/client/deal-state'){\\n const scope=FIX[name]?.client_id===c&&FIX[name]?.contract_id===k;\\n const deal=scope?r.deals.find(d=>d.deal_id===norm(u.searchParams.get('dealId'))):null;\\n const from=deal?commercialSource(name,deal.deal_id):null;\\n b=!deal||!from?{ok:false,code:'QA_V6_DEAL_SCOPE_DENIED'}:{ok:true,data:{\\n  source:'RONA_CLIENT_DEAL_STATE_V1',\\n  generated_at:'2099-01-02T00:00:00Z',\\n  context:{client_id:f.client_id,contract_id:f.contract_id,legal_name:f.legal,current_external_contract_number:f.external},\\n  deal:{deal_id:deal.deal_id,product:name==='A'?'СУГ / СПБТ':'PRODUCT-'+name,\\n   quantity_tonnes:from.quantity_tonnes,unit_price:from.proposed_price,amount:from.obligation_amount,currency:from.currency,\\n   delivery_basis:'CPT',destination:'DEST-'+name},\\n  facts:{resource:{status:'RESOURCE_CONFIRMED',label:'Подтверждение ресурса',source:'CLIENT_DEAL_STATE_V1'}},\\n  realization_status:{source:'CLIENT_DEAL_STATE_V1',current_stage_key:'resource',stages:stages()},\\n  next_step:'Подтверждение ресурса'\\n }};\\n}\\nelse if(/^\\\\/portal\\\\/api\\\\/v1\\\\/client\\\\/applications\\\\/[^/]+\\\\/passport$/.test(u.pathname)){\\n const scope=FIX[name]?.client_id===c&&FIX[name]?.contract_id===k;\\n const applicationId=decodeURIComponent(u.pathname.split('/').at(-2)||'');\\n const application=scope?r.applications.find(a=>a.application_id===applicationId):null;\\n b=!application?{ok:false,code:'QA_V6_APPLICATION_SCOPE_DENIED'}:{ok:true,data:{business_contract:'RONA_APPLICATION_BUSINESS_V2',application}};\\n}\\n\";\nif(source.split(qaRouteAnchor).length!==2)throw new Error('QA_V6_API_SOURCE_LOCK_MISMATCH');\nsource=source.replace(qaRouteAnchor,qaV6Routes+'\\n'+qaRouteAnchor);\nconst qaIdMap=[[\"APP-B-1\",\"CLIENT-B-IN-2099-001\"],[\"APP-B-2\",\"CLIENT-B-IN-2099-002\"],[\"APP-B-3\",\"CLIENT-B-IN-2099-003\"]];\nfor(const [oldId,newId] of qaIdMap){if(!source.includes(oldId))throw new Error('QA_V6_ID_SOURCE_MISSING:'+oldId);source=source.split(oldId).join(newId)}\nfor(const required of ['RONA_APPLICATION_BUSINESS_V2','QA_V6_DEAL_SCOPE_DENIED','QA_V6_APPLICATION_SCOPE_DENIED','CLIENT-B-IN-2099-001','BUG2_APPLICATION_OPEN_REFRESH_ROW_SURVIVES_PROOF'])if(!source.includes(required))throw new Error('QA_V6_REQUIRED_MARKER_MISSING:'+required);\nconsole.log('QA_V6_CANONICAL_BUSINESS_FIXTURE=READY protected_v4_v5=UNCHANGED production_source=UNCHANGED');";
if(generatorText.split(anchor).length!==2)throw new Error('QA_V6_GENERATOR_SOURCE_LOCK');
let runner=generatorText.replace(anchor,adapter+'\n'+anchor);
const oldGenerated="const generatedUrl=new URL('./.qa-client-owner-retest-real-browser-v5.generated.mjs',import.meta.url);";
const newGenerated="const generatedUrl=new URL('./.qa-client-owner-retest-real-browser-v6.generated.mjs',import.meta.url);";
if(runner.split(oldGenerated).length!==2)throw new Error('QA_V6_GENERATED_FILE_SOURCE_LOCK');
runner=runner.replace(oldGenerated,newGenerated);
const runnerUrl=new URL('./.qa-client-owner-retest-fixture-v6.wrapper.mjs',here);
try{
 await writeFile(runnerUrl,runner,'utf8');
 const syntax=spawnSync(process.execPath,['--check',fileURLToPath(runnerUrl)],{cwd:process.cwd(),stdio:'inherit'});
 if(syntax.error)throw syntax.error;
 if(syntax.status!==0)throw new Error('QA_V6_GENERATOR_SYNTAX_FAILED');
 console.log('QA_V6_PROTECTED_SOURCE_LOCK=PASS');
 const result=spawnSync(process.execPath,[fileURLToPath(runnerUrl)],{cwd:process.cwd(),env:process.env,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.signal)throw new Error('QA_V6_BROWSER_ABORTED '+result.signal);
 if(result.status!==0)throw new Error('QA_V6_BROWSER_ASSERTIONS_FAIL code='+result.status);
 console.log('QA_V6_CANONICAL_BROWSER_E2E=PASS');
}finally{await unlink(runnerUrl).catch(()=>{})}
