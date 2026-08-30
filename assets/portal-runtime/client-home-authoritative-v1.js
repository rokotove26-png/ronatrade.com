(()=>{'use strict';
const MARK='20260830-client-home-authoritative-v1';
if(window.__RONA_CLIENT_HOME_RUNTIME__===MARK)return;
window.__RONA_CLIENT_HOME_RUNTIME__=MARK;
if(location.pathname!=='/portal/client')return;

const API='/portal/api',REFRESH_MS=30000;
const OWNER='[data-rona-client-home-owner="authoritative-v1"]';
const TERMINAL_DEALS=new Set(['CLOSED','COMPLETED','DONE','CANCELLED']);
const TERMINAL_APPLICATIONS=new Set(['DEAL_REGISTERED','ARCHIVED','CANCELLED','REJECTED']);
const state={contexts:[],activeKey:'',detail:null,ctx:null,loading:false,lastLoad:0,timer:0,scheduled:false,observer:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const upper=v=>norm(v).toUpperCase();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const esc=v=>norm(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const visible=el=>{if(!el||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)!==0};

async function request(path){
  const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const b=await r.json().catch(()=>null);
  if(!r.ok||b?.ok===false)throw new Error(String(b?.code||b?.error?.code||('HTTP_'+r.status)));
  return b;
}
function homeRoot(){
  for(const selector of ['#page-home','#homePage','[data-page-panel="home"]','[data-page-id="home"]']){const el=document.querySelector(selector);if(el)return el}
  let best=null;
  for(const el of document.querySelectorAll('main section,main div,section')){
    const t=norm(el.textContent);if(!t.includes('Главная')||!t.includes('Выбрана компания'))continue;
    if(!best||t.length<norm(best.textContent).length)best=el;
  }
  return best;
}
function decorated(el){
  if(!el)return false;const s=getComputedStyle(el),bg=s.backgroundColor||'';
  const alpha=/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/i.exec(bg);
  const hasBg=bg&&bg!=='transparent'&&bg!=='rgba(0, 0, 0, 0)'&&(!alpha||Number(alpha[1])>0);
  return hasBg||parseFloat(s.borderTopWidth||'0')>0||parseFloat(s.borderLeftWidth||'0')>0||s.boxShadow!=='none'||parseFloat(s.borderRadius||'0')>0;
}
function frameFromText(root,needle){
  if(!root)return null;const rr=root.getBoundingClientRect();
  const leaves=[...root.querySelectorAll('*')].filter(el=>el.childElementCount===0&&norm(el.textContent).includes(needle));
  for(const leaf of leaves){
    let node=leaf;
    while(node&&node!==root){
      const r=node.getBoundingClientRect();
      if(r.width>=Math.min(460,rr.width*.48)&&r.width<=rr.width+2&&decorated(node))return node;
      node=node.parentElement;
    }
  }
  return null;
}
function titleFrame(root){return frameFromText(root,'Главная')}
function contextFrame(root){return frameFromText(root,'Выбрана компания')}
function directChild(root,node){let cur=node;if(!cur)return null;while(cur.parentElement&&cur.parentElement!==root)cur=cur.parentElement;return cur.parentElement===root?cur:null}
function contextText(root){
  const frame=contextFrame(root);
  const candidates=[document.querySelector('header'),document.querySelector('.topbar'),document.querySelector('[class*="topbar"]'),frame].filter(Boolean);
  return norm(candidates.filter(visible).map(x=>x.textContent).join(' '));
}
function contextKey(c){return norm(c?.client_id)+'|'+norm(c?.contract_id)}
function chooseContext(contexts,root){
  if(contexts.length===1)return contexts[0];
  const text=contextText(root);let best=null,score=0,ties=0;
  for(const ctx of contexts){
    let s=0;
    for(const token of [ctx?.current_external_contract_number,ctx?.legal_name,ctx?.contract_id,ctx?.client_id].map(norm).filter(Boolean))if(text.includes(token))s++;
    if(s>score){best=ctx;score=s;ties=1}else if(s>0&&s===score)ties++;
  }
  return score>0&&ties===1?best:null;
}
function setHomeState(mode){
  document.documentElement.setAttribute('data-rona-client-home-state',mode);
  if(mode==='ready')document.documentElement.setAttribute('data-rona-client-home-ready','true');
  else document.documentElement.removeAttribute('data-rona-client-home-ready');
}
function installStyle(){
  if(document.getElementById('rona-client-home-authoritative-v1-style'))return;
  const style=document.createElement('style');style.id='rona-client-home-authoritative-v1-style';
  style.textContent=`
    #page-home ${OWNER},#homePage ${OWNER},[data-page-panel="home"] ${OWNER},[data-page-id="home"] ${OWNER}{display:grid;gap:12px;box-sizing:border-box;color:#d9edf7;font-family:inherit}
    [data-rona-client-home-owner="authoritative-v1"] *{box-sizing:border-box}
    [data-rona-home-legacy-hidden="true"]{display:none!important}
    .rona-home-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .rona-home-kpi{min-height:88px;padding:13px 14px;border:1px solid rgba(92,159,194,.20);border-radius:12px;background:linear-gradient(180deg,rgba(7,27,42,.91),rgba(5,20,34,.86));box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
    .rona-home-kpi-label{display:block;margin-bottom:8px;color:#7fa8bb;font-size:9px;letter-spacing:.07em;text-transform:uppercase}
    .rona-home-kpi-value{display:block;color:#effbff;font-size:22px;line-height:1.08;font-weight:780}.rona-home-kpi-value[data-size="compact"]{font-size:15px;line-height:1.25}
    .rona-home-kpi-note{display:block;margin-top:7px;color:#8fb5c5;font-size:9.5px;line-height:1.35}
    .rona-home-kpi-lines{display:grid;gap:4px}.rona-home-kpi-line{display:flex;justify-content:space-between;gap:10px;color:#dceff6;font-size:10.5px}.rona-home-kpi-line b{color:#effbff}
    .rona-home-section{border:1px solid rgba(92,159,194,.20);border-radius:12px;background:linear-gradient(180deg,rgba(7,27,42,.91),rgba(5,20,34,.86));overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
    .rona-home-section-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 15px;border-bottom:1px solid rgba(92,159,194,.15)}
    .rona-home-section-head strong{color:#e3f6fd;font-size:12px;letter-spacing:.025em}.rona-home-source{color:#789eaf;font-size:9px;text-align:right}
    .rona-home-deals{display:grid;gap:8px;padding:10px}
    .rona-home-deal{display:grid;grid-template-columns:minmax(190px,1.45fr) minmax(150px,.95fr) minmax(150px,.95fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid rgba(92,159,194,.15);border-radius:10px;background:rgba(4,20,33,.55)}
    .rona-home-deal-id{color:#bfeafa;font-size:12px;font-weight:780}.rona-home-deal-product{margin-top:5px;color:#d8ebf4;font-size:10.5px;line-height:1.35}.rona-home-deal-route{margin-top:4px;color:#789eaf;font-size:9px;line-height:1.3}
    .rona-home-status-label{display:block;margin-bottom:5px;color:#6f98aa;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase}
    .rona-home-pill{display:inline-flex;align-items:center;min-height:25px;padding:0 9px;border:1px solid rgba(91,168,205,.22);border-radius:999px;background:rgba(21,76,104,.16);color:#bde9f5;font-size:9.5px;font-weight:710;white-space:nowrap}
    .rona-home-pill[data-tone="ok"]{border-color:rgba(85,211,157,.25);background:rgba(22,102,77,.16);color:#9ee8c5}.rona-home-pill[data-tone="wait"]{border-color:rgba(228,186,82,.25);background:rgba(129,91,19,.15);color:#f0d184}.rona-home-pill[data-tone="danger"]{border-color:rgba(227,112,112,.26);background:rgba(130,41,41,.15);color:#f4b0b0}
    .rona-home-open{min-height:32px;padding:0 11px;border:1px solid rgba(97,164,198,.24);border-radius:8px;background:rgba(13,45,67,.72);color:#dff4fb;font:700 9.5px/1 inherit;cursor:pointer}.rona-home-open:hover{background:rgba(21,64,91,.82)}
    .rona-home-empty{padding:22px;color:#8fb2c1;font-size:11px;text-align:center}
    .rona-home-context-required{padding:18px;border:1px solid rgba(228,186,82,.22);border-radius:12px;background:rgba(84,61,18,.12);color:#e5ca8b;font-size:11px;text-align:center}
    @media(max-width:1050px){.rona-home-kpis{grid-template-columns:1fr 1fr}.rona-home-deal{grid-template-columns:1fr 1fr}.rona-home-open{justify-self:start}}
    @media(max-width:720px){.rona-home-kpis{grid-template-columns:1fr}.rona-home-deal{grid-template-columns:1fr}.rona-home-pill{white-space:normal}}
  `;
  document.head.appendChild(style);
}
function alignOwner(root,owner){
  const title=titleFrame(root);if(!title)return;
  const parent=owner.parentElement||root,tr=title.getBoundingClientRect(),pr=parent.getBoundingClientRect(),ps=getComputedStyle(parent);
  const contentLeft=pr.left+parseFloat(ps.borderLeftWidth||'0')+parseFloat(ps.paddingLeft||'0');
  const left=Math.max(0,tr.left-contentLeft);
  owner.style.width=tr.width+'px';owner.style.maxWidth=tr.width+'px';owner.style.marginLeft=left+'px';owner.style.marginRight='0';
  owner.setAttribute('data-rona-home-canonical-width','title-frame');
}
function ensureOwner(root){
  installStyle();let owner=root.querySelector(OWNER);if(owner)return owner;
  owner=document.createElement('section');owner.setAttribute('data-rona-client-home-owner','authoritative-v1');
  const ctx=contextFrame(root),ctxDirect=directChild(root,ctx);
  if(ctxDirect?.parentElement===root)ctxDirect.insertAdjacentElement('afterend',owner);else root.appendChild(owner);
  return owner;
}
function hideCardByLeaf(root,text){
  for(const leaf of root.querySelectorAll('*')){
    if(leaf.closest(OWNER)||leaf.childElementCount!==0||norm(leaf.textContent)!==text)continue;
    let chosen=leaf,node=leaf;
    for(let depth=0;node.parentElement&&node.parentElement!==root&&depth<8;depth++){
      const p=node.parentElement,t=norm(p.textContent),r=p.getBoundingClientRect();
      if(t.includes('Главная')||t.includes('Выбрана компания')||r.width>root.getBoundingClientRect().width*.92)break;
      if(decorated(p)&&t.length<2600)chosen=p;
      node=p;
    }
    chosen.setAttribute('data-rona-home-legacy-hidden','true');
  }
}
function hideLegacy(root,owner){
  const title=titleFrame(root),ctx=contextFrame(root),titleDirect=directChild(root,title),ctxDirect=directChild(root,ctx);
  if(titleDirect&&ctxDirect&&titleDirect!==ctxDirect){
    for(const child of [...root.children]){
      if(child===titleDirect||child===ctxDirect||child===owner)continue;
      child.setAttribute('data-rona-home-legacy-hidden','true');
    }
  }else{
    for(const label of ['АКТИВНЫЕ СДЕЛКИ','ОПЛАТА','ТЕКУЩИЙ СТАТУС','СЛЕДУЮЩИЙ ШАГ','Компания','Оплата','Цены','Заявки'])hideCardByLeaf(root,label);
  }
  owner.removeAttribute('data-rona-home-legacy-hidden');
}
function updateTitleMeta(root,loadedAt){
  const title=titleFrame(root);if(!title)return;
  for(const el of title.querySelectorAll('*')){
    if(el.childElementCount!==0)continue;const t=norm(el.textContent);
    if(/^Данные\s+по\s+состоянию\s+на\s+/iu.test(t)||/^Обновлено:/iu.test(t))el.textContent='Обновлено: '+formatDateTime(loadedAt);
    else if(t.includes('Сводка по выбранной компании: сделки, условия, оплата и ближайшие шаги'))el.textContent='Актуальная серверная сводка по выбранной компании и договору.';
  }
}
function formatDate(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ru-RU')}
function formatDateTime(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function money(v,c){const n=num(v);if(n===null)return'—';return n.toLocaleString('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2})+(c?' '+norm(c):'')}
function quantity(v){const n=num(v);if(n===null)return'';return n.toLocaleString('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:1,maximumFractionDigits:3})+' т'}
function activeDeals(detail){return (Array.isArray(detail?.deals)?detail.deals:[]).filter(d=>!d?.closed_at&&!TERMINAL_DEALS.has(upper(d?.current_status||d?.business_status||d?.status)))}
function activeApplications(detail){return (Array.isArray(detail?.applications)?detail.applications:[]).filter(a=>!norm(a?.deal_id)&&!TERMINAL_APPLICATIONS.has(upper(a?.status)))}
function applicationByDeal(detail){const map=new Map();for(const a of Array.isArray(detail?.applications)?detail.applications:[]){const id=norm(a?.deal_id);if(id&&!map.has(id))map.set(id,a)}return map}
function financeGroups(deals){
  const map=new Map();
  for(const d of deals){const o=num(d?.payment_obligation_amount),r=num(d?.payment_received_amount);if(o===null&&r===null)continue;const c=norm(d?.payment_currency)||'—';if(!map.has(c))map.set(c,{currency:c,obligation:0,received:0});const x=map.get(c);x.obligation+=o||0;x.received+=r||0}
  return [...map.values()].map(x=>({...x,remaining:Math.max(0,x.obligation-x.received),percent:x.obligation>0?Math.max(0,Math.min(100,x.received/x.obligation*100)):0}));
}
function latestPayment(detail){
  const items=Array.isArray(detail?.payments)?detail.payments:[];let latest=null,latestTs=-1;
  for(const p of items){const at=p?.received_at||p?.payment_at||p?.bank_confirmed_at;if(!at)continue;const ts=new Date(at).getTime();if(Number.isFinite(ts)&&ts>latestTs){latest=p;latestTs=ts}}
  return latest;
}
function resourceTone(d){const code=upper(d?.resource_status);if(code.includes('CONFIRMED'))return'ok';if(code.includes('DENIED'))return'danger';return'wait'}
function paymentTone(d){const code=upper(d?.payment_status);if(code.includes('OVERDUE')||code.includes('ERROR'))return'danger';if(code.includes('PAID')||code.includes('CONFIRMED')||code.includes('PARTIALLY'))return'ok';return'wait'}
function dealTone(d){const code=upper(d?.current_status);if(TERMINAL_DEALS.has(code)&&code!=='DONE'&&code!=='COMPLETED'&&code!=='CLOSED')return'danger';return''}
function renderKpis(deals,detail){
  const cards=[];
  cards.push(`<article class="rona-home-kpi"><span class="rona-home-kpi-label">Активные сделки</span><b class="rona-home-kpi-value">${deals.length}</b><span class="rona-home-kpi-note">Только текущие сделки выбранного договора</span></article>`);
  const groups=financeGroups(deals);
  if(groups.length){
    const lines=groups.map(g=>`<div class="rona-home-kpi-line"><span>${esc(g.currency==='—'?'':g.currency)}</span><b>${esc(money(g.received,g.currency==='—'?'':g.currency))} / ${esc(money(g.obligation,g.currency==='—'?'':g.currency))}</b></div>`).join('');
    const remain=groups.map(g=>`${money(g.remaining,g.currency==='—'?'':g.currency)}`).join(' · ');
    cards.push(`<article class="rona-home-kpi"><span class="rona-home-kpi-label">Получено / к оплате</span><div class="rona-home-kpi-lines">${lines}</div><span class="rona-home-kpi-note">Остаток: ${esc(remain)}</span></article>`);
  }
  const last=latestPayment(detail);
  if(last){cards.push(`<article class="rona-home-kpi"><span class="rona-home-kpi-label">Последнее поступление</span><b class="rona-home-kpi-value" data-size="compact">${esc(money(last?.amount,last?.currency))}</b><span class="rona-home-kpi-note">${esc(formatDate(last?.received_at||last?.payment_at||last?.bank_confirmed_at))}${norm(last?.deal_id)?' · '+esc(last.deal_id):''}</span></article>`)}
  const activeApps=activeApplications(detail);
  if(activeApps.length){cards.push(`<article class="rona-home-kpi"><span class="rona-home-kpi-label">Заявки в работе</span><b class="rona-home-kpi-value">${activeApps.length}</b><span class="rona-home-kpi-note">Без зарегистрированной сделки</span></article>`)}
  return `<div class="rona-home-kpis">${cards.join('')}</div>`;
}
function renderDeals(deals,detail){
  if(!deals.length)return `<section class="rona-home-section"><div class="rona-home-section-head"><strong>Текущие сделки</strong><span class="rona-home-source">серверная проекция</span></div><div class="rona-home-empty">Активных сделок по выбранному договору нет.</div></section>`;
  const apps=applicationByDeal(detail);
  const rows=deals.map(d=>{
    const id=norm(d?.deal_id),app=apps.get(id)||{};
    const product=norm(app?.product)||'Товар по сделке';const q=quantity(app?.quantity_tonnes);
    const route=[norm(app?.destination),norm(app?.delivery_basis)].filter(Boolean).join(' · ');
    const stage=norm(d?.current_status_label)||norm(d?.current_status)||'Статус уточняется';
    const resource=norm(d?.resource_label)||'Статус ресурса уточняется';
    const payment=norm(d?.payment_label)||'Статус оплаты уточняется';
    return `<article class="rona-home-deal" data-home-deal-id="${esc(id)}"><div><div class="rona-home-deal-id">${esc(id||'Сделка')}</div><div class="rona-home-deal-product">${esc(product)}${q?' · '+esc(q):''}</div>${route?`<div class="rona-home-deal-route">${esc(route)}</div>`:''}</div><div><span class="rona-home-status-label">Статус сделки</span><span class="rona-home-pill" data-tone="${dealTone(d)}">${esc(stage)}</span></div><div><span class="rona-home-status-label">Ресурс / оплата</span><span class="rona-home-pill" data-tone="${resourceTone(d)}">${esc(resource)}</span><div style="height:5px"></div><span class="rona-home-pill" data-tone="${paymentTone(d)}">${esc(payment)}</span></div><button class="rona-home-open" type="button" data-home-action="deal" data-deal-id="${esc(id)}">Открыть</button></article>`;
  }).join('');
  return `<section class="rona-home-section"><div class="rona-home-section-head"><strong>Текущие сделки</strong><span class="rona-home-source">статусы обновляются автоматически</span></div><div class="rona-home-deals">${rows}</div></section>`;
}
function render(detail,ctx,loadedAt){
  const root=homeRoot();if(!root)return false;const owner=ensureOwner(root);hideLegacy(root,owner);alignOwner(root,owner);updateTitleMeta(root,loadedAt);
  const deals=activeDeals(detail);
  owner.innerHTML=renderKpis(deals,detail)+renderDeals(deals,detail);
  bindActions(owner);return true;
}
function renderContextRequired(){
  const root=homeRoot();if(!root)return false;const owner=ensureOwner(root);hideLegacy(root,owner);alignOwner(root,owner);
  owner.innerHTML='<div class="rona-home-context-required">Выберите компанию и договор в верхней панели. После выбора сводка загрузится автоматически.</div>';return true;
}
function sectionTrigger(label){
  const candidates=[...document.querySelectorAll('nav a,nav button,aside a,aside button,[role="navigation"] a,[role="navigation"] button')];
  return candidates.find(el=>norm(el.textContent)===label)||candidates.find(el=>norm(el.textContent).includes(label))||null;
}
function openDeal(dealId){
  sectionTrigger('Сделки')?.click();let attempts=0;
  const timer=setInterval(()=>{
    attempts++;const root=document.querySelector('#page-deals,#dealsPage,[data-page-panel="deals"],[data-page-id="deals"]');
    if(root){
      const leaf=[...root.querySelectorAll('*')].find(el=>el.childElementCount===0&&norm(el.textContent).includes(dealId));
      if(leaf){let row=leaf;for(let i=0;row&&row!==root&&i<10;i++,row=row.parentElement){if(!norm(row.textContent).includes(dealId))continue;const open=[...row.querySelectorAll('button,a,[role="button"]')].find(el=>/^Открыть(?:\s+сделку)?$/iu.test(norm(el.textContent)));if(open){clearInterval(timer);open.click();return}}}
    }
    if(attempts>=25)clearInterval(timer);
  },120);
}
function bindActions(owner){
  if(owner.dataset.ronaHomeActionsBound==='true')return;owner.dataset.ronaHomeActionsBound='true';
  owner.addEventListener('click',e=>{const target=e.target?.closest?.('[data-home-action]');if(!target)return;const action=target.getAttribute('data-home-action');if(action==='deal'){const id=norm(target.getAttribute('data-deal-id'));if(id)openDeal(id)}});
}
async function load(force=false){
  if(state.loading)return;
  const root=homeRoot();if(!root)return;
  if(!force&&state.detail&&Date.now()-state.lastLoad<REFRESH_MS){render(state.detail,state.ctx,state.lastLoad);setHomeState('ready');return}
  state.loading=true;const previousKey=state.activeKey;
  try{
    const boot=await request('/v1/client/bootstrap');
    const contexts=Array.isArray(boot?.data?.contexts)?boot.data.contexts:[];state.contexts=contexts;
    const ctx=chooseContext(contexts,root);
    if(!ctx){state.activeKey='';state.detail=null;state.ctx=null;renderContextRequired();setHomeState('ready');return}
    const key=contextKey(ctx);if(!previousKey||previousKey!==key)setHomeState('loading');
    const detail=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));
    state.activeKey=key;state.detail=detail?.data||{};state.ctx=ctx;state.lastLoad=Date.now();
    window.__RONA_CLIENT_HOME_STATE__={version:MARK,source:'CLIENT_CONTEXT_HOME_PROJECTION',client_id:norm(ctx.client_id),contract_id:norm(ctx.contract_id),active_deals:activeDeals(state.detail).map(d=>norm(d?.deal_id)),loaded_at:new Date(state.lastLoad).toISOString()};
    render(state.detail,ctx,state.lastLoad);setHomeState('ready');
  }catch(error){console.error('RONA client home authoritative projection',error);state.detail=null;setHomeState('error')}
  finally{state.loading=false}
}
function schedule(force=false){
  if(state.scheduled)return;state.scheduled=true;
  requestAnimationFrame(()=>{state.scheduled=false;const root=homeRoot();if(!root)return;const selected=state.contexts.length?chooseContext(state.contexts,root):null;const changed=selected&&contextKey(selected)!==state.activeKey;load(Boolean(force||changed))});
}
function start(){
  installStyle();setHomeState('loading');schedule(true);
  state.observer=new MutationObserver(()=>schedule(false));state.observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden','aria-selected']});
  window.addEventListener('pageshow',()=>schedule(true),{passive:true});
  window.addEventListener('resize',()=>{const root=homeRoot(),owner=root?.querySelector(OWNER);if(root&&owner)alignOwner(root,owner)},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule(true)});
  state.timer=window.setInterval(()=>schedule(true),REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();