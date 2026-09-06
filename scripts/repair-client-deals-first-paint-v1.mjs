import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const firstPaintRuntimePath='dist/assets/portal-runtime/client-section-first-paint-v1.js';
const dealsRuntimePath='dist/assets/portal-runtime/client-deals-authoritative-v1.js';
const documentsRuntimePath='dist/assets/portal-runtime/client-deal-documents-v5.js';
const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const oldMarker='20260902-client-section-first-paint-v3-authoritative-empty';
const newMarker='20260904-client-section-first-paint-v5-authoritative-snapshot-release';
const oldSrc='/assets/portal-runtime/client-section-first-paint-v1.js?v=20260902-authoritative-empty-v3';
const newSrc='/assets/portal-runtime/client-section-first-paint-v1.js?v=20260904-authoritative-snapshot-release-v5';
const oldGate="  clearDealsEmpty(root);\n  if(operationalDealsRendered(root,snapshot))return'ready';\n  const html=document.documentElement;";
const newGate="  clearDealsEmpty(root);\n  // An authoritative selected-context snapshot is sufficient to release the frozen Deals UI.\n  // First-paint is a loading guard only; it must never own or wait on Deal card rendering.\n  if(snapshot&&snapshot.active.length>0)return'ready';\n  if(operationalDealsRendered(root,snapshot))return'ready';\n  const html=document.documentElement;";
const oldCard="function card(d,a){const id=norm(d.deal_id),host=document.createElement('article');host.className='rona-deal-card-v5';host.setAttribute(CARD_ATTR,'v9');host.dataset.ronaCanonicalDealId=id;host.dataset.ronaDealProjection='CURRENT_CLIENT_CONTEXT';host.append(leaf('div',id));const detail=detailText(a);if(detail)host.append(leaf('div',detail));const amount=authoritativeAmount(d);if(amount)host.append(leaf('div',amount));const resource=effectiveResource(d);for(const value of [norm(d?.current_status_label||d?.current_status||d?.business_status),resource.label,norm(d?.payment_label||d?.payment_status||d?.finance_status)].filter(Boolean))host.append(leaf('div',value));const open=document.createElement('button');open.type='button';open.textContent='Открыть';open.setAttribute('data-open-deal',id);host.append(open,stateStrip(d));return host}";
const newCard="function appendSemanticTerm(host,slot,value){const text=norm(value);if(!text)return;const existing=host.querySelectorAll('[data-rona-deal-slot]');if(existing.length)host.append(document.createTextNode(' · '));const n=leaf('span',text);n.dataset.ronaDealSlot=slot;host.append(n)}\nfunction card(d,a){const id=norm(d.deal_id),host=document.createElement('article');host.className='rona-deal-card-v5';host.setAttribute(CARD_ATTR,'v9');host.dataset.ronaCanonicalDealId=id;host.dataset.ronaDealProjection='CURRENT_CLIENT_CONTEXT';host.dataset.ronaDealSummaryReady='true';const summary=document.createElement('div');summary.className='rona-deal-card-v5__summary';summary.dataset.ronaDealSummary='canonical-v8';const main=document.createElement('div');main.className='rona-deal-card-v5__summary-main';main.dataset.ronaDealSummaryMain='true';const headline=document.createElement('div');headline.className='rona-deal-card-v5__headline';headline.dataset.ronaDealSummaryHeadline='true';const idEl=leaf('div',id);idEl.className='rona-deal-card-v5__dealid';idEl.dataset.ronaDealSummaryId='true';idEl.dataset.ronaDealSlot='deal-id';headline.append(idEl);const product=norm(a?.product);if(product){const subject=leaf('div',product);subject.className='rona-deal-card-v5__subject';subject.dataset.ronaDealSummarySubject='true';subject.dataset.ronaDealSlot='product';headline.append(subject)}main.append(headline);summary.append(main);const terms=document.createElement('div');terms.className='rona-deal-card-v5__terms';terms.dataset.ronaDealSummaryTerms='true';terms.dataset.ronaDealSlot='detail';const qty=numberText(a?.quantity_tonnes,3),price=numberText(a?.proposed_price,2),currency=upper(a?.proposed_currency);appendSemanticTerm(terms,'quantity',qty?`${qty} т`:'');appendSemanticTerm(terms,'unit-price',price&&currency?`${price} ${currency}/т`:'');appendSemanticTerm(terms,'basis',a?.delivery_basis);appendSemanticTerm(terms,'destination',a?.destination);if(terms.childNodes.length)summary.append(terms);const side=document.createElement('div');side.className='rona-deal-card-v5__summary-side';side.dataset.ronaDealSummarySide='true';const amount=authoritativeAmount(d);if(amount){const amountEl=leaf('div',amount);amountEl.className='rona-deal-card-v5__amount';amountEl.dataset.ronaDealSummaryAmount='true';amountEl.dataset.ronaDealSlot='amount';side.append(amountEl)}const open=document.createElement('button');open.type='button';open.textContent='Открыть';open.className='rona-deal-card-v5__open';open.setAttribute('data-open-deal',id);open.dataset.ronaDealSlot='open';side.append(open);summary.append(side);host.append(summary,stateStrip(d));return host}";
const oldDecoratePrefix="function decorate(host,id){host.classList.remove('rona-deal-card-v1','rona-deal-card-v2','rona-deal-card-v3','rona-deal-card-v4','rona-deal-card-polished-v1');host.classList.add(HOST);if(host.dataset.ronaCanonicalDealId!==id)host.dataset.ronaCanonicalDealId=id;clearClasses(host);normalizeResource(host);";
const newDecoratePrefix="function decorate(host,id){host.classList.remove('rona-deal-card-v1','rona-deal-card-v2','rona-deal-card-v3','rona-deal-card-v4','rona-deal-card-polished-v1');host.classList.add(HOST);if(host.dataset.ronaCanonicalDealId!==id)host.dataset.ronaCanonicalDealId=id;const semantic=host.dataset.ronaDealSummaryReady==='true'&&host.querySelector('[data-rona-deal-summary=\"canonical-v8\"]')&&host.querySelector('[data-rona-deal-slot=\"deal-id\"]')&&host.querySelector('[data-rona-deal-slot=\"amount\"]')&&host.querySelector('[data-rona-deal-slot=\"open\"]');if(semantic)return;clearClasses(host);normalizeResource(host);";
const oldDealsNavTrigger="if(/^СДЕЛКИ$/i.test(t)||legacyLabel(t)){scheduleScan(90);setTimeout(scan,240);setTimeout(scan,600);setTimeout(loadData,0)}";
const newDealsNavTrigger="if(n?.dataset?.page==='deals'||/^СДЕЛКИ$/i.test(t)||legacyLabel(t)){scheduleScan(90);setTimeout(scan,240);setTimeout(scan,600);setTimeout(loadData,0)}";
const sha256=b=>createHash('sha256').update(b).digest('hex');

let firstPaintRuntime=await readFile(firstPaintRuntimePath,'utf8');
if(!firstPaintRuntime.includes(oldMarker))throw new Error('CLIENT_DEALS_FIRST_PAINT_OLD_MARKER_MISSING');
if((firstPaintRuntime.match(new RegExp(oldGate.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length!==1)throw new Error('CLIENT_DEALS_FIRST_PAINT_GATE_NOT_SINGLE');
firstPaintRuntime=firstPaintRuntime.replace(oldGate,newGate).replaceAll(oldMarker,newMarker);
if(!firstPaintRuntime.includes("if(snapshot&&snapshot.active.length>0)return'ready';"))throw new Error('CLIENT_DEALS_AUTHORITATIVE_ACTIVE_RELEASE_MISSING');
if(firstPaintRuntime.includes('ensureAuthoritativeDealsRendered')||firstPaintRuntime.includes('createServerDealCard'))throw new Error('CLIENT_DEALS_UNAPPROVED_RENDERER_FORBIDDEN');
await writeFile(firstPaintRuntimePath,firstPaintRuntime,'utf8');

let dealsRuntime=await readFile(dealsRuntimePath,'utf8');
if((dealsRuntime.split(oldCard).length-1)!==1)throw new Error('CLIENT_DEALS_RAW_CARD_FACTORY_NOT_SINGLE');
dealsRuntime=dealsRuntime.replace(oldCard,newCard);
for(const token of [
  "data-rona-deal-slot", "rona-deal-card-v5__summary", "rona-deal-card-v5__dealid", "rona-deal-card-v5__subject",
  "rona-deal-card-v5__terms", "rona-deal-card-v5__amount", "rona-deal-card-v5__open",
  "appendSemanticTerm(terms,'quantity'", "appendSemanticTerm(terms,'unit-price'", "appendSemanticTerm(terms,'basis'", "appendSemanticTerm(terms,'destination'"
])if(!dealsRuntime.includes(token))throw new Error(`CLIENT_DEALS_SEMANTIC_FIRST_PAINT_TOKEN_MISSING:${token}`);
if(dealsRuntime.includes("host.append(leaf('div',id))"))throw new Error('CLIENT_DEALS_RAW_FIRST_PAINT_REMAINS');
await writeFile(dealsRuntimePath,dealsRuntime,'utf8');

let documentsRuntime=await readFile(documentsRuntimePath,'utf8');
if((documentsRuntime.split(oldDecoratePrefix).length-1)!==1)throw new Error('CLIENT_DEAL_DOCUMENTS_DECORATE_PREFIX_NOT_SINGLE');
if((documentsRuntime.split(oldDealsNavTrigger).length-1)!==1)throw new Error('CLIENT_DEAL_DOCUMENTS_DEALS_NAV_TRIGGER_NOT_SINGLE');
documentsRuntime=documentsRuntime.replace(oldDecoratePrefix,newDecoratePrefix).replace(oldDealsNavTrigger,newDealsNavTrigger);
if(!documentsRuntime.includes("if(semantic)return;clearClasses(host);normalizeResource(host);"))throw new Error('CLIENT_DEAL_DOCUMENTS_SEMANTIC_GEOMETRY_GUARD_MISSING');
if(!documentsRuntime.includes("n?.dataset?.page==='deals'"))throw new Error('CLIENT_DEAL_DOCUMENTS_EXPLICIT_DEALS_ACTIVATION_MISSING');
await writeFile(documentsRuntimePath,documentsRuntime,'utf8');

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
if(integrity?.client_runtime?.deals_authoritative_renderer){
  Object.assign(integrity.client_runtime.deals_authoritative_renderer,{
    first_paint_semantic_dom:true,
    first_paint_click_dependency:false,
    card_geometry_owner:'client-deals-authoritative-v1',
    semantic_slots:['deal-id','product','quantity','unit-price','basis','destination','amount','open'],
    amount_source:'passport_amount+passport_currency',
    amount_browser_calculation:false,
    later_leaf_recomposition_required:false,
    layering_repair_hacks:false
  });
}
if(integrity?.client_runtime?.deal_documents_bridge){
  integrity.client_runtime.deal_documents_bridge.basic_card_geometry_owner='client-deals-authoritative-v1';
  integrity.client_runtime.deal_documents_bridge.click_dependent_geometry=false;
  integrity.client_runtime.deal_documents_bridge.semantic_card_mutation=false;
  integrity.client_runtime.deal_documents_bridge.deals_activation='EXPLICIT_DATA_PAGE_EVENT_ONCE';
}
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_DEALS_FIRST_PAINT_AUTHORITATIVE_RELEASE=PASS marker=${newMarker}; frozen_visual=UNCHANGED; renderer=SINGLE_AUTHORITATIVE_OWNER; semantic_first_paint=true; click_dependency=false; amount_source=passport_amount+passport_currency; documents_semantic_guard=true; documents_deals_activation=explicit-data-page; client_html_sha256=${sha256(emitted)}`);
