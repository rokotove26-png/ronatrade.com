import baseOwnerPaymentsV6Runtime from './owner-payments-accounting-currency-progress-v6-runtime.js';

const renderGuardFrom="function renderFinance(f){injectCss();if(!f||f.ownerPaymentSemanticsContract!==CONTRACT||S(f?.ownerFinanceCanon?.record_id)!==CANON){";
const renderGuardTo="function financeAuthorityOk(f){return !!f&&f.ownerPaymentSemanticsContract===CONTRACT&&S(f?.ownerFinanceCanon?.record_id)===CANON&&U(f?.ownerFinanceCanon?.status)==='AUTHORITATIVE'&&Number(f?.ownerFinanceCanon?.version)===23}function renderFinance(f){injectCss();if(!financeAuthorityOk(f)){";
const loadGuardFrom="if(!r.ok||!j?.ok||f?.ownerPaymentSemanticsContract!==CONTRACT||S(f?.ownerFinanceCanon?.record_id)!==CANON)throw new Error(j?.code||'OWNER_PAYMENTS_V6_SOURCE_INVALID');";
const loadGuardTo="if(!r.ok||!j?.ok||!financeAuthorityOk(f))throw new Error(j?.code||'OWNER_PAYMENTS_V6_SOURCE_INVALID');";
const helperAnchor="const state={finance:null,loading:null,lastLoadedAt:0,search:''};";
const helperRuntime=String.raw`
function e(tag,attrs={},...kids){const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='text')el.textContent=String(v??'');else if(k==='class')el.className=String(v||'');else if(k==='style'&&v&&typeof v==='object')Object.assign(el.style,v);else if(k.startsWith('on')&&typeof v==='function')el.addEventListener(k.slice(2),v);else if(v!==undefined&&v!==null&&v!==false)el.setAttribute(k,v===true?'':String(v))}for(const kid of kids.flat(Infinity)){if(kid===null||kid===undefined||kid===false)continue;el.append(kid?.nodeType?kid:document.createTextNode(String(kid)))}return el}
function card(title,body){const box=e('section',{class:'rona-owner-card'},e('h3',{text:title}));if(body!==null&&body!==undefined)box.append(body?.nodeType?body:document.createTextNode(String(body)));return box}
function tbl(heads,rows){const table=e('table',{class:'rona-owner-table'}),thead=e('thead'),hr=e('tr');for(const h of heads)hr.append(e('th',{text:h}));thead.append(hr);table.append(thead);const tbody=e('tbody');for(const row of rows){const tr=e('tr');for(const value of row){const td=e('td');if(value!==null&&value!==undefined)td.append(value?.nodeType?value:document.createTextNode(String(value)));tr.append(td)}tbody.append(tr)}table.append(tbody);return table}
function money(value,currency){const n=Number(value);if(!Number.isFinite(n))return'—';const text=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);return currency?text+' '+String(currency):text}
function financePill(text,kind='neutral'){return e('span',{class:'rona-fin-pill rona-fin-pill-'+String(kind),text})}
function financeKpiCard(title,_kind,rows){return card(title,e('div',{class:'kpi-value',text:A(rows).length?A(rows).map(x=>money(x.amount,x.currency)).join(' / '):'—'}))}
function replacePage(id,node){const host=document.getElementById('page-'+String(id))||document.getElementById(String(id));if(!host)throw new Error('OWNER_PAYMENTS_V6_PAGE_HOST_MISSING_'+String(id));host.replaceChildren(node)}
function isolatePaymentsPage(){const host=document.getElementById('page-payments');if(host)host.setAttribute('data-rona-owner-payments-v6','active')}
function date(value){const s=String(value||'');if(!s)return'—';const d=new Date(s);return Number.isNaN(d.getTime())?s:new Intl.DateTimeFormat('ru-RU',{year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function notify(message,title=''){let host=document.getElementById('rona-pay-v6-notice');if(!host){host=e('div',{id:'rona-pay-v6-notice',role:'status','aria-live':'polite',style:{position:'fixed',right:'16px',bottom:'16px',zIndex:'2147483000',maxWidth:'420px',padding:'10px 12px',borderRadius:'10px',background:'rgba(15,23,42,.96)',border:'1px solid rgba(148,163,184,.3)'}});document.body.append(host)}host.textContent=(title?String(title)+': ':'')+String(message||'');clearTimeout(host.__ronaTimer);host.__ronaTimer=setTimeout(()=>host.remove(),2600)}
`;

if(!baseOwnerPaymentsV6Runtime.includes(renderGuardFrom))throw new Error('OWNER_PAYMENTS_V6_RENDER_GUARD_SOURCE_DRIFT');
if(!baseOwnerPaymentsV6Runtime.includes(loadGuardFrom))throw new Error('OWNER_PAYMENTS_V6_LOAD_GUARD_SOURCE_DRIFT');
if(!baseOwnerPaymentsV6Runtime.includes(helperAnchor))throw new Error('OWNER_PAYMENTS_V6_HELPER_ANCHOR_SOURCE_DRIFT');

const ownerPaymentsV6AuthorityRuntime=baseOwnerPaymentsV6Runtime
  .replace(helperAnchor,helperAnchor+helperRuntime)
  .replace(renderGuardFrom,renderGuardTo)
  .replace(loadGuardFrom,loadGuardTo);

if(!ownerPaymentsV6AuthorityRuntime.includes("U(f?.ownerFinanceCanon?.status)==='AUTHORITATIVE'"))throw new Error('OWNER_PAYMENTS_V6_STATUS_GUARD_MISSING');
if(!ownerPaymentsV6AuthorityRuntime.includes('Number(f?.ownerFinanceCanon?.version)===23'))throw new Error('OWNER_PAYMENTS_V6_VERSION_GUARD_MISSING');
if(!ownerPaymentsV6AuthorityRuntime.includes('!financeAuthorityOk(f)'))throw new Error('OWNER_PAYMENTS_V6_ACTIVE_GUARD_MISSING');
if(!ownerPaymentsV6AuthorityRuntime.includes("function replacePage(id,node)"))throw new Error('OWNER_PAYMENTS_V6_SELF_CONTAINED_HELPERS_MISSING');

export default ownerPaymentsV6AuthorityRuntime;
