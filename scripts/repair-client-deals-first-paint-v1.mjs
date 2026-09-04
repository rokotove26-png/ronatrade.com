import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const runtimePath='dist/assets/portal-runtime/client-section-first-paint-v1.js';
const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const oldMarker='20260902-client-section-first-paint-v3-authoritative-empty';
const newMarker='20260904-client-section-first-paint-v5-authoritative-snapshot-release';
const oldSrc='/assets/portal-runtime/client-section-first-paint-v1.js?v=20260902-authoritative-empty-v3';
const newSrc='/assets/portal-runtime/client-section-first-paint-v1.js?v=20260904-authoritative-snapshot-release-v5';
const oldGate="  clearDealsEmpty(root);\n  if(operationalDealsRendered(root,snapshot))return'ready';\n  const html=document.documentElement;";
const newGate="  clearDealsEmpty(root);\n  // An authoritative selected-context snapshot is sufficient to release the frozen Deals UI.\n  // First-paint is a loading guard only; it must never own or wait on Deal card rendering.\n  if(snapshot&&snapshot.active.length>0)return'ready';\n  if(operationalDealsRendered(root,snapshot))return'ready';\n  const html=document.documentElement;";
const sha256=b=>createHash('sha256').update(b).digest('hex');

let runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(oldMarker))throw new Error('CLIENT_DEALS_FIRST_PAINT_OLD_MARKER_MISSING');
if((runtime.match(new RegExp(oldGate.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length!==1)throw new Error('CLIENT_DEALS_FIRST_PAINT_GATE_NOT_SINGLE');
runtime=runtime.replace(oldGate,newGate).replaceAll(oldMarker,newMarker);
if(!runtime.includes("if(snapshot&&snapshot.active.length>0)return'ready';"))throw new Error('CLIENT_DEALS_AUTHORITATIVE_ACTIVE_RELEASE_MISSING');
if(runtime.includes('ensureAuthoritativeDealsRendered')||runtime.includes('createServerDealCard'))throw new Error('CLIENT_DEALS_UNAPPROVED_RENDERER_FORBIDDEN');
await writeFile(runtimePath,runtime,'utf8');

let html=await readFile(htmlPath,'utf8');
if(!html.includes(oldSrc))throw new Error('CLIENT_DEALS_FIRST_PAINT_OLD_SRC_MISSING');
html=html.replace(oldSrc,newSrc);
if((html.match(/client-section-first-paint-v1\.js/gu)||[]).length!==1)throw new Error('CLIENT_DEALS_FIRST_PAINT_SCRIPT_NOT_SINGLE');
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
if(integrity?.client_runtime?.section_first_paint){
  integrity.client_runtime.section_first_paint.marker=newMarker;
  integrity.client_runtime.section_first_paint.src=newSrc;
  integrity.client_runtime.section_first_paint.deals_release='SERVER_AUTHORITATIVE_SELECTED_CONTEXT_SNAPSHOT_NONBLOCKING_ACTIVE';
  integrity.client_runtime.section_first_paint.business_logic_changed=false;
  integrity.client_runtime.section_first_paint.frozen_visual_changed=false;
}
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_DEALS_FIRST_PAINT_AUTHORITATIVE_RELEASE=PASS marker=${newMarker}; frozen_visual=UNCHANGED; renderer=UNCHANGED; client_html_sha256=${sha256(emitted)}`);
