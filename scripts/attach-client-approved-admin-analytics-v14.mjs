import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {onRequest as approvedAdminBase} from '../functions/portal/analytics-v2-approved-base.js';
import {canonicalNativeAnalyticsV432} from '../functions/portal/analytics-v2-ui.js';
import {LPG_GAP_RUNTIME} from '../functions/portal/lpg-observation-gap-runtime-v13.js';

const ROOT='dist/portal/client.html';
const ASSET='dist/assets/portal-runtime/client-approved-admin-analytics-v14.js';
const INTEGRITY='dist/canonical-visual-integrity.json';
const CLIENT_ASSET_URL='/assets/portal-runtime/client-approved-admin-analytics-v14.js?v=20261010-exact-admin-native-v432';
const BOOT_ID='rona-client-exact-approved-admin-analytics-v14';
const sha=x=>createHash('sha256').update(x).digest('hex');
const response=await approvedAdminBase({});
if(!response.ok)throw Error('ADMIN_APPROVED_NATIVE_SOURCE_NOT_FOUND');
const raw=await response.text();
const approved=canonicalNativeAnalyticsV432(raw);
const materializedAdmin=await readFile('dist/portal/analytics-v2-ui','utf8');
if(!materializedAdmin.startsWith(approved)||
   !approved.includes("version:'approved-v4.3.2-pricing-bridge-single-owner'")||
   !approved.includes('RONA TRADE · ANALYTICS')||
   !approved.includes('window.RONA_ANALYTICS_VIEW='))throw Error('APPROVED_NATIVE_ADMIN_CLIENT_CODE_MISMATCH');
let html=await readFile(ROOT,'utf8');
const inline=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const legacyChart=inline.filter(x=>x[2].includes("const ns='http://www.w3.org/2000/svg'")&&
  x[2].includes("rona-market-chart"));
const legacyView=inline.filter(x=>x[2].includes('window.RONA_ANALYTICS_VIEW=')&&
  x[2].includes("function showSeries("));
if(legacyChart.length!==1||legacyView.length!==1||
   sha(legacyChart[0][2])!=='5c2c15d4f2b9919a4daaa1882c342a2c7944b1fb3b5e6d89c1fe6bed3b309c89'||
   sha(legacyView[0][2])!=='3d4d402c71749c01004874c8681294e430ca0415a7ab3cd060c3dffa6a190c59')
  throw Error('CLIENT_LEGACY_ANALYTICS_CODE_LOCK_FAILED');
if(!html.includes('id="page-analytics"')||!html.includes('id="rona-analytics-v2"')||
   !html.includes('</body>')||html.includes(BOOT_ID))
  throw Error('CLIENT_SINGLE_ADMIN_UI_REPLACEMENT_CONTRACT_FAILED');
html=html.replace(legacyChart[0][0],'').replace(legacyView[0][0],'');
const prelude=[
";(()=>{",
"'use strict';",
"if(location.pathname!=='/portal/client')return;",
"const parent=document.querySelector('#page-analytics');",
"if(!parent)throw Error('CLIENT_APPROVED_ANALYTICS_PAGE_ABSENT');",
"const original=parent.querySelector(':scope > #rona-analytics-v2');",
"if(!original)throw Error('CLIENT_FROZEN_NATIVE_ANALYTICS_ROOT_ABSENT');",
"original.remove();",
"document.documentElement.dataset.ronaClientAnalyticsUi='ADMIN_NATIVE_V432';",
"})();"
].join('\n')+'\n';
const postlude=[
";(()=>{",
"if(location.pathname!=='/portal/client')return;",
"const root=document.querySelector('#page-analytics > #rona-analytics-v2');",
"if(!root||root.dataset.analyticsOwner!=='approved-v431'||",
"   typeof window.RONA_ANALYTICS_VIEW?.setPayload!=='function')",
"  throw Error('CLIENT_ADMIN_APPROVED_NATIVE_RENDER_FAILED');",
"root.dataset.ronaExactAdminVisual='approved-v4.3.2';",
"document.documentElement.dataset.ronaClientAnalyticsNative='EXACT_ADMIN_APPROVED_V432';",
"})();"
].join('\n')+'\n';
const js=prelude+approved+'\n'+LPG_GAP_RUNTIME+postlude;
await mkdir(dirname(ASSET),{recursive:true});
await writeFile(ASSET,js,'utf8');
const tag='<script id="'+BOOT_ID+'" src="'+CLIENT_ASSET_URL+'" defer></script>';
html=html.replace('</body>',tag+'</body>');
await writeFile(ROOT,html,'utf8');
const manifest=JSON.parse(await readFile(INTEGRITY,'utf8'));
manifest.client_runtime.emitted_sha256=sha(Buffer.from(html,'utf8'));
manifest.client_runtime.emitted_bytes=Buffer.byteLength(html);
manifest.client_runtime.analytics_approved_admin_native={
  owner:'ADMIN_ANALYTICS_V432_SINGLE_NATIVE_SOURCE',
  admin_module:'/portal/analytics-v2-ui',
  client_module:CLIENT_ASSET_URL,
  approved_native_sha256:sha(approved),
  client_asset_sha256:sha(js),
  exact_admin_renderer:true,
  identical_admin_lpg_gap_runtime:true,
  original_legacy_chart_removed:true,
  original_legacy_view_removed:true,
  business_sources:'ROLE_SCOPED_CLIENT_PUBLISHED_ONLY',
  admin_internal_prices_exposed:false
};
await writeFile(INTEGRITY,JSON.stringify(manifest),'utf8');
if((html.match(/window\.RONA_ANALYTICS_VIEW=/g)||[]).length>0||
  (html.match(/id="rona-client-exact-approved-admin-analytics-v14"/g)||[]).length!==1)
  throw Error('CLIENT_COMPETING_ANALYTICS_VIEW_OR_MISSING_ADMIN_ASSET');
console.log('CLIENT_EXACT_ADMIN_NATIVE_V432=PASS native_sha256='+sha(approved)+
  ' client_asset_sha256='+sha(js)+' client_frozen_source_removed=2 admin_script_prefix_exact=true');
