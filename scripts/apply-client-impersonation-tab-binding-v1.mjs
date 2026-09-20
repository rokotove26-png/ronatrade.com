import { readFile, writeFile } from 'node:fs/promises';

const runtimePath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const MARK='RONA_CLIENT_IMPERSONATION_TAB_BINDING_V1';
const target="const nativeFetch=window.fetch.bind(window);";

let source=await readFile(runtimePath,'utf8');
if(source.includes(MARK)){
  console.log('CLIENT_IMPERSONATION_TAB_BINDING=ALREADY_APPLIED');
  process.exit(0);
}
if(!source.includes(target))throw new Error('CLIENT_IMPERSONATION_NATIVE_FETCH_TARGET_MISSING');
if(source.indexOf(target)!==source.lastIndexOf(target))throw new Error('CLIENT_IMPERSONATION_NATIVE_FETCH_TARGET_NOT_UNIQUE');

const replacement=`const ${MARK}='${MARK}';
const RONA_IMPERSONATION_TAB_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ronaImpersonationTab=(()=>{try{const value=String(new URLSearchParams(location.search).get('impSession')||'').trim();return RONA_IMPERSONATION_TAB_UUID.test(value)?value:''}catch{return''}})();
const ronaBaseNativeFetch=window.fetch.bind(window);
function ronaBindImpersonationTab(input,init){
  if(!ronaImpersonationTab)return{input,init};
  try{
    const raw=typeof input==='string'?input:(input instanceof URL?input.href:(input&&input.url)||'');
    const url=new URL(raw,location.href);
    if(url.origin!==location.origin||!url.pathname.startsWith('/portal/api/'))return{input,init};
    const headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));
    headers.set('x-rona-impersonation-tab',ronaImpersonationTab);
    if(input instanceof Request)return{input:new Request(input,{...(init||{}),headers}),init:undefined};
    return{input,init:{...(init||{}),headers}};
  }catch{return{input,init}}
}
const nativeFetch=(input,init)=>{const bound=ronaBindImpersonationTab(input,init);return ronaBaseNativeFetch(bound.input,bound.init)};`;

source=source.replace(target,replacement);

for(const required of [
  MARK,
  "new URLSearchParams(location.search).get('impSession')",
  "headers.set('x-rona-impersonation-tab',ronaImpersonationTab)",
  "url.pathname.startsWith('/portal/api/')",
  'RONA_IMPERSONATION_TAB_UUID',
  'const nativeFetch=(input,init)=>'
])if(!source.includes(required))throw new Error('CLIENT_IMPERSONATION_TAB_BINDING_REQUIRED_TOKEN_MISSING:'+required);

if(/RONA-C\d{3}|DEAL-2026-\d{3}|FARG(?:[‘'ʼ])?ONA|PRODUCTION PETROL/iu.test(replacement)){
  throw new Error('CLIENT_IMPERSONATION_TAB_BINDING_BUSINESS_HARDCODE_FORBIDDEN');
}
new Function(source);
await writeFile(runtimePath,source,'utf8');
console.log('CLIENT_IMPERSONATION_TAB_BINDING=PASS marker='+MARK+' mode=QUERY_BOUND_UUID header=x-rona-impersonation-tab scope=SAME_ORIGIN_PORTAL_API');
