import {readFile,writeFile} from 'node:fs/promises';

const path='functions/portal/owner-api.js';
let source=await readFile(path,'utf8');
const marker='PR462_PREVIEW_FINANCE_AUTHORITY';
if(source.includes(marker)){
  console.log('PR462_PREVIEW_FINANCE_ROUTE_ALREADY_APPLIED=PASS');
  process.exit(0);
}
const fromConst="const AI_SYNC_UPSTREAM=`${SUPABASE_URL}/functions/v1/rona-owner-ai-sync`;";
const toConst=fromConst+"\nconst PREVIEW_AI_SYNC_UPSTREAM=`${SUPABASE_URL}/functions/v1/rona-admin-source-eval-candidate-20260817`;\nfunction isPagesPreview(requestUrl){try{return new URL(requestUrl).hostname.endsWith('.rona-trade-public.pages.dev')}catch{return false}}";
const fromRoute="function upstreamFor(path){if(path==='/admin/ai-sync')return`${AI_SYNC_UPSTREAM}/admin/sync`;if(path==='/agent/ai-sync')return`${AI_SYNC_UPSTREAM}/agent/sync`;return`${UPSTREAM}${path}`}";
const toRoute="function upstreamFor(path,requestUrl){if(path==='/admin/ai-sync')return`${isPagesPreview(requestUrl)?PREVIEW_AI_SYNC_UPSTREAM:AI_SYNC_UPSTREAM}/admin/sync`;if(path==='/agent/ai-sync')return`${AI_SYNC_UPSTREAM}/agent/sync`;return`${UPSTREAM}${path}`}";
const fromFetch="return fetch(upstreamFor(path),init)";
const toFetch="return fetch(upstreamFor(path,request.url),init)";
const fromHeaders="const outHeaders=headers(response.headers);for(const c of setCookies)outHeaders.append('set-cookie',c);";
const toHeaders="const outHeaders=headers(response.headers);if(path==='/admin/ai-sync')outHeaders.set('x-rona-owner-ai-sync-backend',isPagesPreview(request.url)?'PR462_PREVIEW_FINANCE_AUTHORITY':'PRODUCTION_SHARED');for(const c of setCookies)outHeaders.append('set-cookie',c);";
for(const [needle,label] of [[fromConst,'CONST'],[fromRoute,'ROUTE'],[fromFetch,'FETCH'],[fromHeaders,'HEADERS']])if(!source.includes(needle))throw new Error(`PR462_PREVIEW_FINANCE_PATCH_${label}_SOURCE_MISMATCH`);
source=source.replace(fromConst,toConst).replace(fromRoute,toRoute).replace(fromFetch,toFetch).replace(fromHeaders,toHeaders);
if(!source.includes(marker))throw new Error('PR462_PREVIEW_FINANCE_MARKER_MISSING');
await writeFile(path,source,'utf8');
console.log('PR462_PREVIEW_FINANCE_ROUTE_APPLIED=PASS');
