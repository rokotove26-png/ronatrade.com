import { onRequest as approvedAnalytics } from './analytics-v2-approved-base.js';

const CANONICAL_ANALYTICS_SOURCE='RONA_Admin_LK_LIVE_Market_Intelligence_v1';
const CANONICAL_ANALYTICS_MARKER='live-market-intelligence-v1';

const FAIL_CLOSED_GUARD=String.raw`
;(()=>{
  if(document.getElementById('ronaAnalyticsLiveDataGuardV1'))return;
  const s=document.createElement('style');
  s.id='ronaAnalyticsLiveDataGuardV1';
  s.textContent='#page-analytics #rona-analytics-v2{visibility:hidden!important;opacity:0!important}';
  document.head.append(s);
})();
`;

const LIVE_ANALYTICS_RUNTIME=String.raw`
;(()=>{'use strict';
  if(window.__RONA_ANALYTICS_LIVE_DATA_RUNTIME__==='owner-bootstrap-v1')return;
  window.__RONA_ANALYTICS_LIVE_DATA_RUNTIME__='owner-bootstrap-v1';
  const ENDPOINT='/portal/api/v1/admin/analytics';
  const REFRESH_MS=5*60*1000;
  const PRODUCT_DEFS={
    AI92:{label:'АИ-92',match:['АИ-92']},
    AI95:{label:'АИ-95',match:['АИ-95']},
    DT:{label:'ДТ',match:['ДТ']},
    NAFTA:{label:'Нафта',match:['НАФТА','Нафта']},
    LPG:{label:'LPG / СУГ',match:['СУГ / СПБТ','LPG / СУГ','СУГ']}
  };
  const state={data:null,error:null,product:'AI92',timer:null,refreshing:false,lastPublicationId:null};
  const q=(s,r=document)=>r.querySelector(s);
  const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};
  const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const fmt=(v,d=2)=>finite(v)===null?'—':new Intl.NumberFormat('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(v));
  const dateRu=v=>{if(!v)return '—';const s=String(v).slice(0,10),m=s.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);return m?m[3]+'.'+m[2]+'.'+m[1]:s};
  const monthRu=v=>{const s=String(v||''),m=s.match(/^(\\d{4})-(\\d{2})$/);return m?m[2]+'.'+m[1]:'09.2026'};
  const root=()=>q('#page-analytics #rona-analytics-v2');
  function card(title){const c=el('section','rona-owner-card');if(title)c.append(el('h2','',title));for(let i=1;i<arguments.length;i++)if(arguments[i])c.append(arguments[i]);return c}
  function pill(text,tone='neutral'){return el('span','rona-fin-pill rona-fin-pill--'+tone,text)}
  function kpi(title,value,caption){return card(title,el('div','rona-owner-kpi',value),el('div','rona-owner-muted',caption))}
  function installStyles(){
    if(q('#ronaAnalyticsLiveDataStyleV1'))return;
    const s=el('style');s.id='ronaAnalyticsLiveDataStyleV1';s.textContent=[
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
    const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.dataset.ronaLiveChart='v1';
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
  function render(){
    const r=root();if(!r||!state.data?.currentAnalytics)return false;installStyles();
    const current=state.data.currentAnalytics,item=itemFor(state.product)||itemFor('AI92'),chart=currentChart(item);
    if(!item||!chart){return renderFailure('Для выбранного продукта отсутствует подтверждённый public_chart. Старый snapshot не используется.')}
    const src=sourceState(item,chart),targetMonth=monthRu(chart.target_month||'2026-09');
    r.replaceChildren();r.dataset.ronaLiveRoot='owner-bootstrap-v1';r.dataset.publicationId=String(current.publication_id||'');
    const head=el('section','rona-owner-card an2-head'),copy=el('div');copy.append(el('h1','','Аналитика'),el('p','rona-owner-muted','Рыночная аналитика Коммерческого директора. Экран строится только из текущей VERIFIED/PUBLISHED публикации Market Intelligence; исторические LOW / BASE / HIGH не используются как текущий прогноз.'));const status=el('div','an2-live-status');status.append(pill('LIVE DATA','success'),pill(src.gap?'РАЗРЫВ ДАННЫХ':'ИСТОЧНИК АКТУАЛЕН',src.gap?'warn':'success'));head.append(copy,status);r.append(head);
    const kpis=el('div','an2-kpis');kpis.append(kpi('Platts',dateRu(src.latest),'Последний подтверждённый источник'),kpi('Argus','Нет ряда','Только требуемый Argus European Products / EUROBOB Oxy'),kpi('Горизонт',targetMonth,String(chart.chart_semantics||'ФАКТ / MTD / FORWARD')));r.append(kpis);
    const controls=card('Базовая котировка'),bar=el('div','an2-live-controls');for(const key of Object.keys(PRODUCT_DEFS)){if(!itemFor(key))continue;const b=el('button','',PRODUCT_DEFS[key].label);b.type='button';b.setAttribute('aria-pressed',state.product===key?'true':'false');b.onclick=()=>{state.product=key;render()};bar.append(b)}bar.append(el('span','rona-owner-muted','Источник: '+(state.product==='LPG'?'Petromarket / Market Intelligence':'Platts / Market Intelligence')));controls.append(bar);r.append(controls);
    const main=el('div','an2-live-grid'),cc=card('Динамика '+PRODUCT_DEFS[state.product].label+' · '+String(chart.unit||'USD/т'));cc.classList.add('an2-live-chart');cc.append(chartSvg(chart.labels,chart.values),el('div','rona-owner-muted an2-basis',String(item.basis||item.headline||'')));const side=card(state.product==='LPG'?'Региональный срез':'Рыночный срез на '+targetMonth);side.classList.add('an2-live-side');chart.labels.forEach((label,i)=>{const row=el('div','an2-live-row');row.append(el('span','',String(label)),el('strong','',fmt(chart.values[i],2)+' '+String(chart.unit||'USD/т')));side.append(row)});const meta=el('div','an2-live-meta');meta.append(el('div','','Публикация: '+String(current.publication_id||'—')),el('div','','Актуализация: '+dateRu(current.published_at)),el('div','','Последний источник: '+dateRu(src.latest)));if(src.expected)meta.append(el('div','','Ожидаемый торговый день: '+dateRu(src.expected)));meta.append(el('div','','Статус источника: '+(src.gap?'РАЗРЫВ ДАННЫХ':'ПОДТВЕРЖДЕНО')));side.append(meta);main.append(cc,side);r.append(main);
    if(src.gap){r.append(el('div','an2-live-source-gap','В контуре отсутствует ожидаемый свежий источник. Система не достраивает значения и не показывает старый сценарий как текущий. До поступления нового подтверждённого выпуска используются только явно датированные последние данные.'))}
    const currentBox=card('Аналитический вывод'),inner=el('div','an2-live-current');inner.append(el('h3','',String(item.headline||PRODUCT_DEFS[state.product].label)),el('p','',String(item.content_text||'Нет текста аналитического вывода.')),el('div','rona-owner-muted','Источник аналитики: '+String(current.source_system||'RONA Market Intelligence')+' · '+String(current.source_version||'')+' · публикация '+dateRu(current.published_at)));currentBox.append(inner);r.append(currentBox);
    const extras=el('div','an2-live-extra');for(const extra of (current.items||[])){if(['Логистика','Коммерческий прайс','БНК — формульный контроль'].includes(String(extra.product||''))){const c=card(String(extra.product||''));c.append(el('div','an2-live-current',String(extra.content_text||extra.headline||'')));extras.append(c)}}if(extras.children.length)r.append(extras);
    document.documentElement.dataset.ronaAnalyticsUi='live-market-intelligence-v1';window.__RONA_ANALYTICS_LIVE_READY__=true;const guard=q('#ronaAnalyticsLiveDataGuardV1');if(guard)guard.remove();return true;
  }
  function renderFailure(message){
    const r=root();if(!r)return false;installStyles();r.replaceChildren();r.dataset.ronaLiveRoot='owner-bootstrap-v1';const box=el('div','an2-live-fail');box.append(el('strong','','Актуальные аналитические данные недоступны.'),el('div','',String(message||'Ошибка загрузки текущей публикации.')),el('div','rona-owner-muted','Устаревший локальный snapshot намеренно скрыт.'));r.append(box);const guard=q('#ronaAnalyticsLiveDataGuardV1');if(guard)guard.remove();return true;
  }
  async function load(){
    if(state.refreshing)return;state.refreshing=true;
    try{
      const response=await fetch(ENDPOINT+'?ts='+Date.now(),{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      const body=await response.json().catch(()=>null);
      const current=body?.data?.currentAnalytics;
      if(!response.ok||body?.ok!==true||!current||current.status!=='PUBLISHED'||current.audience!=='ALL_CLIENTS'||current.authority_state!=='VERIFIED'||!Array.isArray(current.items))throw new Error('ANALYTICS_LIVE_BOOTSTRAP_INVALID');
      state.data=body.data;state.error=null;state.lastPublicationId=current.publication_id||null;
      if(!itemFor(state.product))state.product='AI92';
      render();
    }catch(err){state.error=String(err?.message||err||'ANALYTICS_LIVE_LOAD_FAILED');renderFailure(state.error)}finally{state.refreshing=false}
  }
  function ensureLive(){const r=root();if(!r)return;if(state.data&&r.dataset.ronaLiveRoot!=='owner-bootstrap-v1')render();else if(state.error&&r.dataset.ronaLiveRoot!=='owner-bootstrap-v1')renderFailure(state.error)}
  let tries=0;(function wait(){const r=root();if(r){const obs=new MutationObserver(()=>{if(!r.querySelector('.an2-live-current')&&!r.querySelector('.an2-live-fail'))queueMicrotask(ensureLive)});obs.observe(r,{childList:true,subtree:false});ensureLive();return}tries++;if(tries<1200)setTimeout(wait,50)})();
  load();
  state.timer=setInterval(load,REFRESH_MS);
  window.addEventListener('focus',load,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load()});
})();
`;

function canonicalize(source){
  let out=String(source||'');
  out=out.replaceAll("document.documentElement.dataset.ronaAnalyticsLocal='v4.3.1'","document.documentElement.dataset.ronaAnalyticsLocal='live-market-intelligence-v1'");
  out=out.replaceAll("version:'functional-v4.3.1'","version:'live-market-intelligence-v1'");
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
  headers.set('x-rona-analytics-refresh','300s-plus-focus');
  return new Response(FAIL_CLOSED_GUARD+source+LIVE_ANALYTICS_RUNTIME,{status:response.status,statusText:response.statusText,headers});
}
