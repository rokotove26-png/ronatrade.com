import { onRequest as canonicalV3 } from './analytics-v2-approved-base.js';

const GUARD_FROM="if(window.__RONA_ANALYTICS_V2__)return;";
const GUARD_TO="if(window.__RONA_ANALYTICS_CANONICAL_ONLY__==='balanced-fluid-1520-v2'&&document.getElementById('rona-analytics-v2'))return;window.__RONA_ANALYTICS_CANONICAL_ONLY__='balanced-fluid-1520-v2';";
const ROOT_FROM="function ensureRoot(){const p=page();if(!p)return null;style();let r=q('#rona-analytics-v2',p);if(!r){r=el('section','an2');r.id='rona-analytics-v2';p.insertBefore(r,p.firstChild)}for(const x of qa(':scope>*',p))if(x!==r){x.style.setProperty('display','none','important');x.setAttribute('aria-hidden','true')}return r}";
const ROOT_TO="function ensureRoot(){const p=page();if(!p)return null;style();let r=q('#rona-analytics-v2',p);if(!r){r=el('section','an2');r.id='rona-analytics-v2';p.insertBefore(r,p.firstChild)}for(const x of qa(':scope>*',p))if(x!==r)x.remove();return r}";
const BIND_FROM="function bind(){render();const p=page();if(p&&!p.__ronaAnalyticsV2Observer){p.__ronaAnalyticsV2Observer=true;new MutationObserver(()=>{const r=q('#rona-analytics-v2',p);if(!r)return;for(const x of qa(':scope>*',p))if(x!==r){x.style.setProperty('display','none','important');x.setAttribute('aria-hidden','true')}}).observe(p,{childList:true})}}";
const BIND_TO="function bind(){render();const p=page();if(p&&!p.__ronaAnalyticsV2Observer){p.__ronaAnalyticsV2Observer=true;new MutationObserver(()=>{const r=q('#rona-analytics-v2',p);if(!r)return;for(const x of qa(':scope>*',p))if(x!==r)x.remove()}).observe(p,{childList:true})}}";
const RENDER_FROM="function render(){const r=ensureRoot();if(!r)return false;r.replaceChildren();header(r);topKpis(r);controls(r);marketBlock(r);ronaPriceForecast(r);commentary(r);document.documentElement.classList.add('rona-analytics-v2-ready');document.documentElement.dataset.ronaAnalyticsUi='v3-market-rona-bases-lpg';window.__RONA_ANALYTICS_V2_READY__=true;return true}";
const RENDER_TO="function render(){const r=ensureRoot();if(!r)return false;r.replaceChildren();const title=el('div','rona-analytics-canonical-title');title.append(el('div','rona-analytics-canonical-title-text','Аналитика'));r.append(title);header(r);topKpis(r);controls(r);marketBlock(r);ronaPriceForecast(r);commentary(r);document.documentElement.classList.add('rona-analytics-v2-ready');document.documentElement.dataset.ronaAnalyticsUi='v3-market-rona-bases-lpg';window.__RONA_ANALYTICS_V2_READY__=true;return true}";

const BALANCED_LAYOUT_PATCH=String.raw`;(()=>{const old=document.getElementById('ronaAnalyticsBalancedLayoutV1');if(old)old.remove();if(document.getElementById('ronaAnalyticsBalancedLayoutV2'))return;const s=document.createElement('style');s.id='ronaAnalyticsBalancedLayoutV2';s.textContent=[
'#page-analytics #rona-analytics-v2.an2{width:min(100%,1520px)!important;max-width:1520px!important;margin-left:auto!important;margin-right:auto!important;gap:14px!important;padding:0 clamp(10px,1vw,18px) 20px!important;box-sizing:border-box!important}',
'#page-analytics #rona-analytics-v2 .an2-head{gap:14px!important}#page-analytics #rona-analytics-v2 .an2-head p{max-width:780px!important}',
'#page-analytics #rona-analytics-v2 .an2-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;min-width:0!important}',
'#page-analytics #rona-analytics-v2 .an2-main{grid-template-columns:minmax(0,1.52fr) minmax(330px,.78fr)!important;gap:14px!important;align-items:stretch!important;min-width:0!important}',
'#page-analytics #rona-analytics-v2 .an2-chart{min-height:360px!important}#page-analytics #rona-analytics-v2 .an2-chart svg{height:310px!important}',
'#page-analytics #rona-analytics-v2 .an2-market-forecast{height:100%!important;box-sizing:border-box!important}',
'#page-analytics #rona-analytics-v2 .an2-rona{gap:10px!important}#page-analytics #rona-analytics-v2 .an2-rona-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;min-width:0!important}',
'#page-analytics #rona-analytics-v2 .an2-price-card{min-width:0!important}#page-analytics #rona-analytics-v2 .an2-price-base{font-size:22px!important}',
'@media(max-width:1280px){#page-analytics #rona-analytics-v2.an2{width:100%!important;max-width:none!important}#page-analytics #rona-analytics-v2 .an2-main{grid-template-columns:minmax(0,1.45fr) minmax(300px,.72fr)!important}}',
'@media(max-width:1050px){#page-analytics #rona-analytics-v2 .an2-main{grid-template-columns:1fr!important}#page-analytics #rona-analytics-v2 .an2-chart{min-height:340px!important}#page-analytics #rona-analytics-v2 .an2-chart svg{height:295px!important}#page-analytics #rona-analytics-v2 .an2-rona-grid{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))!important}}',
'@media(max-width:680px){#page-analytics #rona-analytics-v2.an2{padding-left:0!important;padding-right:0!important}#page-analytics #rona-analytics-v2 .an2-kpis{grid-template-columns:1fr!important}#page-analytics #rona-analytics-v2 .an2-rona-grid{grid-template-columns:1fr!important}#page-analytics #rona-analytics-v2 .an2-chart svg{height:270px!important}}'
].join('');document.head.append(s)})();`;

const CANONICAL_HOME_VISUAL_PATCH=String.raw`;(()=>{const old=document.getElementById('ronaAnalyticsCanonicalHomeVisualV1');if(old)old.remove();const s=document.createElement('style');s.id='ronaAnalyticsCanonicalHomeVisualV1';s.textContent=[
'#current-admin-main #page-analytics #rona-analytics-v2.an2{--an2-text-primary:#e8f1f6;--an2-text-secondary:#9eb3c1;--an2-heading:#dbe8ef;--an2-heading-soft:#bdd0db;--an2-cyan:#65d9ff;--an2-blue:#8db7ff;--an2-green:#8bdcb4;--an2-amber:#efc978;--an2-red:#ff8c97;color:var(--an2-text-primary)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .rona-analytics-canonical-title{position:sticky!important;top:0!important;z-index:2147481200!important;display:flex!important;visibility:visible!important;opacity:1!important;align-items:center!important;min-height:48px!important;box-sizing:border-box!important;margin:0 0 14px!important;padding:10px 14px!important;border:1px solid var(--line-soft,rgba(255,255,255,.14))!important;border-radius:12px!important;background:rgba(6,18,31,.94)!important;-webkit-backdrop-filter:blur(12px) saturate(120%)!important;backdrop-filter:blur(12px) saturate(120%)!important;box-shadow:0 8px 24px rgba(0,0,0,.16)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .rona-analytics-canonical-title-text{font-size:22px!important;font-weight:850!important;line-height:1.2!important;letter-spacing:.01em!important;color:inherit!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;flex-wrap:wrap!important;gap:14px!important;min-height:0!important;margin:0!important;padding:16px!important;border:1px solid var(--line,rgba(255,255,255,.18))!important;border-radius:14px!important;background:transparent!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;color:inherit!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head h1{display:none!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head .rona-visual-kicker{display:none!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head p,#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head .rona-visual-sub{max-width:900px!important;margin:0!important;color:var(--an2-text-secondary)!important;font-size:12px!important;line-height:1.5!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-card,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-market-forecast{border:1px solid var(--line,rgba(255,255,255,.18))!important;border-radius:14px!important;background:transparent!important;box-shadow:none!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-market-forecast{padding:16px!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-card>h2,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-title,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-rona-head h2{color:var(--an2-heading)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-card>h3,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-price-card h3{color:var(--an2-heading-soft)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-kpi,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-price-base{color:var(--an2-cyan)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-owner-muted,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-sub,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-meta,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-basis,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-price-current,#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-model-note{color:var(--an2-text-secondary)!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-chart{color:var(--an2-cyan)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-axis{fill:var(--an2-text-secondary)!important;opacity:.84!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-point-value{fill:#dff7ff!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-controls button{color:#c7d7e1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-controls button[aria-pressed="true"]{color:var(--an2-cyan)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-row span:first-child{color:var(--an2-text-secondary)!important;opacity:1!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-mf-row strong{color:#e6eef3!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .an2-comment{color:#cbdbe5!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2>.rona-owner-card:last-child>h2{color:var(--an2-amber)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--info{color:var(--an2-blue)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--success{color:var(--an2-green)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--warn{color:var(--an2-amber)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--danger{color:var(--an2-red)!important}#current-admin-main #page-analytics #rona-analytics-v2.an2 .rona-fin-pill--neutral{color:var(--an2-text-secondary)!important}',
'@media(max-width:720px){#current-admin-main #page-analytics #rona-analytics-v2 .rona-analytics-canonical-title{min-height:44px!important;padding:9px 12px!important;margin-bottom:10px!important}#current-admin-main #page-analytics #rona-analytics-v2 .rona-analytics-canonical-title-text{font-size:19px!important}}',
'@media(max-width:680px){#current-admin-main #page-analytics #rona-analytics-v2.an2>.an2-head{min-height:0!important;padding:14px!important;border-radius:14px!important}}'
].join('');document.head.append(s);window.__RONA_ANALYTICS_CANONICAL_HOME_VISUAL__='v1';})();`;

const DESIGNER_CHART_PATCH=String.raw`;(()=>{if(document.getElementById('ronaAnalyticsDesignerChartV2'))return;const prior=document.getElementById('ronaAnalyticsDesignerChartV1');if(prior)prior.remove();const s=document.createElement('style');s.id='ronaAnalyticsDesignerChartV2';s.textContent=[
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-chart{overflow:hidden!important;background:linear-gradient(180deg,rgba(8,24,38,.34),rgba(3,12,20,.08))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 14px 36px rgba(0,0,0,.12)!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-chart svg{border-radius:18px!important;filter:drop-shadow(0 22px 40px rgba(0,0,0,.30))!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-chart .an2-gridline{opacity:.12!important;stroke-dasharray:2 8!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-chart .an2-line{stroke-width:4.8!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-chart .an2-dot{stroke:#e9fbff!important;stroke-width:1.8!important}',
'#current-admin-main #page-analytics #rona-analytics-v2 .an2-chart .an2-point-value{paint-order:stroke!important;stroke:rgba(3,13,22,.96)!important;stroke-width:3.8px!important}',
'@media(max-width:680px){#current-admin-main #page-analytics #rona-analytics-v2 .an2-chart svg{border-radius:13px!important}}'
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
function all(){document.querySelectorAll('#page-analytics #rona-analytics-v2 .an2-chart svg').forEach(enhance)}
all();const root=document.querySelector('#page-analytics #rona-analytics-v2');if(root&&!root.__ronaDesignerChartObserverV2){root.__ronaDesignerChartObserverV2=true;new MutationObserver(()=>requestAnimationFrame(all)).observe(root,{childList:true,subtree:true})}setTimeout(all,80);window.__RONA_ANALYTICS_DESIGNER_CHART__='v2';})();`;

export async function onRequest(context){
  const response=await canonicalV3(context);
  let source=await response.text();
  if(!source.includes(GUARD_FROM)||!source.includes(ROOT_FROM)||!source.includes(BIND_FROM)||!source.includes(RENDER_FROM)){
    return new Response('ANALYTICS_CANONICAL_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.replace(GUARD_FROM,GUARD_TO).replace(ROOT_FROM,ROOT_TO).replace(BIND_FROM,BIND_TO).replace(RENDER_FROM,RENDER_TO);
  source=source.replace('Комментарий Коммерческого директора','Аналитический вывод');
  const outerClose=source.lastIndexOf('})();');
  if(outerClose<0){
    return new Response('ANALYTICS_LAYOUT_PATCH_POINT_MISSING',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,outerClose)+BALANCED_LAYOUT_PATCH+CANONICAL_HOME_VISUAL_PATCH+DESIGNER_CHART_PATCH+source.slice(outerClose);

  const required=['20260824-analytics-v3-market-rona-bases-lpg','АИ-92','АИ-95','ДТ','LPG / СУГ','Platts','Argus','LOW','BASE','HIGH','Forward','Аналитический вывод','FACT / CALCULATION / FORECAST','rona-analytics-canonical-title'];
  const forbidden=['Выводов','Рыночных сигналов','Аналитическая лента','Текущий опубликованный ориентир RONA Trade','Комментарий Коммерческого директора'];
  if(required.some(token=>!source.includes(token))||forbidden.some(token=>source.includes(token))){
    return new Response('ANALYTICS_CANONICAL_VALIDATION_FAILED',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-analytics-ui','canonical-v3-only');
  headers.set('x-rona-analytics-owner','canonical-v3-exclusive');
  headers.set('x-rona-analytics-layout','balanced-fluid-1520-v2');
  headers.set('x-rona-analytics-visual','home-canonical-frames-title-v1');
  headers.set('x-rona-analytics-typography','semantic-palette-v1');
  headers.set('x-rona-analytics-chart','designer-depth-v2');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
