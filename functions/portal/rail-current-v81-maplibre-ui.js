import { onRequest as baseRailV7 } from './rail-current-v7-real-map-ui.js';

const TILE_FROM="img.src='https://tile.openstreetmap.org/'+z+'/'+wrap+'/'+ty+'.png';";
const TILE_TO="img.src='/portal/map-assets/osm/'+z+'/'+wrap+'/'+ty+'.png';";
const V7_MARKER="window.__RONA_RAIL_REAL_MAP__='20260824-1026-v7';";
const V82_MARKER="window.__RONA_RAIL_CURRENT_V81__='20260825-raster-first-v8.2';window.__RONA_RAIL_VISUAL_V89__='20260918-square-map-aligned-v8.9';window.__RONA_RAIL_STAGE_A_OWNER__='20260918-deal-map-persistence-v1';";
const TITLE_STYLE_FROM='.rona-rail-v7-real .rona-rail-v4-map-title{color:#16232b;background:rgba(255,255,255,.91);padding:7px 10px;border-radius:9px;box-shadow:0 4px 18px rgba(18,38,48,.12)}';
const TITLE_STYLE_TO='.rona-rail-v7-real .rona-rail-v4-map-title{color:#07141c!important;background:rgba(255,255,255,.96);padding:7px 10px;border-radius:9px;box-shadow:0 4px 18px rgba(18,38,48,.12);font-family:Inter,Arial,sans-serif!important;font-size:13px!important;font-weight:800!important;line-height:1.25!important;opacity:1!important;text-shadow:none!important}';
const NOTE_STYLE_FROM='.rona-rail-v7-real .rona-rail-v4-map-note{color:#24343e!important;opacity:.82!important;font-weight:650}';
const NOTE_STYLE_TO='.rona-rail-v7-real .rona-rail-v4-map-note{display:none!important}';
const REPAIR_ANCHOR="function waitAdminReady(){";
const REPAIR_RUNTIME=String.raw`window.__RONA_RAIL_CURRENT_REPAIR_VERSION__='20260918-owner-v7-square-map-aligned';
function ensureRailCompactDarkStyle(){
  var current=q('#ronaRailCompactDarkStyle');
  if(current){
    if(current.parentNode===document.head&&current!==document.head.lastElementChild)document.head.appendChild(current);
    return current
  }
  var s=el('style');s.id='ronaRailCompactDarkStyle';s.textContent=[
    '#page-monitoring>.rona-owner-page-content{width:100%!important;max-width:1584px!important;margin:0 auto!important;padding-bottom:34px!important}',
    '.rona-rail-v4-root{gap:18px!important;width:100%!important;max-width:1584px!important;margin:0 auto!important}',
    '.rona-rail-v4-work{display:grid!important;width:100%!important;max-width:1584px!important;grid-template-columns:minmax(430px,1fr) minmax(650px,1.55fr)!important;gap:18px!important;align-items:start!important}',
    '.rona-rail-v4-left{display:grid!important;grid-template-rows:auto auto!important;gap:16px!important;min-width:0!important;height:auto!important;align-self:start!important}',
    '.rona-rail-v4-hero{width:100%!important;max-width:1584px!important;min-height:118px!important;margin-left:auto!important;margin-right:auto!important;padding-top:24px!important;padding-bottom:22px!important}',
    '.rona-rail-v4-card{margin:0!important;padding:18px!important;border-radius:15px!important;background:linear-gradient(160deg,rgba(7,21,34,.95),rgba(4,14,24,.91))!important;border-color:rgba(104,183,219,.16)!important;box-shadow:0 12px 28px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.026)!important}',
    '.rona-rail-v4-card h2{margin:0 0 14px!important;color:#e9f6fb!important;font-size:19px!important;line-height:1.18!important;font-weight:840!important;letter-spacing:-.012em!important}',
    '.rona-rail-v4-left>.rona-rail-v4-card{height:auto!important;min-height:0!important;display:flex!important;flex-direction:column!important}',
    '.rona-rail-v4-left>.rona-rail-v4-card .rona-rail-v4-table-wrap{flex:1 1 auto!important}',
    '.rona-rail-v4-work>.rona-rail-v4-card{height:560px!important;max-height:560px!important;min-height:560px!important;overflow:hidden!important;align-self:start!important;display:flex!important;flex-direction:column!important}',

    '.rona-rail-v4-kpis{gap:10px!important}',
    '.rona-rail-v4-kpi{position:relative!important;overflow:hidden!important;min-height:78px!important;padding:14px 14px 13px 16px!important;border-radius:11px!important;background:rgba(5,17,29,.55)!important;border-color:rgba(110,190,220,.12)!important}',
    '.rona-rail-v4-kpi:before{content:""!important;position:absolute!important;left:0!important;top:9px!important;bottom:9px!important;width:2px!important;border-radius:0 3px 3px 0!important;background:#63d8ff!important;box-shadow:0 0 10px rgba(99,216,255,.24)!important}',
    '.rona-rail-v4-kpi:nth-child(2):before{background:#5ee7d5!important;box-shadow:0 0 10px rgba(94,231,213,.22)!important}',
    '.rona-rail-v4-kpi:nth-child(3):before{background:#69d8ff!important}',
    '.rona-rail-v4-kpi:nth-child(4):before{background:#ffc86a!important;box-shadow:0 0 10px rgba(255,200,106,.20)!important}',
    '.rona-rail-v4-kpi span{font-size:12px!important;line-height:1.2!important;color:#98afbc!important;opacity:1!important}',
    '.rona-rail-v4-kpi strong{margin-top:5px!important;font-size:28px!important;line-height:1!important;font-weight:890!important;color:#eef9fd!important;font-variant-numeric:tabular-nums!important}',
    '.rona-rail-v4-kpi:nth-child(1) strong{color:#a9edff!important}.rona-rail-v4-kpi:nth-child(2) strong{color:#a7f2e6!important}.rona-rail-v4-kpi:nth-child(4) strong{color:#ffd895!important}',
    '.rona-rail-v6-selector{margin-top:14px!important}',
    '.rona-rail-v6-select-wrap{gap:5px!important}',
    '.rona-rail-v6-select-label{font-size:10.5px!important;color:#8eb7c8!important;opacity:1!important}',
    '.rona-rail-v6-select{min-height:44px!important;border-radius:10px!important;background:rgba(4,16,27,.70)!important;border-color:rgba(103,198,230,.18)!important}',
    '.rona-rail-v4-banner{margin-top:12px!important;padding:11px 12px!important;border-radius:10px!important;border-color:rgba(255,200,106,.28)!important;background:rgba(146,93,22,.10)!important;color:#e8d6ad!important;font-size:11.5px!important;line-height:1.35!important}',
    '.rona-rail-v6-wagon-box{gap:8px!important;margin:0 0 12px!important;padding:12px 13px!important;min-height:78px!important;border-radius:11px!important;background:rgba(5,17,29,.54)!important;border-color:rgba(103,198,230,.12)!important}',
    '.rona-rail-v6-wagon-label{font-size:10.5px!important;color:#91adba!important;opacity:1!important}',
    '.rona-rail-v6-wagon-count{min-width:24px!important;height:24px!important;background:rgba(99,216,255,.10)!important;border-color:rgba(99,216,255,.22)!important;color:#b7f0ff!important}',
    '.rona-rail-v6-wagon-chip{padding:4px 8px!important;font-size:11.5px!important;border-radius:8px!important}',
    '.rona-rail-v6-wagon-placeholder{font-size:11.5px!important;color:#839ca9!important;opacity:1!important}',
    '.rona-rail-v7-real{width:100%!important;aspect-ratio:auto!important;height:auto!important;min-height:260px!important;max-height:none!important;margin-bottom:0!important;border:1px solid rgba(86,189,219,.16)!important;border-radius:14px!important;background:#071825!important;box-shadow:0 14px 32px rgba(0,0,0,.22)!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-canvas{inset:42px 8px 8px!important;border:0!important;border-radius:10px!important;background:#0a1d2a!important;box-shadow:0 8px 20px rgba(0,0,0,.20)!important}',
    '.rona-rail-v4-work>.rona-rail-v4-card>.rona-rail-v7-real{flex:1 1 0!important;aspect-ratio:auto!important;height:auto!important;min-height:0!important;max-height:none!important;margin-bottom:0!important}',

    '.rona-rail-v7-map-viewport{border:0!important;outline:0!important;border-radius:9px!important;background:#0a1d2a!important;box-shadow:none!important}',
    '.rona-rail-v7-map-viewport:after{display:none!important;content:none!important}',
    '.rona-rail-v7-tile{filter:none!important;opacity:1!important}',
    '.rona-rail-v7-markers,.rona-rail-v7-controls,.rona-rail-v7-map-status,.rona-rail-v7-attribution{z-index:8!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-title{left:11px!important;top:11px!important;padding:0!important;color:#dff8ff!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;font-size:11.5px!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-badge{right:10px!important;top:9px!important;padding:2px!important;background:rgba(4,18,29,.88)!important;border:1px solid rgba(96,210,238,.13)!important}',
    '.rona-rail-v7-real .rona-rail-v4-map-note{left:10px!important;right:10px!important;bottom:7px!important;padding:5px 7px!important;color:#a9c5d2!important;background:rgba(3,14,22,.88)!important;border:1px solid rgba(96,210,238,.10)!important;border-radius:7px!important;font-size:9.8px!important;line-height:1.25!important}',
    '.rona-rail-v7-controls{left:9px!important;top:9px!important;gap:5px!important}',
    '.rona-rail-v7-control{width:31px!important;height:31px!important;border-color:rgba(116,205,231,.20)!important;border-radius:8px!important;background:rgba(4,18,29,.94)!important;color:#dff8ff!important;box-shadow:0 4px 12px rgba(0,0,0,.24)!important;font-size:17px!important}',
    '.rona-rail-v7-control--home{font-size:10px!important}',
    '.rona-rail-v7-map-status{display:none!important}',
    '.rona-rail-v7-attribution{right:3px!important;bottom:2px!important;padding:1px 4px!important;background:rgba(255,255,255,.70)!important;color:#60727b!important;font-size:7.5px!important;border-radius:4px!important}',
    '.rona-rail-v7-attribution a{color:#60727b!important}',
    '.rona-rail-v7-marker{border-color:#fff!important;background:#d94a45!important;box-shadow:0 0 0 3px rgba(108,35,32,.12),0 3px 11px rgba(0,0,0,.36)!important}',
    '.rona-rail-v4-table-wrap{border-radius:10px!important;background:rgba(4,15,25,.46)!important;border-color:rgba(103,198,230,.10)!important}',
    '.rona-rail-v4-table{font-size:12px!important}',
    '.rona-rail-v4-table th,.rona-rail-v4-table td{padding:8px 7px!important}',
    '.rona-rail-v4-table th{font-size:9.5px!important;color:#82b8ca!important;opacity:1!important}',
    '.rona-rail-v4-pill{justify-content:center!important;text-align:center!important;min-height:27px!important;padding:4px 8px!important;font-size:10.5px!important}',
    '.rona-rail-v4-left .rona-rail-v4-table{font-size:12.5px!important}',
    '.rona-rail-v4-left .rona-rail-v4-table th{font-size:10px!important;padding:8px 6px!important}',
    '.rona-rail-v4-left .rona-rail-v4-table td{font-size:12.5px!important;padding:12px 8px!important;line-height:1.38!important}',
    '.rona-rail-v4-left .rona-rail-v4-pill{min-width:118px!important;font-size:10.5px!important}',
    '.rona-rail-v4-matrix-preserved{width:100%!important;max-width:none!important;margin:12px 0 0!important;padding:18px 20px!important;border-radius:15px!important;background:linear-gradient(160deg,rgba(7,21,34,.94),rgba(4,14,24,.90))!important;border-color:rgba(104,183,219,.16)!important;box-shadow:0 12px 28px rgba(0,0,0,.17)!important}',
    '.rona-rail-tariff-section{width:100%!important;max-width:1584px!important;margin:22px auto 0!important;padding:0!important;border:1px solid rgba(104,183,219,.16)!important;border-radius:16px!important;background:linear-gradient(160deg,rgba(7,21,34,.94),rgba(4,14,24,.90))!important;box-shadow:0 12px 28px rgba(0,0,0,.16)!important;overflow:hidden!important;position:relative!important}',
    '.rona-rail-tariff-section:before{display:none!important;content:none!important}',
    '.rona-rail-tariff-toggle{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;width:100%!important;min-height:58px!important;padding:0 18px!important;cursor:pointer!important;list-style:none!important;color:#eaf7fb!important;background:linear-gradient(90deg,rgba(12,39,58,.78),rgba(5,18,30,.72))!important;border:0!important;border-bottom:1px solid rgba(104,183,219,.12)!important;font-size:18px!important;line-height:1.2!important;font-weight:850!important;letter-spacing:-.012em!important}',
    '.rona-rail-tariff-toggle::-webkit-details-marker{display:none!important}',
    '.rona-rail-tariff-toggle:after{content:"Открыть"!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:76px!important;height:30px!important;padding:0 10px!important;border:1px solid rgba(99,216,255,.24)!important;border-radius:999px!important;color:#aeeeff!important;background:rgba(44,142,177,.10)!important;font-size:10.5px!important;font-weight:830!important;letter-spacing:.04em!important;text-transform:uppercase!important}',
    '.rona-rail-tariff-section[open]>.rona-rail-tariff-toggle:after{content:"Свернуть"!important;color:#b9f1df!important;border-color:rgba(88,227,188,.22)!important;background:rgba(53,144,112,.10)!important}',
    '.rona-rail-tariff-body{padding:0 16px 16px!important}',
    '.rona-rail-tariff-section:not([open])>.rona-rail-tariff-body{display:none!important}',
    '.rona-rail-v4-matrix-preserved h1,.rona-rail-v4-matrix-preserved h2,.rona-rail-v4-matrix-preserved h3,.rona-rail-v4-matrix-preserved h4,.rona-rail-v4-matrix-preserved .section-title,.rona-rail-v4-matrix-preserved .card-title{margin:0 0 10px!important;color:#eaf7fb!important;font-size:18px!important;line-height:1.2!important;font-weight:840!important}',
    '.rona-rail-v4-matrix-preserved table{width:100%!important;font-size:11.5px!important}',
    '.rona-rail-v4-matrix-preserved th{color:#83b8ca!important;font-size:9.5px!important;letter-spacing:.04em!important;text-transform:uppercase!important}',
    '.rona-rail-v4-matrix-preserved th,.rona-rail-v4-matrix-preserved td{padding:8px 8px!important;line-height:1.35!important}',
    '#page-monitoring>.rona-owner-page-content>section,#page-monitoring>.rona-owner-page-content>.rona-owner-card{width:100%!important;max-width:1584px!important;margin-left:auto!important;margin-right:auto!important}',
    '@media(max-width:1180px){#page-monitoring>.rona-owner-page-content{max-width:100%!important}.rona-rail-v4-work{grid-template-columns:minmax(340px,.96fr) minmax(480px,1.36fr)!important}.rona-rail-v4-work>.rona-rail-v4-card{height:560px!important;min-height:560px!important;max-height:560px!important}.rona-rail-v7-real{min-height:0!important}}',
    '@media(max-width:1040px){.rona-rail-v4-work{grid-template-columns:1fr!important}.rona-rail-v4-work>.rona-rail-v4-card{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}.rona-rail-v7-real{height:auto!important;min-height:380px!important}}',
    '@media(max-width:680px){.rona-rail-v7-real{min-height:340px!important}.rona-rail-v7-real .rona-rail-v4-map-canvas{inset:40px 6px 6px!important}}'
  ].join('');
  document.head.appendChild(s);
  return s
}
function ensureRailTariffPanel(){
  try{
    var page=q('#page-monitoring');if(!page)return false;
    var existing=q('.rona-rail-tariff-section',page);
    if(existing){
      var summary=q('.rona-rail-tariff-toggle',existing);
      if(!summary){
        summary=document.createElement('summary');
        summary.className='rona-rail-tariff-toggle';
        summary.textContent='Матрица ЖД-тарифов';
        existing.insertBefore(summary,existing.firstChild);
      }
      if(existing.tagName!=='DETAILS'){
        var replacement=document.createElement('details');
        replacement.className='rona-rail-tariff-section';
        replacement.setAttribute('data-rail-subsection','tariffs');
        var toggle=document.createElement('summary');
        toggle.className='rona-rail-tariff-toggle';
        toggle.textContent='Матрица ЖД-тарифов';
        var body=el('div','rona-rail-tariff-body');
        while(existing.firstChild)body.append(existing.firstChild);
        replacement.append(toggle,body);
        existing.parentNode.replaceChild(replacement,existing);
      }
      return true
    }
    var hs=qa('h1,h2,h3,h4,h5,.section-title,.card-title',page);
    var matrix=null;
    for(var i=0;i<hs.length;i++){
      var t=String(hs[i].textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(t.indexOf('матриц')>=0&&t.indexOf('тариф')>=0){
        matrix=hs[i].closest('section,.rona-owner-card,.card,.panel,[data-section]')||hs[i].parentElement;
        if(matrix)break
      }
    }
    if(!matrix||matrix.closest('.rona-rail-tariff-section'))return false;
    var tariff=document.createElement('details');
    tariff.className='rona-rail-tariff-section';
    tariff.setAttribute('data-rail-subsection','tariffs');
    var toggle=document.createElement('summary');
    toggle.className='rona-rail-tariff-toggle';
    toggle.textContent='Матрица ЖД-тарифов';
    var body=el('div','rona-rail-tariff-body');
    matrix.classList.add('rona-rail-v4-matrix-preserved');
    matrix.parentNode.insertBefore(tariff,matrix);
    body.append(matrix);
    tariff.append(toggle,body);
    return true
  }catch(_e){return false}
}
var RONA_RAIL_FIXED_DESKTOP_CARD_HEIGHT=560;
function alignRailMapHeightToOperations(){
  try{
    var page=q('#page-monitoring');if(!page)return false;
    var work=q('.rona-rail-v4-work',page),right=work&&q(':scope > .rona-rail-v4-card',work);
    if(!work||!right)return false;
    var map=q('.rona-rail-v7-real',right);
    if(window.matchMedia&&window.matchMedia('(max-width:1040px)').matches){
      right.style.removeProperty('height');
      right.style.removeProperty('min-height');
      right.style.removeProperty('max-height');
      right.style.removeProperty('overflow');
      if(map){
        map.style.removeProperty('height');
        map.style.removeProperty('min-height');
        map.style.removeProperty('max-height');
        map.style.removeProperty('flex');
      }
      return true
    }
    var fixedHeight=RONA_RAIL_FIXED_DESKTOP_CARD_HEIGHT;
    right.style.setProperty('height',fixedHeight+'px','important');
    right.style.setProperty('min-height',fixedHeight+'px','important');
    right.style.setProperty('max-height',fixedHeight+'px','important');
    right.style.setProperty('overflow','hidden','important');
    if(map){
      map.style.setProperty('flex','1 1 0','important');
      map.style.setProperty('aspect-ratio','auto','important');
      map.style.setProperty('height','auto','important');
      map.style.setProperty('min-height','0','important');
      map.style.setProperty('max-height','none','important');
      map.style.setProperty('margin-bottom','0','important');
      var state=q('.rona-rail-v4-map-canvas',map);
      if(state&&state.__ronaRailMapState&&typeof railMapRequestDraw==='function')railMapRequestDraw(state.__ronaRailMapState)
    }
    window.__RONA_RAIL_MAP_HEIGHT_ALIGNMENT__={mode:'FIXED_DESKTOP',fixedHeight:fixedHeight,dealKey:window.__RONA_RAIL_SELECTED_DEAL_KEY__||null,appliedAt:new Date().toISOString()};
    return true
  }catch(_e){return false}
}
function scheduleRailMapHeightAlignment(){
  [0,60,180,420].forEach(function(ms){setTimeout(alignRailMapHeightToOperations,ms)})
}
function bindRailMapHeightAlignment(){
  if(window.__RONA_RAIL_MAP_HEIGHT_ALIGNMENT_BOUND__)return;
  window.__RONA_RAIL_MAP_HEIGHT_ALIGNMENT_BOUND__=true;
  window.addEventListener('resize',scheduleRailMapHeightAlignment,{passive:true});
  document.addEventListener('change',function(ev){
    var t=ev&&ev.target;
    if(t&&t.matches&&t.matches('.rona-rail-v6-select'))scheduleRailMapHeightAlignment()
  },true)
}
function bumpRailCompactDarkStyle(){
  [0,80,220,700].forEach(function(ms){setTimeout(function(){ensureRailCompactDarkStyle()},ms)})
}
ensureRailCompactDarkStyle();
ensureRailTariffPanel();
bindRailMapHeightAlignment();
scheduleRailMapHeightAlignment();
[120,420,900].forEach(function(ms){setTimeout(function(){ensureRailTariffPanel()},ms)});
bumpRailCompactDarkStyle();
window.__RONA_RAIL_CURRENT_REPAIR__=function(){
  try{
    ensureRailCompactDarkStyle();
    bindRailMapHeightAlignment();
    scheduleRailMapHeightAlignment();
    var page=q('#page-monitoring'),ready=page&&q('[data-rail-current-v4="ready"],[data-rail-current-root="ready"]',page);
    if(!ready)paint();
    ensureRailTariffPanel();
    sync();
    [0,120,420,900].forEach(function(ms){setTimeout(function(){ensureRailTariffPanel()},ms)});
    bumpRailCompactDarkStyle();
    return true
  }catch(_e){return false}
};
function waitAdminReady(){`;

export async function onRequest(context){
  const response=await baseRailV7(context);
  let source=await response.text();
  if(
    response.status!==200||
    !source.includes(TILE_FROM)||
    !source.includes(V7_MARKER)||
    !source.includes("version:'v7'")||
    !source.includes('mountRealRailMap')||
    !source.includes('rona-rail-v7-map-viewport')||
    !source.includes(TITLE_STYLE_FROM)||
    !source.includes(NOTE_STYLE_FROM)||
    !source.includes(REPAIR_ANCHOR)||
    !source.includes('host.replaceChildren(root);if(matrix)host.append(matrix);isolate(page,host);dedupeOnlineRail(host);')
  ){
    return new Response('RAIL_V82_SOURCE_MISMATCH',{status:500,headers:{
      'content-type':'text/plain; charset=utf-8',
      'cache-control':'no-store'
    }});
  }

  source=source
    .replace(TILE_FROM,TILE_TO)
    .replace(V7_MARKER,V82_MARKER)
    .replace("version:'v7'","version:'v8.2'")
    .replace('Интерактивная карта','Интерактивная ЖД-карта')
    .replace(TITLE_STYLE_FROM,TITLE_STYLE_TO)
    .replace(NOTE_STYLE_FROM,NOTE_STYLE_TO)
    .replace(REPAIR_ANCHOR,REPAIR_RUNTIME)
    .replace('host.replaceChildren(root);if(matrix)host.append(matrix);isolate(page,host);dedupeOnlineRail(host);','host.replaceChildren(root);if(matrix)host.append(matrix);isolate(page,host);dedupeOnlineRail(host);if(typeof scheduleRailMapHeightAlignment===\'function\')scheduleRailMapHeightAlignment();');
  source=source.split('if(matrix)host.append(matrix);').join("if(matrix){var tariff=document.createElement('details');tariff.className='rona-rail-tariff-section';tariff.setAttribute('data-rail-subsection','tariffs');var tariffToggle=document.createElement('summary');tariffToggle.className='rona-rail-tariff-toggle';tariffToggle.textContent='Матрица ЖД-тарифов';var tariffBody=el('div','rona-rail-tariff-body');matrix.classList.add('rona-rail-v4-matrix-preserved');tariffBody.append(matrix);tariff.append(tariffToggle,tariffBody);host.append(tariff);}");

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-rail-ui','current-v8.10-fixed-map-size');headers.set('x-rona-rail-map-size','fixed-desktop-560-v1');
  headers.set('x-rona-rail-stage-a','deal-owned-map-persistence-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
