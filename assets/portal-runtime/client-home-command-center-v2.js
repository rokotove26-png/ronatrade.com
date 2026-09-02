(()=>{'use strict';
const MARK='20260902-client-home-command-center-v3-current-context';
if(window.__RONA_CLIENT_HOME_RUNTIME__===MARK)return;
window.__RONA_CLIENT_HOME_RUNTIME__=MARK;
if(location.pathname!=='/portal/client')return;

const API='/portal/api',REFRESH_MS=30000;
const OWNER='[data-rona-client-home-owner="command-center-v2"]';
const TERMINAL_DEALS=new Set(['CLOSED','COMPLETED','DONE','CANCELLED']);
const TERMINAL_APPLICATIONS=new Set(['DEAL_REGISTERED','ARCHIVED','CANCELLED','REJECTED']);
const state={activeKey:'',detail:null,ctx:null,loading:false,lastLoad:0,timer:0,scheduled:false,observer:null,unsubscribe:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const upper=v=>norm(v).toUpperCase();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const esc=v=>norm(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
function contextKey(c){return norm(c?.client_id)+'|'+norm(c?.contract_id)}
function contextAuthority(){return window.RONA_CLIENT_CONTEXT||null}
async function currentContext(){const authority=contextAuthority();if(!authority)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');return authority.getCurrentContext()||await authority.whenReady()}
function setHomeState(mode){
  document.documentElement.setAttribute('data-rona-client-home-state',mode);
  if(mode==='ready')document.documentElement.setAttribute('data-rona-client-home-ready','true');
  else document.documentElement.removeAttribute('data-rona-client-home-ready');
}
function installStyle(){
  if(document.getElementById('rona-client-home-command-center-v2-style'))return;
  const style=document.createElement('style');style.id='rona-client-home-command-center-v2-style';
  style.textContent=`
    #page-home ${OWNER},#homePage ${OWNER},[data-page-panel="home"] ${OWNER},[data-page-id="home"] ${OWNER}{display:grid;gap:12px;box-sizing:border-box;color:#d9edf7;font-family:inherit;padding-bottom:22px}
    [data-rona-client-home-owner="command-center-v2"] *{box-sizing:border-box}
    [data-rona-home-legacy-hidden="true"]{display:none!important}
    .rona-cc-livebar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:42px;padding:9px 12px;border:1px solid rgba(68,178,224,.22);border-radius:11px;background:linear-gradient(90deg,rgba(5,28,43,.94),rgba(6,25,40,.76));box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 26px rgba(0,0,0,.08)}
    .rona-cc-liveleft{display:flex;align-items:center;gap:9px;min-width:0}.rona-cc-live-dot{width:7px;height:7px;border-radius:50%;background:#54dba2;box-shadow:0 0 0 4px rgba(84,219,162,.09),0 0 14px rgba(84,219,162,.4);flex:none}
    .rona-cc-live-title{color:#dff7ff;font-size:10px;font-weight:760;letter-spacing:.035em;text-transform:uppercase}.rona-cc-live-note{color:#789fb1;font-size:9px;white-space:nowrap}
    .rona-cc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .rona-cc-kpi{position:relative;min-height:108px;padding:13px 14px 12px;border:1px solid rgba(77,162,201,.20);border-radius:12px;background:linear-gradient(155deg,rgba(7,31,48,.94),rgba(4,19,32,.87));overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 30px rgba(0,0,0,.08)}
    .rona-cc-kpi::after{content:"";position:absolute;width:92px;height:92px;right:-34px;top:-42px;border:1px solid rgba(60,181,228,.07);border-radius:50%;box-shadow:0 0 0 18px rgba(60,181,228,.018);pointer-events:none}
    .rona-cc-kpi-label{display:block;color:#719aac;font-size:8.5px;letter-spacing:.09em;text-transform:uppercase}.rona-cc-kpi-value{display:block;margin-top:10px;color:#f0fbff;font-size:25px;line-height:1;font-weight:820;letter-spacing:-.025em}.rona-cc-kpi-value[data-size="compact"]{font-size:17px;line-height:1.15}
    .rona-cc-kpi-note{display:block;margin-top:8px;color:#85aab9;font-size:9px;line-height:1.35}.rona-cc-kpi-progress{height:4px;margin-top:10px;border-radius:999px;background:rgba(103,154,177,.13);overflow:hidden}.rona-cc-kpi-progress>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,rgba(61,178,222,.88),rgba(75,218,167,.88))}
    .rona-cc-main{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(250px,.78fr);gap:12px;align-items:start}.rona-cc-stack{display:grid;gap:12px}
    .rona-cc-panel{border:1px solid rgba(77,162,201,.19);border-radius:12px;background:linear-gradient(180deg,rgba(6,26,42,.93),rgba(4,18,31,.87));overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.024),0 12px 34px rgba(0,0,0,.08)}
    .rona-cc-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px 14px;border-bottom:1px solid rgba(76,149,180,.13)}.rona-cc-panel-title{display:block;color:#e4f7fd;font-size:11.5px;font-weight:790;letter-spacing:.025em}.rona-cc-panel-sub{display:block;margin-top:3px;color:#668e9f;font-size:8.5px}.rona-cc-panel-meta{color:#668e9f;font-size:8.5px;text-align:right;white-space:nowrap}
    .rona-cc-deals{display:grid}.rona-cc-deal{display:grid;grid-template-columns:minmax(185px,1.35fr) minmax(118px,.78fr) minmax(132px,.88fr) minmax(132px,.88fr) auto;gap:10px;align-items:center;padding:12px 13px;border-bottom:1px solid rgba(78,142,170,.11);transition:background .15s ease}.rona-cc-deal:last-child{border-bottom:0}.rona-cc-deal:hover{background:rgba(24,73,98,.10)}
    .rona-cc-deal-id{color:#bfeafa;font-size:11.5px;font-weight:800}.rona-cc-deal-product{margin-top:4px;color:#d3e8f1;font-size:9.6px;line-height:1.35}.rona-cc-deal-route{margin-top:4px;color:#658b9c;font-size:8.4px;line-height:1.3}.rona-cc-label{display:block;margin-bottom:5px;color:#638a9a;font-size:7.7px;letter-spacing:.075em;text-transform:uppercase}
    .rona-cc-pill{display:inline-flex;align-items:center;max-width:100%;min-height:24px;padding:0 8px;border:1px solid rgba(91,168,205,.21);border-radius:999px;background:rgba(21,76,104,.15);color:#bde9f5;font-size:8.7px;font-weight:710;line-height:1.15}.rona-cc-pill[data-tone="ok"]{border-color:rgba(85,211,157,.24);background:rgba(22,102,77,.15);color:#9ee8c5}.rona-cc-pill[data-tone="wait"]{border-color:rgba(228,186,82,.24);background:rgba(129,91,19,.14);color:#f0d184}.rona-cc-pill[data-tone="danger"]{border-color:rgba(227,112,112,.26);background:rgba(130,41,41,.15);color:#f4b0b0}
    .rona-cc-open{min-height:31px;padding:0 11px;border:1px solid rgba(80,171,211,.28);border-radius:8px;background:linear-gradient(180deg,rgba(16,62,87,.82),rgba(10,43,64,.78));color:#e3f6fd;font:730 9px/1 inherit;cursor:pointer}.rona-cc-open:hover{border-color:rgba(86,194,239,.45);background:linear-gradient(180deg,rgba(20,75,103,.9),rgba(12,52,75,.88))}
    .rona-cc-empty{padding:25px 16px;color:#82a5b4;font-size:10px;text-align:center}
    .rona-cc-attention{display:grid;gap:8px;padding:10px}.rona-cc-alert{position:relative;padding:10px 10px 10px 13px;border:1px solid rgba(79,149,180,.13);border-radius:9px;background:rgba(8,30,45,.45)}.rona-cc-alert::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:2px;border-radius:4px;background:#45abd2}.rona-cc-alert[data-tone="wait"]::before{background:#d8b455}.rona-cc-alert[data-tone="danger"]::before{background:#df7777}.rona-cc-alert[data-tone="ok"]::before{background:#56cf9d}.rona-cc-alert strong{display:block;color:#d9eef6;font-size:9.4px;line-height:1.35}.rona-cc-alert span{display:block;margin-top:4px;color:#789eae;font-size:8.4px;line-height:1.35}
    .rona-cc-bottom{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:12px}.rona-cc-finance{display:grid;gap:10px;padding:12px}.rona-cc-finance-row{display:grid;grid-template-columns:72px 1fr auto;gap:10px;align-items:center}.rona-cc-finance-code{color:#bfeafa;font-size:10.5px;font-weight:800}.rona-cc-finance-track{height:7px;border-radius:999px;background:rgba(100,150,171,.13);overflow:hidden}.rona-cc-finance-track>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2f9eca,#4bcf9f)}.rona-cc-finance-values{color:#bcd6e0;font-size:8.8px;text-align:right;white-space:nowrap}.rona-cc-finance-values b{color:#effbff}.rona-cc-finance-foot{display:flex;justify-content:space-between;gap:16px;padding-top:3px;color:#769dad;font-size:8.5px;line-height:1.4}
    .rona-cc-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:10px}.rona-cc-action{min-height:38px;padding:7px 9px;border:1px solid rgba(83,159,192,.18);border-radius:9px;background:rgba(9,36,52,.54);color:#cfeaf4;font:700 8.8px/1.2 inherit;text-align:left;cursor:pointer}.rona-cc-action:hover{border-color:rgba(82,183,224,.34);background:rgba(13,50,70,.69)}.rona-cc-action span{display:block;margin-top:3px;color:#648c9d;font-size:7.6px;font-weight:500}
    .rona-cc-context-required{padding:20px;border:1px solid rgba(228,186,82,.22);border-radius:12px;background:rgba(84,61,18,.12);color:#e5ca8b;font-size:10.5px;text-align:center}
    @media(max-width:1180px){.rona-cc-kpis{grid-template-columns:1fr 1fr}.rona-cc-main,.rona-cc-bottom{grid-template-columns:1fr}.rona-cc-deal{grid-template-columns:minmax(170px,1.35fr) repeat(3,minmax(115px,.8fr)) auto}}
    @media(max-width:820px){.rona-cc-deal{grid-template-columns:1fr 1fr}.rona-cc-deal>div:first-child{grid-column:1/-1}.rona-cc-open{justify-self:start}.rona-cc-finance-row{grid-template-columns:55px 1fr}.rona-cc-finance-values{grid-column:1/-1;text-align:left}}
    @media(max-width:600px){.rona-cc-livebar{align-items:flex-start;flex-direction:column}.rona-cc-live-note{white-space:normal}.rona-cc-kpis{grid-template-columns:1fr}.rona-cc-deal{grid-template-columns:1fr}.rona-cc-deal>div:first-child{grid-column:auto}.rona-cc-actions{grid-template-columns:1fr}}
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
  for(const stale of root.querySelectorAll('[data-rona-client-home-owner]'))stale.remove();
  owner=document.createElement('section');owner.setAttribute('data-rona-client-home-owner','command-center-v2');
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
    else if(t.includes('Сводка по выбранной компании: сделки, условия, оплата и ближайшие шаги')||t.includes('Актуальная серверная сводка по выбранной компании и договору'))el.textContent='Центр управления по выбранной компании и договору.';
  }
}
function formatDate(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ru-RU')}
function formatDateTime(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function money(v,c){const n=num(v);if(n===null)return'—';return n.toLocaleString('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2})+(c?' '+norm(c):'')}
function quantity(v){const n=num(v);if(n===null)return'';return n.toLocaleString('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:1,maximumFractionDigits:3})+' т'}
function activeDeals(detail){return (Array.isArray(detail?.deals)?detail.deals:[]).filter(d=>!d?.closed_at&&!TERMINAL_DEALS.has(upper(d?.current_status||d?.business_status||d?.status)))}
function activeApplications(detail){return (Array.isArray(detail?.applications)?detail.applications:[]).filter(a=>!norm(a?.deal_id)&&!TERMINAL_APPLICATIONS.has(upper(a?.status)))}
function applicationByDeal(detail){const map=new Map();for(const a of Array.isArray(detail?.applications)?detail.applications:[]){const id=norm(a?.deal_id);if(id&&!map.has(id))map.set(id,a)}return map}
function totalVolume(deals,detail){const apps=applicationByDeal(detail);let total=0,count=0;for(const d of deals){const q=num(apps.get(norm(d?.deal_id))?.quantity_tonnes);if(q!==null){total+=q;count++}}return count?total:null}
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
function resourceTone(d){const code=upper(d?.resource_status);if(code.includes('CONFIRMED'))return'ok';if(code.includes('DENIED')||code.includes('REJECT'))return'danger';return'wait'}
function paymentTone(d){const code=upper(d?.payment_status);if(code.includes('OVERDUE')||code.includes('ERROR')||code.includes('REJECT'))return'danger';if(code.includes('PAID')||code.includes('CONFIRMED')||code.includes('PARTIALLY'))return'ok';return'wait'}
function dealTone(d){const code=upper(d?.current_status);if(code.includes('CANCEL')||code.includes('REJECT')||code.includes('ERROR'))return'danger';return''}
function confirmedResources(deals){return deals.filter(d=>resourceTone(d)==='ok').length}
function financePrimary(groups){if(groups.length!==1)return null;return groups[0]}
function attentionItems(deals,detail){
  const items=[];
  for(const d of deals){
    const id=norm(d?.deal_id)||'Сделка';const r=upper(d?.resource_status),p=upper(d?.payment_status);
    if(r.includes('DENIED')||r.includes('REJECT'))items.push({tone:'danger',title:id+' · ресурс',note:norm(d?.resource_label)||'Сервер зафиксировал отказ по ресурсу'});
    else if(r.includes('PENDING')||r.includes('WAIT'))items.push({tone:'wait',title:id+' · ресурс',note:norm(d?.resource_label)||'Ресурс ожидает подтверждения'});
    if(p.includes('OVERDUE')||p.includes('ERROR')||p.includes('REJECT'))items.push({tone:'danger',title:id+' · оплата',note:norm(d?.payment_label)||'Сервер зафиксировал проблему оплаты'});
  }
  const apps=activeApplications(detail);if(apps.length)items.push({tone:'wait',title:'Заявки без сделки: '+apps.length,note:'Текущие заявки выбранного договора, по которым сделка ещё не зарегистрирована'});
  return items;
}
function renderLivebar(loadedAt){return `<div class="rona-cc-livebar"><div class="rona-cc-liveleft"><i class="rona-cc-live-dot"></i><div><div class="rona-cc-live-title">Оперативный центр</div><div class="rona-cc-panel-sub">Только актуальные данные выбранного договора</div></div></div><div class="rona-cc-live-note">Автообновление 30 сек · ${esc(formatDateTime(loadedAt))}</div></div>`}
function renderKpis(deals,detail){
  const volume=totalVolume(deals,detail),groups=financeGroups(deals),primary=financePrimary(groups),confirmed=confirmedResources(deals),apps=activeApplications(detail);
  const financeValue=primary?money(primary.received,primary.currency==='—'?'':primary.currency):(groups.length?groups.length+' валют':'—');
  const financeNote=primary?`Из ${money(primary.obligation,primary.currency==='—'?'':primary.currency)} · остаток ${money(primary.remaining,primary.currency==='—'?'':primary.currency)}`:(groups.length?'Финансовые итоги ведутся раздельно по валютам':'Финансовое обязательство не зарегистрировано');
  const financeProgress=primary?`<div class="rona-cc-kpi-progress"><i style="width:${primary.percent.toFixed(2)}%"></i></div>`:'';
  return `<div class="rona-cc-kpis">
    <article class="rona-cc-kpi"><span class="rona-cc-kpi-label">Активные сделки</span><b class="rona-cc-kpi-value">${deals.length}</b><span class="rona-cc-kpi-note">Текущий контур исполнения договора</span></article>
    <article class="rona-cc-kpi"><span class="rona-cc-kpi-label">Объём в работе</span><b class="rona-cc-kpi-value" data-size="${volume===null?'compact':''}">${volume===null?'—':esc(quantity(volume))}</b><span class="rona-cc-kpi-note">Сумма объёмов по связанным заявкам активных сделок</span></article>
    <article class="rona-cc-kpi"><span class="rona-cc-kpi-label">Получено</span><b class="rona-cc-kpi-value" data-size="compact">${esc(financeValue)}</b>${financeProgress}<span class="rona-cc-kpi-note">${esc(financeNote)}</span></article>
    <article class="rona-cc-kpi"><span class="rona-cc-kpi-label">Ресурс подтверждён</span><b class="rona-cc-kpi-value">${confirmed}<span style="font-size:12px;color:#7296a5;font-weight:650"> / ${deals.length}</span></b><span class="rona-cc-kpi-note">${apps.length?`Плюс заявок без сделки: ${apps.length}`:'По текущему договору'}</span></article>
  </div>`;
}
function renderDeals(deals,detail){
  if(!deals.length)return `<section class="rona-cc-panel"><div class="rona-cc-panel-head"><div><strong class="rona-cc-panel-title">Сделки в работе</strong><span class="rona-cc-panel-sub">Единый операционный контур</span></div><span class="rona-cc-panel-meta">серверные статусы</span></div><div class="rona-cc-empty">Активных сделок по выбранному договору нет.</div></section>`;
  const apps=applicationByDeal(detail);
  const rows=deals.map(d=>{
    const id=norm(d?.deal_id),app=apps.get(id)||{},product=norm(app?.product)||'Товар по сделке',q=quantity(app?.quantity_tonnes),route=[norm(app?.delivery_basis),norm(app?.destination)].filter(Boolean).join(' · ');
    const stage=norm(d?.current_status_label)||norm(d?.current_status)||'Статус не опубликован',resource=norm(d?.resource_label)||'Статус ресурса не опубликован',payment=norm(d?.payment_label)||'Статус оплаты не опубликован';
    return `<article class="rona-cc-deal" data-home-deal-id="${esc(id)}"><div><div class="rona-cc-deal-id">${esc(id||'Сделка')}</div><div class="rona-cc-deal-product">${esc(product)}${q?' · '+esc(q):''}</div>${route?`<div class="rona-cc-deal-route">${esc(route)}</div>`:''}</div><div><span class="rona-cc-label">Сделка</span><span class="rona-cc-pill" data-tone="${dealTone(d)}">${esc(stage)}</span></div><div><span class="rona-cc-label">Ресурс</span><span class="rona-cc-pill" data-tone="${resourceTone(d)}">${esc(resource)}</span></div><div><span class="rona-cc-label">Оплата</span><span class="rona-cc-pill" data-tone="${paymentTone(d)}">${esc(payment)}</span></div><button class="rona-cc-open" type="button" data-home-action="deal" data-deal-id="${esc(id)}">Открыть</button></article>`;
  }).join('');
  return `<section class="rona-cc-panel"><div class="rona-cc-panel-head"><div><strong class="rona-cc-panel-title">Сделки в работе</strong><span class="rona-cc-panel-sub">Статус сделки, ресурса и оплаты в одном месте</span></div><span class="rona-cc-panel-meta">${deals.length} текущ.</span></div><div class="rona-cc-deals">${rows}</div></section>`;
}
function renderAttention(deals,detail){
  const items=attentionItems(deals,detail);
  const html=items.length?items.map(x=>`<div class="rona-cc-alert" data-tone="${x.tone}"><strong>${esc(x.title)}</strong><span>${esc(x.note)}</span></div>`).join(''):`<div class="rona-cc-alert" data-tone="ok"><strong>Критических событий нет</strong><span>По опубликованным серверным статусам выбранного договора нет просроченной оплаты, отказа ресурса или необработанных исключений.</span></div>`;
  return `<section class="rona-cc-panel"><div class="rona-cc-panel-head"><div><strong class="rona-cc-panel-title">Требует внимания</strong><span class="rona-cc-panel-sub">Только фактические исключения и ожидания</span></div><span class="rona-cc-panel-meta">${items.length||'0'}</span></div><div class="rona-cc-attention">${html}</div></section>`;
}
function renderFinance(deals,detail){
  const groups=financeGroups(deals),last=latestPayment(detail);
  let body='';
  if(groups.length){body=groups.map(g=>`<div class="rona-cc-finance-row"><b class="rona-cc-finance-code">${esc(g.currency==='—'?'':g.currency)}</b><div class="rona-cc-finance-track"><i style="width:${g.percent.toFixed(2)}%"></i></div><div class="rona-cc-finance-values"><b>${esc(money(g.received,g.currency==='—'?'':g.currency))}</b> из ${esc(money(g.obligation,g.currency==='—'?'':g.currency))} · остаток ${esc(money(g.remaining,g.currency==='—'?'':g.currency))}</div></div>`).join('')}else body='<div class="rona-cc-empty">По активным сделкам финансовое обязательство не опубликовано.</div>';
  const lastText=last?`Последнее подтверждённое поступление: ${money(last?.amount,last?.currency)} · ${formatDate(last?.received_at||last?.payment_at||last?.bank_confirmed_at)}${norm(last?.deal_id)?' · '+norm(last.deal_id):''}`:'Подтверждённых поступлений по выбранному договору пока нет.';
  return `<section class="rona-cc-panel"><div class="rona-cc-panel-head"><div><strong class="rona-cc-panel-title">Финансовое исполнение</strong><span class="rona-cc-panel-sub">Получено, обязательство и остаток по активным сделкам</span></div><span class="rona-cc-panel-meta">Finance</span></div><div class="rona-cc-finance">${body}<div class="rona-cc-finance-foot"><span>${esc(lastText)}</span><button class="rona-cc-open" type="button" data-home-action="section" data-section="Платежи и взаиморасчеты">Открыть платежи</button></div></div></section>`;
}
function renderActions(){
  const actions=[
    ['Заявки','Создать или открыть заявку','Заявки'],
    ['Сделки','Перейти к полному контуру сделки','Сделки'],
    ['Платежи','Платежи и взаиморасчёты','Платежи и взаиморасчеты'],
    ['Онлайн ЖД','Текущая железнодорожная логистика','Онлайн ЖД'],
    ['Документы','Закрывающие документы','Закрывающие документы'],
    ['Сообщения','Рабочая переписка','Сообщения']
  ];
  return `<section class="rona-cc-panel"><div class="rona-cc-panel-head"><div><strong class="rona-cc-panel-title">Быстрые действия</strong><span class="rona-cc-panel-sub">Переход без дублирования данных</span></div></div><div class="rona-cc-actions">${actions.map(a=>`<button class="rona-cc-action" type="button" data-home-action="section" data-section="${esc(a[2])}">${esc(a[0])}<span>${esc(a[1])}</span></button>`).join('')}</div></section>`;
}
function render(detail,ctx,loadedAt){
  const root=homeRoot();if(!root)return false;const owner=ensureOwner(root);hideLegacy(root,owner);alignOwner(root,owner);updateTitleMeta(root,loadedAt);
  const deals=activeDeals(detail);
  owner.innerHTML=renderLivebar(loadedAt)+renderKpis(deals,detail)+`<div class="rona-cc-main"><div>${renderDeals(deals,detail)}</div><div class="rona-cc-stack">${renderAttention(deals,detail)}${renderActions()}</div></div>`+`<div class="rona-cc-bottom">${renderFinance(deals,detail)}<section class="rona-cc-panel"><div class="rona-cc-panel-head"><div><strong class="rona-cc-panel-title">Контур управления</strong><span class="rona-cc-panel-sub">Что обновляется автоматически</span></div></div><div class="rona-cc-attention"><div class="rona-cc-alert"><strong>Сделки и ресурс</strong><span>Серверные статусы активных сделок и доступности ресурса.</span></div><div class="rona-cc-alert"><strong>Финансы</strong><span>Суммы обязательств, подтверждённых поступлений и остатка.</span></div><div class="rona-cc-alert"><strong>Контекст</strong><span>При смене компании или договора Главная перестраивается автоматически.</span></div></div></section></div>`;
  bindActions(owner);return true;
}
function renderContextRequired(){
  const root=homeRoot();if(!root)return false;const owner=ensureOwner(root);hideLegacy(root,owner);alignOwner(root,owner);
  owner.innerHTML='<div class="rona-cc-context-required">Выберите компанию и договор в верхней панели. После выбора центр управления загрузится автоматически.</div>';return true;
}
function sectionTrigger(label){
  const candidates=[...document.querySelectorAll('nav a,nav button,aside a,aside button,[role="navigation"] a,[role="navigation"] button')];
  const wanted=norm(label).toLowerCase().replace(/ё/g,'е');
  return candidates.find(el=>norm(el.textContent).toLowerCase().replace(/ё/g,'е')===wanted)||candidates.find(el=>norm(el.textContent).toLowerCase().replace(/ё/g,'е').includes(wanted))||null;
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
  owner.addEventListener('click',e=>{const target=e.target?.closest?.('[data-home-action]');if(!target)return;const action=target.getAttribute('data-home-action');if(action==='deal'){const id=norm(target.getAttribute('data-deal-id'));if(id)openDeal(id)}else if(action==='section'){sectionTrigger(target.getAttribute('data-section'))?.click()}});
}
function clearForContext(ctx){state.activeKey=ctx?contextKey(ctx):'';state.detail=null;state.ctx=ctx||null;state.lastLoad=0}
async function load(force=false){
  if(state.loading)return;
  const root=homeRoot();if(!root)return;
  let ctx=null;
  try{ctx=await currentContext()}catch(error){console.error('RONA client home context authority',error);state.detail=null;setHomeState('error');return}
  if(!ctx){clearForContext(null);renderContextRequired();setHomeState('ready');return}
  const key=contextKey(ctx);
  if(state.activeKey&&state.activeKey!==key)clearForContext(ctx);else state.ctx=ctx;
  if(!force&&state.detail&&Date.now()-state.lastLoad<REFRESH_MS){render(state.detail,ctx,state.lastLoad);setHomeState('ready');return}
  state.loading=true;
  try{
    setHomeState('loading');
    const detail=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));
    if(contextKey(contextAuthority()?.getCurrentContext())!==key)return;
    state.activeKey=key;state.detail=detail?.data||{};state.ctx=ctx;state.lastLoad=Date.now();
    window.__RONA_CLIENT_HOME_STATE__={version:MARK,source:'CURRENT_CONTEXT_HOME_PROJECTION',mode:'COMMAND_CENTER',client_id:norm(ctx.client_id),contract_id:norm(ctx.contract_id),active_deals:activeDeals(state.detail).map(d=>norm(d?.deal_id)),loaded_at:new Date(state.lastLoad).toISOString()};
    render(state.detail,ctx,state.lastLoad);setHomeState('ready');
  }catch(error){console.error('RONA client home command center projection',error);state.detail=null;setHomeState('error')}
  finally{state.loading=false}
}
function schedule(force=false){if(state.scheduled)return;state.scheduled=true;requestAnimationFrame(()=>{state.scheduled=false;if(homeRoot())load(force)})}
function start(){
  installStyle();setHomeState('loading');
  const authority=contextAuthority();
  if(!authority){setHomeState('error');return}
  state.unsubscribe=authority.subscribe(ctx=>{const key=ctx?contextKey(ctx):'';if(key!==state.activeKey)clearForContext(ctx);schedule(true)});
  schedule(true);
  state.observer=new MutationObserver(()=>schedule(false));state.observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden','aria-selected']});
  window.addEventListener('pageshow',()=>schedule(true),{passive:true});
  window.addEventListener('resize',()=>{const root=homeRoot(),owner=root?.querySelector(OWNER);if(root&&owner)alignOwner(root,owner)},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule(true)});
  state.timer=window.setInterval(()=>schedule(true),REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
