const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_PRICES_CURRENT_UI__)return;
window.__RONA_PRICES_CURRENT_UI__='20260825-owner-update-gate-v3-canonical-2a';
if(location.pathname!=='/portal/admin')return;
const OWNER_API='/portal/owner-api';
const UPDATE_API='/portal/price-updates-api';
const q=(s,r=document)=>r.querySelector(s);
const e=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined&&text!==null)n.textContent=String(text);return n};
const money=(v,c='')=>v===null||v===undefined||v===''?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v))+(c?' '+c:'');
const dt=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})};
let admin=null,updates=null,loading=false,timer=null,ownerPriceFilter='ALL';

function page(){return q('#page-prices')}
function nav(){return q('#nav button[data-page="prices"]')}

function installStyle(){
 if(q('#ronaPricesCurrentStyle'))return;
 const s=e('style');s.id='ronaPricesCurrentStyle';s.textContent=[
 '#page-prices>#rona-prices-current{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;width:min(100%,1660px)!important;max-width:1660px!important;margin:0 auto!important}',
 '#page-prices>.rona-prices-legacy-hidden{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}',
 '.rona-prices-signal{border-color:rgba(255,107,122,.38)!important;background:radial-gradient(420px 150px at 100% 0,rgba(255,107,122,.14),transparent 68%),linear-gradient(180deg,rgba(40,20,29,.92),rgba(15,12,19,.82))!important;box-shadow:inset 3px 0 0 rgba(255,107,122,.82),0 18px 52px rgba(0,0,0,.23)!important}',
 '.rona-prices-signal-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.rona-prices-signal-title{font-size:16px;font-weight:900;color:#ff7d8a}.rona-prices-signal-sub{margin-top:5px;font-size:12px;line-height:1.55;color:#c9d3dc}',
 '.rona-prices-pill{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:5px 9px;border-radius:999px;border:1px solid rgba(145,190,214,.18);background:rgba(6,12,19,.42);font-size:10px;font-weight:850;white-space:nowrap;text-align:center}',
 '.rona-prices-pill.ok{border-color:rgba(76,225,184,.28);background:rgba(76,225,184,.08);color:#c8ffef}.rona-prices-pill.warn{border-color:rgba(255,199,107,.32);background:rgba(255,199,107,.09);color:#ffe3ad}.rona-prices-pill.bad{border-color:rgba(255,107,122,.36);background:rgba(255,107,122,.10);color:#ffc5cc}',
 '.rona-prices-proposals{display:grid;gap:14px}.rona-prices-proposal{margin-bottom:0!important}.rona-prices-proposal.is-update{border-color:rgba(255,107,122,.26)!important}.rona-prices-proposal.is-blocked{border-color:rgba(255,199,107,.28)!important}',
 '.rona-prices-proposal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}.rona-prices-proposal-title{font-size:15px;font-weight:900;color:#f8fbff}.rona-prices-proposal-meta{font-size:11px;color:var(--rv-muted,#91a2b3);margin-top:5px;line-height:1.45}',
 '.rona-prices-reason{margin:13px 0 0;font-size:13px;line-height:1.55;color:#dce6ed}.rona-prices-source{font-size:11px;color:var(--rv-muted,#91a2b3);line-height:1.5;margin-top:10px;word-break:break-word}',
 '.rona-prices-details[hidden]{display:none!important}.rona-prices-details{margin-top:14px;padding-top:14px;border-top:1px solid rgba(144,184,205,.10)}',
 '.rona-prices-diff-old{color:#9cabb7}.rona-prices-diff-new{font-weight:900;color:#f8fbff}.rona-prices-internal{font-size:10px;font-weight:850;color:#9aa9b5;white-space:nowrap}.rona-prices-external{font-size:10px;font-weight:850;color:#73e5c2;white-space:nowrap}',
 '.rona-prices-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.rona-prices-actions button{font:inherit;cursor:pointer;font-size:12px;font-weight:800}.rona-prices-actions button:disabled{opacity:.45;cursor:default}',
 '.rona-prices-apply{border-color:rgba(89,215,255,.38)!important;background:linear-gradient(135deg,rgba(53,169,219,.26),rgba(96,110,224,.24))!important}.rona-prices-reject{border-color:rgba(255,107,122,.24)!important}',
 '.rona-prices-card-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:12px}.rona-prices-card-head h2{margin:0!important}.rona-prices-card-sub{font-size:12px;color:var(--rv-muted,#91a2b3);line-height:1.45}',
 '.rona-prices-kpi-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.rona-prices-kpi{min-height:118px;display:flex;flex-direction:column;justify-content:space-between}.rona-prices-kpi-label{font-size:12px;color:var(--rv-muted,#91a2b3);font-weight:800}.rona-prices-kpi-value{margin-top:9px;font-size:22px;line-height:1.15;font-weight:900;color:#f7fbff}.rona-prices-kpi-caption{margin-top:8px;font-size:11px;line-height:1.45;color:var(--rv-muted,#91a2b3)}',
 '.rona-prices-filter{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.rona-prices-filter button{font:inherit;color:#c7d2db;background:rgba(6,12,19,.34);border:1px solid rgba(145,190,214,.16);border-radius:999px;padding:8px 12px;cursor:pointer;font-size:11px;font-weight:850}.rona-prices-filter button[aria-pressed="true"]{color:#fff;border-color:rgba(89,215,255,.38);background:rgba(53,169,219,.18)}',
 '.rona-prices-matrix .rona-owner-table th:nth-child(n+4),.rona-prices-matrix .rona-owner-table td:nth-child(n+4){text-align:center}.rona-prices-matrix .rona-owner-table td:first-child{font-weight:900}.rona-prices-matrix .rona-owner-table td:nth-child(4),.rona-prices-matrix .rona-owner-table td:nth-child(5),.rona-prices-matrix .rona-owner-table td:nth-child(6){white-space:nowrap}',
 '.rona-prices-terms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.rona-prices-term{padding:12px;border:1px solid rgba(145,190,214,.14);border-radius:11px;background:rgba(6,12,19,.22)}.rona-prices-term span{display:block;font-size:11px;color:var(--rv-muted,#91a2b3)}.rona-prices-term strong{display:block;margin-top:5px;font-size:13px;color:#f7fbff}.rona-prices-payment{margin-top:11px;font-size:12px;line-height:1.55;color:#d5e0e7}',
 '.rona-prices-publication{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}.rona-prices-publication-main{display:grid;gap:7px}.rona-prices-publication-title{font-size:13px;font-weight:850;color:#f8fbff}.rona-prices-publication-meta{font-size:11px;color:var(--rv-muted,#91a2b3);line-height:1.5}.rona-prices-publication-controls{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.rona-prices-publication-controls select,.rona-prices-publication-controls button{font:inherit;color:inherit;background:rgba(6,12,19,.34);border:1px solid rgba(145,190,214,.20);border-radius:9px;padding:9px 11px}.rona-prices-publication-controls button{cursor:pointer;font-weight:800}',
 '.rona-prices-cp-grid{display:grid;gap:0}.rona-prices-cp-row{display:grid;grid-template-columns:minmax(220px,1.2fr) minmax(180px,.8fr) minmax(180px,.8fr) minmax(180px,.8fr);gap:12px;align-items:center;padding:13px 4px;border-bottom:1px solid rgba(144,184,205,.08);font-size:12px}.rona-prices-cp-row:last-child{border-bottom:0}.rona-prices-cp-name{font-weight:850}.rona-prices-cp-meta{color:var(--rv-muted,#91a2b3)}',
 '.rona-prices-history{display:grid;gap:0}.rona-prices-history-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 2px;border-bottom:1px solid rgba(144,184,205,.08);font-size:12px}.rona-prices-history-row:last-child{border-bottom:0}',
 '.rona-prices-empty{padding:18px;border:1px dashed rgba(145,190,214,.18);border-radius:16px;color:var(--rv-muted,#91a2b3);line-height:1.5}',
 '#nav button[data-page="prices"] .rona-price-update-nav{display:inline-flex!important;min-width:18px;height:18px;align-items:center;justify-content:center;margin-left:auto;border-radius:999px;background:#dc2626;color:#fff;font-size:10px;font-weight:900;line-height:1}',
 '@media(max-width:900px){.rona-prices-kpi-grid,.rona-prices-terms{grid-template-columns:1fr}.rona-prices-cp-row{grid-template-columns:1fr 1fr}}@media(max-width:760px){.rona-prices-cp-row{grid-template-columns:1fr}.rona-prices-publication{align-items:flex-start}}'
 ].join('');
 document.head.appendChild(s)
}

function makeHero(){
 const hero=e('section','rona-visual-hero');
 const copy=e('div');
 copy.append(
   e('div','rona-visual-kicker','RONA TRADE · OPERATIONS'),
   e('h1','rona-visual-title','Цены и маржа'),
   e('div','rona-visual-sub','Коммерческая картина: закупка, логистика, себестоимость и цена реализации.')
 );
 hero.append(copy);
 return hero
}

function host(){
 const p=page();if(!p)return null;installStyle();
 let r=q(':scope>#rona-prices-current',p);
 if(!r){
   r=e('div','rona-owner-page-content rona-prices-current-root');
   r.id='rona-prices-current';
   r.dataset.ownerPage='prices';
   p.append(r)
 }else{
   r.classList.add('rona-owner-page-content','rona-prices-current-root');
   r.dataset.ownerPage='prices'
 }
 for(const x of Array.from(p.children)){
   if(x===r){x.classList.remove('rona-prices-legacy-hidden');x.removeAttribute('aria-hidden');continue}
   x.classList.add('rona-prices-legacy-hidden');x.setAttribute('aria-hidden','true')
 }
 p.classList.remove('rona-rs-gated');
 return r
}

function notify(msg,title='Цены'){
 if(window.RONA_ADMIN_DIALOGS?.message)return window.RONA_ADMIN_DIALOGS.message(String(msg),{title});
 window.alert(String(msg))
}

async function owner(path){
 const r=await fetch(OWNER_API+'?path='+encodeURIComponent(path),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||j?.ok===false){const er=new Error(String(j?.code||'REQUEST_FAILED'));er.code=String(j?.code||'REQUEST_FAILED');throw er}
 return j.data||{}
}

async function updateApi(op,id='',method='GET',payload=null){
 const u=UPDATE_API+'?op='+encodeURIComponent(op)+(id?'&id='+encodeURIComponent(id):'');
 const init={method,credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}};
 if(method==='POST'){init.headers['content-type']='application/json';init.body=JSON.stringify(payload||{})}
 const r=await fetch(u,init),j=await r.json().catch(()=>({}));
 if(!r.ok||j?.ok===false){const er=new Error(String(j?.code||'REQUEST_FAILED'));er.code=String(j?.code||'REQUEST_FAILED');throw er}
 return j.data||{}
}

function fmt(v){
 if(v===null||v===undefined)return'—';
 if(typeof v==='number')return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4}).format(v);
 if(typeof v==='object')return JSON.stringify(v);
 return String(v)
}

function updateNav(){
 const b=nav();if(!b)return;
 let badge=q('.rona-price-update-nav',b);
 const n=Number(updates?.updateAvailableCount||0);
 if(n>0){
   if(!badge){badge=e('span','rona-owner-attention-badge rona-price-update-nav');b.append(badge)}
   badge.textContent=String(n);badge.setAttribute('aria-label','Доступны обновления цен: '+n)
 }else badge?.remove()
}

function table(headers,rows){
 const w=e('div','rona-owner-table-wrap'),t=e('table','rona-owner-table'),th=e('thead'),tr=e('tr'),tb=e('tbody');
 headers.forEach(h=>tr.append(e('th','',h)));th.append(tr);
 for(const row of rows){
   const rr=e('tr');
   for(const v of row){const td=e('td');td.append(v?.nodeType?v:document.createTextNode(v===null||v===undefined?'—':String(v)));rr.append(td)}
   tb.append(rr)
 }
 t.append(th,tb);w.append(t);return w
}

function diffRows(p){
 return (Array.isArray(p?.changes)?p.changes:[]).map(c=>[
   (c.product||'—')+(c.final_station?' · '+c.final_station:''),
   c.field_label||c.field||'—',
   e('span','rona-prices-diff-old',fmt(c.old_value)),
   e('span','rona-prices-diff-new',fmt(c.new_value)),
   e('span',c.external_projection?'rona-prices-external':'rona-prices-internal',c.external_projection?'ЛК Клиента / Агента':'Только внутреннее')
 ])
}

async function applyProposal(p){
 if(p.status!=='UPDATE_AVAILABLE')return;
 if(!window.confirm('Применить изменение? Будет создана новая версия прайс-листа. Для уже включённых ЛК Клиента и ЛК Агента она станет текущей автоматически.'))return;
 try{
   const d=await updateApi('apply',p.proposalId,'POST');
   await refreshAll(true);
   await notify('Обновление применено. Текущая версия: '+String(d.newPublicationId||'создана')+'.')
 }catch(err){await notify(err.code||err.message,'Не удалось применить обновление')}
}

async function rejectProposal(p){
 if(p.status!=='UPDATE_AVAILABLE')return;
 const reason=window.prompt('Причина отклонения (необязательно):','');
 if(reason===null)return;
 if(!window.confirm('Отклонить это предложение? Действующий прайс останется без изменений.'))return;
 try{await updateApi('reject',p.proposalId,'POST',{reason});await refreshAll(true)}
 catch(err){await notify(err.code||err.message,'Не удалось отклонить обновление')}
}

function proposalNode(p){
 const blocked=p.status==='BLOCKED';
 const c=e('section','rona-owner-card rona-prices-proposal '+(blocked?'is-blocked':'is-update'));
 const head=e('div','rona-prices-proposal-head'),left=e('div'),right=e('div','rona-owner-actions rona-prices-actions');
 left.append(
   e('div','rona-prices-proposal-title',blocked?'Требует проверки':'Предложено изменение'),
   e('div','rona-prices-proposal-meta','Операционный директор · '+dt(p.receivedAt)+' · база '+String(p.basePublicationId||'—'))
 );
 const detailBtn=e('button','','Открыть детали');detailBtn.type='button';
 const details=e('div','rona-prices-details');details.hidden=true;
 detailBtn.onclick=()=>{details.hidden=!details.hidden;detailBtn.textContent=details.hidden?'Открыть детали':'Скрыть детали'};
 right.append(detailBtn);
 if(blocked){
   right.append(e('span','rona-prices-pill warn','Заблокировано'))
 }else{
   right.append(e('span','rona-prices-pill warn','Ожидает решения'));
   const reject=e('button','rona-prices-reject','Отклонить');reject.type='button';reject.onclick=()=>rejectProposal(p);
   const apply=e('button','rona-prices-apply','Обновить');apply.type='button';apply.onclick=()=>applyProposal(p);
   right.append(reject,apply)
 }
 head.append(left,right);
 c.append(head,e('div','rona-prices-reason',p.reason||'—'));
 const rows=diffRows(p);
 details.append(rows.length?table(['Позиция','Поле','Было','Предлагается','Куда попадёт'],rows):e('div','rona-prices-empty','Состав изменений не определён.'));
 if(p.blocker)details.append(e('div','rona-prices-source','Причина блокировки: '+p.blocker));
 const refs=Array.isArray(p.sourceRefs)?p.sourceRefs.filter(Boolean):[];
 if(refs.length)details.append(e('div','rona-prices-source','Источник: '+refs.join(' · ')));
 c.append(details);
 return c
}

function activePriceRows(){
 const rows=Array.isArray(admin?.prices)?admin.prices:[];
 return rows.filter(x=>String(x?.business_status||'').toUpperCase()!=='SUPERSEDED')
}

function priceStation(v){
 const s=String(v||'').trim().toUpperCase();
 if(s.includes('ОЗИН')||s.includes('OZINK'))return'OZINKI';
 if(s.includes('САРЫ')||s.includes('SARY'))return'SARYAGASH';
 if(s.includes('НАУШ')||s.includes('NAUSH'))return'NAUSHKI';
 return''
}

function pricePeriod(rows){
 for(const x of rows||[]){
   const t=String(x?.commercial_terms||'');
   const m=t.match(/Период поставки:\s*([^;]+)/i);
   if(m&&m[1])return m[1].trim()
 }
 return'Требует подтверждения'
}

function priceGroups(rows){
 const map=new Map();
 for(const p of rows||[]){
   const product=String(p?.product||'').trim()||'Без наименования';
   if(!map.has(product))map.set(product,{product,rows:[],producers:new Set(),suppliers:new Set(),stations:{},published:true});
   const g=map.get(product);g.rows.push(p);
   const producer=String(p?.producer||'').trim(),supplier=String(p?.supplier||'').trim();
   if(producer)g.producers.add(producer);if(supplier)g.suppliers.add(supplier);
   const k=priceStation(p?.final_station||p?.basis||p?.border_crossing);if(k)g.stations[k]=p;
   if(String(p?.business_status||'').toUpperCase()!=='PUBLISHED')g.published=false
 }
 return Array.from(map.values()).map(g=>{
   g.producer=g.producers.size===1?Array.from(g.producers)[0]:null;
   g.supplier=g.suppliers.size===1?Array.from(g.suppliers)[0]:null;
   g.needsVerify=!g.producer||!g.supplier;
   return g
 })
}

function priceValue(p){
 if(!p)return e('span','rona-prices-pill','Не сформировано');
 const c=String(p.currency||'USD');
 return e('strong','',money(p.sale_price,c+'/т'))
}

function verifyPill(text){return e('span','rona-prices-pill warn',text||'Требует подтверждения')}

function kpiCard(title,value,caption){
 const c=e('section','rona-owner-card rona-prices-kpi');
 const top=e('div');top.append(e('div','rona-prices-kpi-label',title),e('div','rona-prices-kpi-value',value));
 c.append(top,e('div','rona-prices-kpi-caption',caption));return c
}

function kpiGrid(rows,groups){
 const grid=e('div','rona-prices-kpi-grid');
 const publishedRows=rows.filter(x=>String(x?.business_status||'').toUpperCase()==='PUBLISHED');
 const verifyGroups=groups.filter(x=>x.needsVerify);
 const period=pricePeriod(rows);
 const client=!!updates?.clientEnabled,agent=!!updates?.agentEnabled;
 const audience=client&&agent?'Клиентам и агентам':client?'Клиентам':agent?'Агентам':'Аудитория требует проверки';
 grid.append(
   kpiCard('Действующий прайс',period,'USD/т · CPT · Incoterms 2020'),
   kpiCard('Позиций опубликовано',String(publishedRows.length),audience),
   kpiCard('Требует обновления',String(verifyGroups.length),verifyGroups.length?'Производитель / поставщик требуют подтверждения':'Подтверждённые данные заполнены')
 );
 return grid
}

function filterBar(){
 const bar=e('div','rona-prices-filter');
 [['ALL','Все'],['PUBLISHED','Опубликовано'],['VERIFY','Требует подтверждения']].forEach(a=>{
   const b=e('button','',a[1]);b.type='button';b.setAttribute('aria-pressed',String(ownerPriceFilter===a[0]));
   b.onclick=()=>{ownerPriceFilter=a[0];render()};bar.append(b)
 });
 return bar
}

function pricesCard(rows,groups){
 const visible=groups.filter(g=>ownerPriceFilter==='VERIFY'?g.needsVerify:ownerPriceFilter==='PUBLISHED'?g.published:true);
 const body=visible.map(g=>[
   g.product,
   g.producer||verifyPill('Требует подтверждения'),
   g.supplier||verifyPill('Требует подтверждения'),
   priceValue(g.stations.OZINKI),
   priceValue(g.stations.SARYAGASH),
   priceValue(g.stations.NAUSHKI)
 ]);
 const card=e('section','rona-owner-card rona-prices-matrix'),head=e('div','rona-prices-card-head');
 head.append(e('h2','','Действующие цены'),filterBar());card.append(head);
 card.append(body.length?table(['Продукт','Производитель','Поставщик','CPT Ozinki','CPT Saryagash','CPT Naushki'],body):e('div','rona-prices-empty','По выбранному фильтру позиций нет.'));
 return card
}

function termsCard(rows){
 const card=e('section','rona-owner-card'),head=e('div','rona-prices-card-head'),grid=e('div','rona-prices-terms');
 head.append(e('h2','','Условия прайса'));
 const period=pricePeriod(rows);
 [['Период',period],['Базис','CPT · Incoterms 2020'],['Единица цены','USD / тонна']].forEach(x=>{
   const t=e('div','rona-prices-term');t.append(e('span','',x[0]),e('strong','',x[1]));grid.append(t)
 });
 const payment=String(rows.find(x=>String(x?.payment_terms||'').trim())?.payment_terms||'Требует подтверждения');
 card.append(head,grid,e('div','rona-prices-payment',payment));return card
}

async function saveAudience(client,agent){
 if(!window.confirm('Изменить доступ к текущему прайс-листу?'))return;
 try{
   await updateApi('audience','','POST',{client,agent});
   await refreshAll(true);
   await notify('Публикация прайса обновлена.')
 }catch(err){await notify(err.code||err.message,'Не удалось изменить публикацию')}
}

function publicationCard(){
 const card=e('section','rona-owner-card rona-prices-publication'),main=e('div','rona-prices-publication-main'),controls=e('div','rona-prices-publication-controls');
 const client=!!updates?.clientEnabled,agent=!!updates?.agentEnabled;
 main.append(
   e('div','rona-prices-publication-title','Публикация прайса'),
   e('div','rona-prices-publication-meta','Действующий прайс: '+String(updates?.currentPublicationId||'—')+' · Клиенты: '+(client?'опубликовано':'не опубликовано')+' · Агенты: '+(agent?'опубликовано':'не опубликовано')+' · Проверено: '+dt(updates?.generatedAt))
 );
 const audience=document.createElement('select');
 [['BOTH','Клиенты и агенты'],['CLIENTS','Только клиенты'],['AGENTS','Только агенты'],['NONE','Снять публикацию']].forEach(a=>{const o=document.createElement('option');o.value=a[0];o.textContent=a[1];audience.append(o)});
 audience.value=client&&agent?'BOTH':client?'CLIENTS':agent?'AGENTS':'NONE';
 const apply=e('button','','Применить публикацию');apply.type='button';
 apply.onclick=()=>{const v=audience.value;saveAudience(v==='BOTH'||v==='CLIENTS',v==='BOTH'||v==='AGENTS')};
 controls.append(audience,apply);card.append(main,controls);return card
}

function signalCard(available){
 const card=e('section','rona-owner-card rona-prices-signal'),inner=e('div','rona-prices-signal-inner'),txt=e('div');
 txt.append(
   e('div','rona-prices-signal-title','Данные обновлены'),
   e('div','rona-prices-signal-sub','Получено '+available.length+' '+(available.length===1?'предложение':'предложения')+' от Операционного директора. Текущий прайс и внешние кабинеты остаются без изменений до команды «Обновить».')
 );
 inner.append(txt,e('span','rona-prices-pill bad','Требуется решение'));card.append(inner);return card
}

function cpStatus(v){
 const m={REQUESTED:['Требуется новое КП','warn'],GENERATED:['Сформировано','warn'],OWNER_REVIEWED:['Просмотрено владельцем','ok'],SENT:['Отправлено','ok'],BLOCKED:['Заблокировано','bad'],RETIRED:['Архив',''],STALE_PRICE_SOURCE:['Неактуален — цена изменена','bad']};
 return m[String(v||'')]||[String(v||'—'),'']
}

function cpCard(){
 const xs=Array.isArray(updates?.agentCommercialProposals)?updates.agentCommercialProposals:[];
 if(!xs.length)return null;
 const card=e('section','rona-owner-card'),head=e('div','rona-prices-card-head'),grid=e('div','rona-prices-cp-grid');
 head.append(e('h2','','КП агентам'),e('div','rona-prices-card-sub','Состояние коммерческих предложений, связанных с текущими и предыдущими версиями прайса.'));
 for(const x of xs){
   const st=cpStatus(x.status),row=e('div','rona-prices-cp-row');
   row.append(
     e('div','rona-prices-cp-name',x.agentName||x.agentId||'—'),
     e('div','rona-prices-cp-meta','Прайс: '+String(x.publicationId||'—')),
     e('span','rona-prices-pill '+(st[1]||''),st[0]),
     e('div','rona-prices-cp-meta',x.sentAt?'Отправлено '+dt(x.sentAt):x.ownerReviewedAt?'Просмотрено '+dt(x.ownerReviewedAt):x.generatedAt?'Сформировано '+dt(x.generatedAt):'PDF ещё не сформирован')
   );
   grid.append(row)
 }
 card.append(head,grid);return card
}

function historyCard(){
 const xs=Array.isArray(updates?.history)?updates.history:[];
 if(!xs.length)return null;
 const card=e('section','rona-owner-card'),head=e('div','rona-prices-card-head'),box=e('div','rona-prices-history');
 head.append(e('h2','','История решений'),e('div','rona-prices-card-sub','Последние решения владельца по изменениям прайс-листа.'));
 for(const x of xs.slice(0,8)){
   const r=e('div','rona-prices-history-row'),left=e('div'),status=String(x.status||'');
   left.append(
     e('strong','',status==='APPLIED'?'Обновление применено':status==='REJECTED'?'Предложение отклонено':'Предложение устарело'),
     e('div','rona-prices-proposal-meta',(x.basePublicationId||'—')+(x.newPublicationId?' → '+x.newPublicationId:'')+' · '+dt(x.appliedAt||x.rejectedAt||x.receivedAt))
   );
   r.append(left,e('span','rona-prices-pill '+(status==='APPLIED'?'ok':status==='REJECTED'?'bad':''),status));box.append(r)
 }
 card.append(head,box);return card
}

function render(){
 const r=host();if(!r)return false;
 updateNav();r.replaceChildren(makeHero());
 const pending=Array.isArray(updates?.proposals)?updates.proposals:[],available=pending.filter(x=>x.status==='UPDATE_AVAILABLE');
 if(available.length)r.append(signalCard(available));
 if(pending.length){const ps=e('div','rona-prices-proposals');pending.forEach(p=>ps.append(proposalNode(p)));r.append(ps)}
 const rows=activePriceRows(),groups=priceGroups(rows);
 if(rows.length){
   r.append(kpiGrid(rows,groups),pricesCard(rows,groups),termsCard(rows),publicationCard())
 }else{
   r.append(e('section','rona-owner-card rona-prices-empty','Согласованные цены из контура Операционного директора пока не поступили.'),publicationCard())
 }
 const cp=cpCard();if(cp)r.append(cp);
 const hc=historyCard();if(hc)r.append(hc);
 window.__RONA_PRICES_CURRENT_STATE__={generatedAt:updates?.generatedAt||null,currentPublicationId:updates?.currentPublicationId||null,clientEnabled:!!updates?.clientEnabled,agentEnabled:!!updates?.agentEnabled,updateAvailableCount:Number(updates?.updateAvailableCount||0)};
 return true
}

async function refreshAll(force=false){
 if(loading&&!force)return;loading=true;
 try{
   const [a,u]=await Promise.all([owner('/admin/bootstrap'),updateApi('bootstrap')]);
   admin=a;updates=u;window.__RONA_OWNER_ADMIN_SNAPSHOT__=a;window.__RONA_PRICES_CURRENT_ERROR__=null;render()
 }catch(err){
   window.__RONA_PRICES_CURRENT_ERROR__=String(err?.code||err?.message||err);
   const r=host();if(r){r.replaceChildren(makeHero(),e('div','rona-owner-card rona-prices-empty','Раздел «Цены» временно недоступен: '+window.__RONA_PRICES_CURRENT_ERROR__))}
 }finally{loading=false}
}

function ensure(){
 const p=page();if(!p)return;host();render();
 if(!timer)timer=setInterval(()=>{if(page()?.classList.contains('active'))refreshAll()},30000)
}

document.addEventListener('click',ev=>{
 const b=ev.target?.closest?.('#nav button[data-page]');
 if(b?.dataset.page==='prices'){setTimeout(()=>refreshAll(true),0);setTimeout(ensure,120)}
},true);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(ensure,0);setTimeout(()=>refreshAll(true),200)},{once:true});
else{setTimeout(ensure,0);setTimeout(()=>refreshAll(true),200)}

const obs=new MutationObserver(()=>{
 const p=page();if(!p)return;const r=q(':scope>#rona-prices-current',p);
 if(r){for(const x of Array.from(p.children))if(x!==r&&!x.classList.contains('rona-prices-legacy-hidden')){x.classList.add('rona-prices-legacy-hidden');x.setAttribute('aria-hidden','true')}}
});
setTimeout(()=>{const p=page();if(p)obs.observe(p,{childList:true})},1000);
})();`;

export async function onRequest(){
 return new Response(SCRIPT,{status:200,headers:{
   'content-type':'application/javascript; charset=utf-8',
   'cache-control':'no-store, no-cache, must-revalidate',
   'pragma':'no-cache',
   'expires':'0',
   'x-content-type-options':'nosniff',
   'x-rona-prices-ui':'owner-update-gate-v3-canonical-2a',
   'x-rona-prices-visual':'canonical-v2-restored',
   'x-rona-prices-structure':'prices-2a-canonical'
 }})
}
