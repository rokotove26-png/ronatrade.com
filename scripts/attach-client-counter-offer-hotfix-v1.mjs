import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const htmlPath='dist/portal/client.html';
const sourcePath='assets/portal-runtime/client-counter-offer-hotfix-v1.js';
const runtimePath='dist/assets/portal-runtime/client-counter-offer-hotfix-v1.js';
const integrityPath='dist/canonical-visual-integrity.json';
const id='rona-client-counter-offer-hotfix-v1';
const marker='20260910-client-counter-offer-hotfix-v1';
const sha256=value=>createHash('sha256').update(value).digest('hex');

const runtime=await readFile(sourcePath,'utf8');
for(const required of [marker,'counter_offer_active','counter_price','counter_currency','client_counter_response','Принять','Отклонить','/portal/owner-api?path=','/counter-offer/','invalidateCurrentProjection','rona:client-application-submitted'])if(!runtime.includes(required))throw new Error(`CLIENT_COUNTER_OFFER_RUNTIME_REQUIRED_MISSING: ${required}`);
if(/RONA-C\d{3}|APP-\d{4}-\d{3,}/.test(runtime))throw new Error('CLIENT_COUNTER_OFFER_RECORD_HARDCODING_FORBIDDEN');
await mkdir('dist/assets/portal-runtime',{recursive:true});
await writeFile(runtimePath,runtime,'utf8');
let html=await readFile(htmlPath,'utf8');
if(!html.includes('portal-client-applications-canonical-v1.js'))throw new Error('CLIENT_COUNTER_OFFER_CANONICAL_APPLICATIONS_OWNER_MISSING');
if(html.includes(id)||html.includes('client-counter-offer-hotfix-v1.js'))throw new Error('CLIENT_COUNTER_OFFER_RUNTIME_ALREADY_ATTACHED');
const digest=sha256(Buffer.from(runtime,'utf8')).slice(0,16),src=`/assets/portal-runtime/client-counter-offer-hotfix-v1.js?v=${digest}`;
const close=html.toLowerCase().lastIndexOf('</body>');if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
html=html.slice(0,close)+`<script id="${id}" src="${src}" defer></script>`+html.slice(close);
await writeFile(htmlPath,html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8')),emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.counter_offer_hotfix={id,src,marker,owner:'CANONICAL_CLIENT_APPLICATIONS_COMPANION',source:'CURRENT_AUTHORIZED_CLIENT_CONTEXT',response_backend:'EXISTING_OWNER_ACCEPTANCE_COUNTER_OFFER_ROUTES',actions:['accept','decline'],hardcoded_records:false,global_styles_changed:false};
await writeFile(integrityPath,JSON.stringify(integrity,null,2)+'\n','utf8');
console.log(`CLIENT_COUNTER_OFFER_RUNTIME=PASS marker=${marker} canonical-owner=true response-routes=existing`);
