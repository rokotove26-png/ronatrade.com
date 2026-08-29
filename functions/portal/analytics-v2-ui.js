import { onRequest as approvedAnalytics } from './analytics-v2-approved-base.js';

const CANONICAL_ANALYTICS_SOURCE='RONA_Admin_LK_LIVE_Market_Intelligence_v2';
const CANONICAL_ANALYTICS_MARKER='live-market-intelligence-v2';

const FAIL_CLOSED_GUARD=String.raw`
;(()=>{
  if(document.getElementById('ronaAnalyticsLiveDataGuardV2'))return;
  const s=document.createElement('style');
  s.id='ronaAnalyticsLiveDataGuardV2';
  s.textContent='#page-analytics #rona-analytics-v2{visibility:hidden!important;opacity:0!important}';
  document.head.append(s);
})();
`;

const LIVE_ANALYTICS_RUNTIME=String.raw`
;(()=>{'use strict';
  if(window.__RONA_ANALYTICS_LIVE_DATA_RUNTIME__==='owner-bootstrap-v2')return;
  window.__RONA_ANALYTICS_LIVE_DATA_RUNTIME__='owner-bootstrap-v2';
  const ENDPOINT='/portal/api/v1/admin/analytics';
  const REFRESH_MS=30*1000;
  const PRODUCT_DEFS={
    AI92:{label:'АИ-92',match:['АИ-92']},
    AI95:{label:'АИ-95',match:['АИ-95']},
    DT:{label:'ДТ',match:['ДТ']},
    NAFTA:{label:'Нафта',match:['НАФТА','Нафта']},
    LPG:{label:'LPG / СУГ',match:['СУГ / СПБТ','LPG / СУГ','СУГ']}
  };
  const state={data:null,error:null,product:'AI92',timer:null,refreshing:false,lastPublicationId:null,observedRoot:null,observer:null};
  const q=(s,r=document)=>r.querySelector(s);
  const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};
  const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const fmt=(v,d=2)=>finite(v)===null?'—':new Intl.NumberFormat('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(v));
  const dateRu=v=>{if(!v)return '—';const s=String(v).slice(0,10),m=s.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);return m?m[3]+'.'+m[2]+'.'+m[1]:s};
  const monthRu=v=>{const s=String(v||''),m=s.match(/^(\\d{4})-(\\d{2})$/);return m?m[2]+'.'+m[1]:'09.2026'};
  const root=()=>q('#page-analytics #rona-analytics-v2')||q('#rona-analytics-v2');
  function card(title){const c=el('section','rona-owner-card');if(title)c.append(el('h2','',title));for(let i=1;i<arguments.length;i++)if(arguments[i])c.append(arguments[i]);return c}
  function pill(text,tone='neutral'){return el('span','rona-fin-pill rona-fin-pill--'+tone,text)}
  function kpi(title,value,caption){return card(title,el('div','rona-owner-kpi',value),el('div','rona-owner-muted',caption))}
  function installStyles(){
    if(q('#ronaAnalyticsLiveDataStyleV2'))return;
    q('#ronaAnalyticsLiveDataStyleV1')?.remove();
    const s=el('style');s.id='ronaAnalyticsLiveDataStyleV2';s.textContent=[
      '#page-analytics #rona-analytics-v2 .an2-live-status{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '#page-analytics #rona-analytics-v2 .an2-live-source-gap{border-left:3px solid var(--warn,#efc978);padding:10px 12px;background:rgba(239,201,120,.06);font-size:12px;line-height:1.5}',
      '#page-analytics #rona-analytics-v2 .an2-live-current{display:grid;gap:12px}',
      '#page-analytics #rona-analytics-v2 .an2-live-current h3{margin:0;font-size:15px}',
      '#page-analytics #rona-analytics-v2 .an2-live-current p{margin:0;line-height:1.62;font-size:13px}',
      '#page-analytics #rona-analytics-v2 .an2-live-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '#page-analytics #rona-analytics-v2 .an2-live-controls button{font:inherit;color:inherit;background:transparent;border:1px solid var(--line,rgba(255,255,255,.22));border-radius:9px;padding:8px 11px;cursor:pointer;font-weight:700}',
      '#page-analytics #rona-analytics-v2 .an2-live-controls button[aria-pressed="true"]{box-shadow:inset 0 0 0 1px currentColor;background:rgba(255,255,255,.06)}',
      '#page-analytics #rona-analytics-v2 .an2-live-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,.66fr);gap:20px;align-items:stretch}',
      '#page-analytics #rona-analytics-v2 .an2-live-chart{min-height:330px}',
      '#page-analytics #rona-analytics-v2 .an2-live-chart svg{display:block;width:100%;height:300px;overflow:visible}',
      '#page-analytics #rona-analytics-v2 .an2-live-side{display:grid;align-content:start;gap:4px}',
      '#page-analytics #rona-analytics-v2 .an2-live-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:baseline;padding:10px 2px;border-bottom:1px solid var(--line-soft,rgba(255,255,255,.12))}',
      '#page-analytics #rona-analytics-v2 .an2-live-row span{font-size:11px;opacity:.75}',
      '#page-analytics #rona-analytics-v2 .an2-live-row strong{font-size:17px;font-variant-numeric:tabular-nums}',
      '#page-analytics #rona-analytics-v2 .an2-live-meta{display:grid;gap:5px;margin-top:12px;font-size:11px;line-height:1.45;opacity:.78}',
      '#page-analytics #rona-analytics-v2 .an2-live-extra{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}',
      '#page-analytics #rona-analytics-v2 .an2-live-extra .rona-owner-card{min-width:0}',
      '#page-analytics #rona-analytics-v2 .an2-live-fail{padding:18px;border:1px solid rgba(255,140,151,.45);border-radius:14px;background:rgba(255,140,151,.06);line-height:1.6}',
      '@media(max-width:1050px){#page-analytics #rona-analytics-v2 .an2-live-grid{grid-template-columns:1fr}}',
      '@media(max-width:680px){#page-analytics #rona-analytics-v2 .an2-live-controls{display:grid}#page-analytics #rona-analytics-v2 .an2-live-controls button{width:100%}}'
    ].join('');document.head.append(s);
  }
  function itemFor(key){
    const items=state.data?.currentAnalytics?.items||[],def=PRODUCT_DEFS[key];
    if(!def)return null;
    return items.find(i=>def.match.some(m=>String(i?.product||'').toUpperCase()===String(m).toUpperCase()))||null;
  }
  function currentChart(item){const c=item?.public_chart;return c&&Array.isArray(c.labels)&&Array.isArray(c.values)&&c.labels.length===c.values.length?c:null}
  function chartSvg(labels,values){
    const nums=values.map(finite);if(nums.some(v=>v===null)||!nums.length)return el('div','an2-empty','Нет подтверждённого ряда для отображения.');
    const ns='http://www.w3.org/2000/svg',w=900,h=285,p={l:72,r:30,t:42,b:52};
    const min=Math.min(...nums),max=Math.max(...nums),span=Math.max(1,max-min),lo=min-span*.22,hi=max+span*.22;
    const x=i=>p.l+(w-p.l-p.r)*(nums.length===1?0:i/(nums.length-1)),y=v=>p.t+(h-p.t-p.b)*(1-(v-lo)/(hi-lo));
    const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.dataset.ronaLiveChart='v2';
    for(let i=0;i<5;i++){const yy=p.t+(h-p.t-p.b)*i/4,line=document.createElementNS(ns,'line');line.setAttribute('x1',p.l);line.setAttribute('x2',w-p.r);line.setAttribute('y1',yy);line.setAttribute('y2',yy);line.setAttribute('class','an2-gridline');svg.append(line);const tx=document.createElementNS(ns,'text');tx.setAttribute('x','5');tx.setAttribute('y',String(yy+4));tx.setAttribute('class','an2-axis');tx.textContent=fmt(hi-(hi-lo)*i/4,0);svg.append(tx)}
    const poly=document.createElementNS(ns,'polyline');poly.setAttribute('points',nums.map((v,i)=>x(i)+','+y(v)).join(' '));poly.setAttribute('class','an2-line');svg.append(poly);
    nums.forEach((v,i)=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',x(i));c.setAttribute('cy',y(v));c.setAttribute('r','5');c.setAttribute('class','an2-dot');svg.append(c);const val=document.createElementNS(ns,'text');val.setAttribute('x',x(i));val.setAttribute('y',y(v)-13);val.setAttribute('text-anchor','middle');val.setAttribute('class','an2-point-value');val.textContent=fmt(v,2);svg.append(val);const lab=document.createElementNS(ns,'text');lab.setAttribute('x',x(i));lab.setAttribute('y',h-15);lab.setAttribute('text-anchor','middle');lab.setAttribute('class','an2-axis');lab.textContent=String(labels[i]||'');svg.append(lab)});
    return svg;
  }
  function sourceState(item,chart){
    const stateCode=String(chart?.source_freshness_state||'');
    const latest=chart?.latest_source_date||chart?.source_date||item?.analytics_as_of;
    const expected=chart?.expected_source_date||'';
    return {gap:stateCode==='SOURCE_GAP',latest,expected,stateCode};
  }
  function releaseGuard(){q('#ronaAnalyticsLiveDataGuardV2')?.remove();q('#ronaAnalyticsLiveDataGuardV1')?.remove()}
  function render(){
    const r=root();if(!r||!state.data?.currentAnalytics)return false;installStyles();
    const current=state.data.currentAnalytics,item=itemFor(state.product)||itemFor('AI92'),chart=currentChart(item);
    if(!item||!chart)return renderFailure('Для выбранного продукта отсутствует подтверждённый public_chart. Старый snapshot не используется.');
    const src=sourceState(item,chart),targetMonth=monthRu(chart.target_month||'2026-09');
    r.replaceChildren();const title=el('div','rona-analytics-canonical-title');title.append(el('div','rona-analytics-canonical-title-text','Аналитика'));r.append(title);r.dataset.ronaLiveRoot='owner-bootstrap-v2';r.dataset.publicationId=String(current.publication_id||'');
    const head=el('section','rona-owner-card an2-head'),copy=el('div');copy.append(el('h1','','Аналитика'),el('p','rona-owner-muted','Рыночная аналитика Коммерческого директора. Экран строится только из текущей VERIFIED/PUBLISHED публикации Market Intelligence; исторические LOW / BASE / HIGH не используются как текущий прогноз.'));const status=el('div','an2-live-status');status.append(pill('LIVE DATA','success'),pill(src.gap?'РАЗРЫВ ДАННЫХ':'ИСТОЧНИК АКТУАЛЕН',src.gap?'warn':'success'));head.append(copy,status);r.append(head);
    const kpis=el('div','an2-kpis');kpis.append(kpi('Platts',dateRu(src.latest),'Последний подтверждённый источник'),kpi('Argus','Нет ряда','Только требуемый Argus European Products / EUROBOB Oxy'),kpi('Горизонт',targetMonth,String(chart.chart_semantics||'ФАКТ / MTD / FORWARD')));r.append(kpis);
    const controls=card('Базовая котировка'),bar=el('div','an2-live-controls');for(const key of Object.keys(PRODUCT_DEFS)){if(!itemFor(key))continue;const b=el('button','',PRODUCT_DEFS[key].label);b.type='button';b.setAttribute('aria-pressed',state.product===key?'true':'false');b.onclick=()=>{state.product=key;render()};bar.append(b)}bar.append(el('span','rona-owner-muted','Источник: '+(state.product==='LPG'?'Petromarket / Market Intelligence':'Platts / Market Intelligence')));controls.append(bar);r.append(controls);
    const main=el('div','an2-live-grid'),cc=card('Динамика '+PRODUCT_DEFS[state.product].label+' · '+String(chart.unit||'USD/т'));cc.classList.add('an2-live-chart');cc.append(chartSvg(chart.labels,chart.values),el('div','rona-owner-muted an2-basis',String(item.basis||item.headline||'')));const side=card(state.product==='LPG'?'Региональный срез':'Рыночный срез на '+targetMonth);side.classList.add('an2-live-side');chart.labels.forEach((label,i)=>{const row=el('div','an2-live-row');row.append(el('span','',String(label)),el('strong','',fmt(chart.values[i],2)+' '+String(chart.unit||'USD/т')));side.append(row)});const meta=el('div','an2-live-meta');meta.append(el('div','','Публикация: '+String(current.publication_id||'—')),el('div','','Актуализация: '+dateRu(current.published_at)),el('div','','Последний источник: '+dateRu(src.latest)));if(src.expected)meta.append(el('div','','Ожидаемый торговый день: '+dateRu(src.expected)));meta.append(el('div','','Статус источника: '+(src.gap?'РАЗРЫВ ДАННЫХ':'ПОДТВЕРЖДЕНО')));side.append(meta);main.append(cc,side);r.append(main);
    if(src.gap)r.append(el('div','an2-live-source-gap','В контуре отсутствует ожидаемый свежий источник. Система не достраивает значения и не показывает старый сценарий как текущий. До поступления нового подтверждённого выпуска используются только явно датированные последние данные.'));
    const currentBox=card('Аналитический вывод'),inner=el('div','an2-live-current');inner.append(el('h3','',String(item.headline||PRODUCT_DEFS[state.product].label)),el('p','',String(item.content_text||'Нет текста аналитического вывода.')),el('div','rona-owner-muted','Источник аналитики: '+String(current.source_system||'RONA Market Intelligence')+' · '+String(current.source_version||'')+' · публикация '+dateRu(current.published_at)));currentBox.append(inner);r.append(currentBox);
    const extras=el('div','an2-live-extra');for(const extra of (current.items||[])){if(['Логистика','Коммерческий прайс','БНК — формульный контроль'].includes(String(extra.product||''))){const c=card(String(extra.product||''));c.append(el('div','an2-live-current',String(extra.content_text||extra.headline||'')));extras.append(c)}}if(extras.children.length)r.append(extras);
    document.documentElement.dataset.ronaAnalyticsUi='live-market-intelligence-v2';window.__RONA_ANALYTICS_LIVE_READY__=true;releaseGuard();return true;
  }
  function renderFailure(message){
    const r=root();if(!r)return false;installStyles();r.replaceChildren();r.dataset.ronaLiveRoot='owner-bootstrap-v2';r.dataset.publicationId='';const box=el('div','an2-live-fail');box.append(el('strong','','Актуальные аналитические данные недоступны.'),el('div','',String(message||'Ошибка загрузки текущей публикации.')),el('div','rona-owner-muted','Устаревший локальный snapshot намеренно скрыт.'));r.append(box);releaseGuard();return true;
  }
  function liveDomIsCurrent(r){
    if(!r||!state.data?.currentAnalytics)return false;
    const id=String(state.data.currentAnalytics.publication_id||'');
    return r.dataset.ronaLiveRoot==='owner-bootstrap-v2'&&r.dataset.publicationId===id&&!!r.querySelector('.rona-analytics-canonical-title')&&!!r.querySelector('.an2-live-current')&&!!r.querySelector('[data-rona-live-chart="v2"]');
  }
  function ensureLive(){const r=root();if(!r)return false;if(state.data){if(!liveDomIsCurrent(r))render()}else if(state.error&&!r.querySelector('.an2-live-fail'))renderFailure(state.error);return true}
  function bindRoot(){
    const r=root();if(!r)return false;
    if(state.observedRoot!==r){state.observer?.disconnect();state.observedRoot=r;state.observer=new MutationObserver(()=>queueMicrotask(()=>{if(root()!==state.observedRoot)bindRoot();ensureLive()}));state.observer.observe(r,{childList:true,subtree:false})}
    ensureLive();return true;
  }
  async function load(){
    if(state.refreshing)return;state.refreshing=true;bindRoot();
    try{
      const response=await fetch(ENDPOINT+'?ts='+Date.now(),{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      const body=await response.json().catch(()=>null),current=body?.data?.currentAnalytics;
      if(!response.ok||body?.ok!==true||!current||current.status!=='PUBLISHED'||current.audience!=='ALL_CLIENTS'||current.authority_state!=='VERIFIED'||!Array.isArray(current.items))throw new Error('ANALYTICS_LIVE_BOOTSTRAP_INVALID');
      state.data=body.data;state.error=null;state.lastPublicationId=current.publication_id||null;if(!itemFor(state.product))state.product='AI92';bindRoot();render();
    }catch(err){state.error=String(err?.message||err||'ANALYTICS_LIVE_LOAD_FAILED');bindRoot();renderFailure(state.error)}finally{state.refreshing=false}
  }
  let tries=0;(function waitForRoot(){if(bindRoot())return;tries++;if(tries<1200)setTimeout(waitForRoot,50)})();
  load();
  state.timer=setInterval(()=>{bindRoot();if(document.visibilityState==='visible')load()},REFRESH_MS);
  window.addEventListener('focus',()=>{bindRoot();load()},{passive:true});
  window.addEventListener('pageshow',()=>{bindRoot();load()},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){bindRoot();load()}});
  window.addEventListener('rona:admin-pagechange',event=>{if(String(event?.detail?.page||'')==='analytics'){bindRoot();load();setTimeout(bindRoot,50);setTimeout(bindRoot,250)}});
  window.addEventListener('rona:admin-single-owner-ready',()=>{bindRoot();load()},{passive:true});
})();
`;

const LIVE_BALANCED_LAYOUT_PATCH=String.raw`;(()=>{const old=document.getElementById('ronaAnalyticsBalancedLayoutV1');if(old)old.remove();if(document.getElementById('ronaAnalyticsBalancedLayoutV2'))return;const s=document.createElement('style');s.id='ronaAnalyticsBalancedLayoutV2';s.textContent=[
'#page-analytics #rona-analytics-v2.an2{width:min(100%,1520px)!important;max-width:1520px!important;margin-left:auto!important;margin-right:auto!important;gap:14px!important;padding:0 clamp(10px,1vw,18px) 20px!important;box-sizing:border-box!important}',
'#page-analytics #rona-analytics-v2 .an2-head{gap:14px!important}#page-analytics #rona-analytics-v2 .an2-head p{max-width:780px!important}',
'#page-analytics #rona-analytics-v2 .an2-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;min-width:0!important}',
'#page-analytics #rona-analytics-v2 .an2-live-grid{grid-template-columns:minmax(0,1.52fr) minmax(330px,.78fr)!important;gap:14px!important;align-items:stretch!important;min-width:0!important}',
'#page-analytics #rona-analytics-v2 .an2-live-chart{min-height:360px!important}#page-analytics #rona-analytics-v2 .an2-live-chart svg{height:310px!important}',
'#page-analytics #rona-analytics-v2 .an2-live-side{height:100%!important;box-sizing:border-box!important}',
'#page-analytics #rona-analytics-v2 .an2-rona{gap:10px!important}#page-analytics #rona-analytics-v2 .an2-live-extra{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;min-width:0!important}',
'#page-analytics #rona-analytics-v2 .an2-price-card{min-width:0!important}#page-analytics #rona-analytics-v2 .an2-price-base{font-size:22px!important}',
'@media(max-width:1280px){#page-analytics #rona-analytics-v2.an2{width:100%!important;max-width:none!important}#page-analytics #rona-analytics-v2 .an2-live-grid{grid-template-columns:minmax(0,1.45fr) minmax(300px,.72fr)!important}}',
'@media(max-width:1050px){#page-analytics #rona-analytics-v2 .an2-live-grid{grid-template-columns:1fr!important}#page-analytics #rona-analytics-v2 .an2-live-chart{min-height:340px!important}#page-analytics #rona-analytics-v2 .an2-live-chart svg{height:295px!important}#page-analytics #rona-analytics-v2 .an2-live-extra{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))!important}}',
'@media(max-width:680px){#page-analytics #rona-analytics-v2.an2{padding-left:0!important;padding-right:0!important}#page-analytics #rona-analytics-v2 .an2-kpis{grid-template-columns:1fr!important}#page-analytics #rona-analytics-v2 .an2-live-extra{grid-template-columns:1fr!important}#page-analytics #rona-analytics-v2 .an2-live-chart svg{height:270px!important}}'
].join('');document.head.append(s)})();`;

const LIVE_CANONICAL_HOME_VISUAL_PATCH=String.raw`;(()=>{const old=document.getElementById('ronaAnalyticsCanonicalHomeVisualV1');if(old)old.remove();const s=document.createElement('style');s.id='ronaAnalyticsCanonicalHomeVisualV1';s.textContent=[
'#current-admin-main #page-analytics #rona-analytics-v2.an2{--an2-text-primary:#e8f1f6;--an2-text-secondary:#9eb3c1;--an2-heading:#dbe8ef;--an2-heading-soft:#bdd0db;--an2-cyan:#65d9ff;--an2-blue:#8db7ff;--an2-green:#8bdcb4;--an2-amber:#efc978;--an2-red:#ff8c97;color:var(--an2-text-primary)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .rona-analytics-canonical-title{position:sticky!important;top:0!important;z-index:2147481200!important;display:flex!important;visibility:visible!important;opacity:1!important;align-items:center!important;min-height:48px!important;box-sizing:border-box!important;margin:0 0 14px!important;padding:10px 14px!important;border:1px solid var(--line-soft,rgba(255,255,255,.14))!important;border-radius:12px!important;background:rgba(6,18,31,.94)!important;-webkit-backdrop-filter:blur(12px) saturate(120%)!important;backdrop-filter:blur(12px) saturate(120%)!important;box-shadow:0 8px 24px rgba(0,0,0,.16)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .rona-analytics-canonical-title-text{font-size:22px!important;font-weight:850!important;line-height:1.2!important;letter-spacing:.01em!important;color:inherit!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;flex-wrap:wrap!important;gap:14px!important;min-height:0!important;margin:0!important;padding:16px!important;border:1px solid var(--line,rgba(255,255,255,.18))!important;border-radius:14px!important;background:transparent!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;color:inherit!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head h1{display:none!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head .rona-visual-kicker{display:none!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head p,#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head .rona-visual-sub{max-width:900px!important;margin:0!important;color:var(--an2-text-secondary)!important;font-size:12px!important;line-height:1.5!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-card,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-live-side{border:1px solid var(--line,rgba(255,255,255,.18))!important;border-radius:14px!important;background:transparent!important;box-shadow:none!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-live-side{padding:16px!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-card>h2,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-title,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-rona-head h2{color:var(--an2-heading)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-card>h3,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-price-card h3{color:var(--an2-heading-soft)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-kpi,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-price-base{color:var(--an2-cyan)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-muted,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-sub,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-live-meta,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-basis,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-price-current,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-model-note{color:var(--an2-text-secondary)!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-live-chart{color:var(--an2-cyan)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-axis{fill:var(--an2-text-secondary)!important;opacity:.84!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-point-value{fill:#dff7ff!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-live-controls button{color:#c7d7e1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-live-controls button[aria-pressed="true"]{color:var(--an2-cyan)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-live-row span:first-child{color:var(--an2-text-secondary)!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-live-row strong{color:#e6eef3!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-live-current{color:#cbdbe5!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.rona-owner-card:last-child>h2{color:var(--an2-amber)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--info{color:var(--an2-blue)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--success{color:var(--an2-green)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--warn{color:var(--an2-amber)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--danger{color:var(--an2-red)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--neutral{color:var(--an2-text-secondary)!important}',
'@media(max-width:720px){#current-admin-main #page-analytics #rona-analytics-v2 .rona-analytics-canonical-title{min-height:44px!important;padding:9px 12px!important;margin-bottom:10px!important}#current-admin-main #page-analytics #rona-analytics-v2 .rona-analytics-canonical-title-text{font-size:19px!important}}',
'@media(max-width:680px){#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head{min-height:0!important;padding:14px!important;border-radius:14px!important}}'
].join('');document.head.append(s);window.__RONA_ANALYTICS_CANONICAL_HOME_VISUAL__='v1';})();`;

const LIVE_DESIGNER_CHART_PATCH=String.raw`;(()=>{if(document.getElementById('ronaAnalyticsDesignerChartV2'))return;const prior=document.getElementById('ronaAnalyticsDesignerChartV1');if(prior)prior.remove();const s=document.createElement('style');s.id='ronaAnalyticsDesignerChartV2';s.textContent=[
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-live-chart{overflow:hidden!important;background:linear-gradient(180deg,rgba(8,24,38,.34),rgba(3,12,20,.08))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 14px 36px rgba(0,0,0,.12)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-live-chart svg{border-radius:18px!important;filter:drop-shadow(0 22px 40px rgba(0,0,0,.30))!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-live-chart .an2-gridline{opacity:.12!important;stroke-dasharray:2 8!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-live-chart .an2-line{stroke-width:4.8!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-live-chart .an2-dot{stroke:#e9fbff!important;stroke-width:1.8!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-live-chart .an2-point-value{paint-order:stroke!important;stroke:rgba(3,13,22,.96)!important;stroke-width:3.8px!important}',
'@media(max-width:680px){#current-admin-main #page-analytics #rona-analytics-v2 .an2-live-chart svg{border-radius:13px!important}}'
].join('');document.head.append(s);
const ns='http://www.w3.org/2000/svg';
function n(name,attrs){const x=document.createElementNS(ns,name);for(const k in attrs)x.setAttribute(k,String(attrs[k]));return x}
function stop(offset,color,opacity){return n('stop',{offset:offset,'stop-color':color,'stop-opacity':opacity})}
function enhance(svg){if(!svg||svg.dataset.ronaDesignerChart==='v2')return;const line=svg.querySelector('.an2-line');if(!line)return;svg.dataset.ronaDesignerChart='v2';window.__RONA_ANALYTICS_CHART_SEQ__=(window.__RONA_ANALYTICS_CHART_SEQ__||0)+1;const uid='ronaAn2Chart'+window.__RONA_ANALYTICS_CHART_SEQ__,defs=n('defs',{}),panelId=uid+'Panel',areaId=uid+'Area',strokeId=uid+'Stroke',glowId=uid+'Glow',spotId=uid+'Spot';
const panel=n('linearGradient',{id:panelId,x1:'0',y1:'0',x2:'0',y2:'1'});panel.append(stop('0%','#0d2a40',.96),stop('48%','#081c2c',.88),stop('100%','#03101a',.96));
const area=n('linearGradient',{id:areaId,x1:'0',y1:'0',x2:'0',y2:'1'});area.append(stop('0%','#65d9ff',.42),stop('46%','#4ba7d4',.17),stop('100%','#071826',.015));
const stroke=n('linearGradient',{id:strokeId,x1:'0',y1:'0',x2:'1',y2:'0'});stroke.append(stop('0%','#b8f3ff',1),stop('42%','#65d9ff',1),stop('100%','#8db7ff',1));
const spot=n('linearGradient',{id:spotId,x1:'0',y1:'0',x2:'0',y2:'1'});spot.append(stop('0%','#8ce7ff',.48),stop('100%','#65d9ff',0));
const glow=n('filter',{id:glowId,x:'-24%',y:'-40%',width:'148%',height:'190%'});glow.append(n('feDropShadow',{dx:'0',dy:'4',stdDeviation:'5','flood-color':'#65d9ff','flood-opacity':'.34'}));defs.append(panel,area,stroke,spot,glow);svg.insertBefore(defs,svg.firstChild);
const grid=Array.from(svg.querySelectorAll('.an2-gridline')),ys=grid.map(g=>Number(g.getAttribute('y1'))).filter(Number.isFinite),baseline=ys.length?Math.max.apply(null,ys):276,bg=n('rect',{x:50,y:24,width:832,height:266,rx:20,fill:'url(#'+panelId+')',stroke:'rgba(126,200,232,.20)','stroke-width':1.2});svg.insertBefore(bg,defs.nextSibling);
const points=String(line.getAttribute('points')||'').trim(),pairs=points.split(/\s+/).filter(Boolean);if(pairs.length){const first=pairs[0].split(',')[0],lastPair=pairs[pairs.length-1].split(','),last=lastPair[0],lastY=lastPair[1],shadow2=n('polyline',{points:points,fill:'none',stroke:'rgba(0,8,14,.94)','stroke-width':15,'stroke-linecap':'round','stroke-linejoin':'round',transform:'translate(0 11)',opacity:.52}),shadow1=n('polyline',{points:points,fill:'none',stroke:'rgba(26,103,139,.42)','stroke-width':9,'stroke-linecap':'round','stroke-linejoin':'round',transform:'translate(0 6)',opacity:.74}),areaPoly=n('polygon',{points:first+','+baseline+' '+points+' '+last+','+baseline,fill:'url(#'+areaId+')',opacity:.96}),spotLine=n('rect',{x:Number(last)-1.5,y:Number(lastY),width:3,height:Math.max(0,baseline-Number(lastY)),rx:1.5,fill:'url(#'+spotId+')'});line.parentNode.insertBefore(shadow2,line);line.parentNode.insertBefore(shadow1,line);line.parentNode.insertBefore(areaPoly,line);line.parentNode.insertBefore(spotLine,line)}
line.style.stroke='url(#'+strokeId+')';line.style.filter='url(#'+glowId+')';const hi=line.cloneNode(false);hi.removeAttribute('class');hi.setAttribute('fill','none');hi.setAttribute('stroke','rgba(232,251,255,.72)');hi.setAttribute('stroke-width','1.15');hi.setAttribute('stroke-linecap','round');hi.setAttribute('stroke-linejoin','round');hi.setAttribute('transform','translate(0 -1.4)');line.parentNode.insertBefore(hi,line.nextSibling);
const dots=Array.from(svg.querySelectorAll('.an2-dot'));dots.forEach((dot,i)=>{const last=i===dots.length-1,halo2=n('circle',{cx:dot.getAttribute('cx'),cy:dot.getAttribute('cy'),r:last?16:10,fill:'rgba(101,217,255,.055)',stroke:'rgba(101,217,255,.10)','stroke-width':1}),halo=n('circle',{cx:dot.getAttribute('cx'),cy:dot.getAttribute('cy'),r:last?10:7.5,fill:'rgba(101,217,255,.14)',stroke:'rgba(167,237,255,.22)','stroke-width':1});dot.parentNode.insertBefore(halo2,dot);dot.parentNode.insertBefore(halo,dot);dot.setAttribute('r',last?'5.8':'4.5')});
}
function all(){document.querySelectorAll('#page-analytics #rona-analytics-v2 .an2-live-chart svg').forEach(enhance)}
all();const root=document.querySelector('#page-analytics #rona-analytics-v2');if(root&&!root.__ronaDesignerChartObserverV2){root.__ronaDesignerChartObserverV2=true;new MutationObserver(()=>requestAnimationFrame(all)).observe(root,{childList:true,subtree:true})}setTimeout(all,80);window.__RONA_ANALYTICS_DESIGNER_CHART__='v2';})();`;

function canonicalize(source){
  let out=String(source||'');
  out=out.replaceAll("document.documentElement.dataset.ronaAnalyticsLocal='v4.3.1'","document.documentElement.dataset.ronaAnalyticsLocal='live-market-intelligence-v2'");
  out=out.replaceAll("version:'functional-v4.3.1'","version:'live-market-intelligence-v2'");
  out=out.replaceAll('Комментарий Коммерческого директора','Аналитический вывод');
  for(const token of ['RONA TRADE · ANALYTICS','Аналитика','Platts'])if(!out.includes(token))throw new Error('ANALYTICS_APPROVED_BASE_MISMATCH:'+token);
  return out;
}

export async function onRequest(context){
  const response=await approvedAnalytics(context);
  const source=canonicalize(await response.text());
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');headers.set('expires','0');
  headers.set('x-rona-analytics-ui',CANONICAL_ANALYTICS_MARKER);
  headers.set('x-rona-analytics-source-file',CANONICAL_ANALYTICS_SOURCE);
  headers.set('x-rona-analytics-owner','commercial-director-live-data');
  headers.set('x-rona-analytics-data-source','owner_analytics_admin_bootstrap');
  headers.set('x-rona-analytics-refresh','30s-pagechange-focus-root-rebind');
  headers.set('x-rona-analytics-layout','balanced-fluid-1520-v2');headers.set('x-rona-analytics-visual','home-canonical-frames-title-v1');headers.set('x-rona-analytics-typography','semantic-palette-v1');headers.set('x-rona-analytics-chart','designer-depth-v2');return new Response(FAIL_CLOSED_GUARD+source+LIVE_ANALYTICS_RUNTIME+LIVE_BALANCED_LAYOUT_PATCH+LIVE_CANONICAL_HOME_VISUAL_PATCH+LIVE_DESIGNER_CHART_PATCH,{status:response.status,statusText:response.statusText,headers});
}
