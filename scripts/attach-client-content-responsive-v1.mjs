import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const cssPath='dist/assets/portal-runtime/client-content-responsive-v1.css';
const id='rona-client-content-responsive-v1';
const href='/assets/portal-runtime/client-content-responsive-v1.css?v=20260830-content-width-aware-v1';
const marker='20260830-content-width-aware-v1';
const sha256=value=>createHash('sha256').update(value).digest('hex');

const css=await readFile(cssPath,'utf8');
if(!css.includes(marker))throw new Error(`CLIENT_CONTENT_RESPONSIVE_MARKER_MISSING: ${marker}`);
for(const required of [
  'container-type: inline-size',
  'container-name: rona-client-home',
  'container-name: rona-client-deals',
  'container-name: rona-client-payments',
  'container-name: rona-client-rail',
  '@container rona-client-home (max-width: 1220px)',
  '@container rona-client-deals (max-width: 1100px)',
  '@container rona-client-payments (max-width: 900px)',
  '@container rona-client-rail (max-width: 1100px)',
  'min-width: 0 !important',
  'max-width: 100% !important'
]){
  if(!css.includes(required))throw new Error(`CLIENT_CONTENT_RESPONSIVE_CONTRACT_MISSING: ${required}`);
}
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(css))throw new Error('CLIENT_CONTENT_RESPONSIVE_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
if(/price|payment_obligation|resource_status|finance_status|accounting_status/iu.test(css))throw new Error('CLIENT_CONTENT_RESPONSIVE_BUSINESS_LOGIC_TOKEN_FORBIDDEN');

let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${id}"`)||html.includes('client-content-responsive-v1.css'))throw new Error('CLIENT_CONTENT_RESPONSIVE_ALREADY_PRESENT');
const headClose=html.toLowerCase().lastIndexOf('</head>');
if(headClose<0)throw new Error('CLIENT_HEAD_CLOSE_MISSING');
const link=`<link id="${id}" rel="stylesheet" href="${href}">`;
html=html.slice(0,headClose)+link+html.slice(headClose);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.content_responsive={
  id,
  href,
  marker,
  route:'/portal/client',
  mode:'CONTENT_WIDTH_CONTAINER_QUERIES',
  layout_basis:'ACTUAL_PAGE_PANE_AFTER_SIDEBAR',
  viewport_only_breakpoints:false,
  shell_min_width_relaxed:true,
  modules:['HOME','DEALS','PAYMENTS','ONLINE_RAIL'],
  business_logic_changed:false,
  hardcoded_business_entities:false
};
await writeFile(integrityPath,JSON.stringify(integrity),'utf8');

if(!html.includes(`id="${id}"`)||!html.includes(href))throw new Error('CLIENT_CONTENT_RESPONSIVE_LINK_MISSING_AFTER_WRITE');
if((html.match(/client-content-responsive-v1\.css/g)||[]).length!==1)throw new Error('CLIENT_CONTENT_RESPONSIVE_LINK_NOT_SINGLE_OWNER');
console.log('CLIENT_CONTENT_RESPONSIVE_V1=PASS content-width container queries attached.');
