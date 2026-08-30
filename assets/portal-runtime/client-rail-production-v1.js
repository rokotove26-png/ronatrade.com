(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  if(window.__RONA_CLIENT_RAIL_PRODUCTION__==='20260830-client-workspace-v3')return;
  window.__RONA_CLIENT_RAIL_PRODUCTION__='20260830-client-workspace-v3';

  const DATA_REFRESH_MS=30000;
  const REQUEST_TIMEOUT_MS=12000;
  const SHIPMENTS_API='/portal/api/v1/client/shipments';
  const MAPLIBRE_JS='/portal/map-assets/maplibre-gl.js';
  const MAPLIBRE_CSS='/portal/map-assets/maplibre-gl.css';
  const TILE_TEMPLATE='/portal/map-assets/osm/{z}/{x}/{y}.png';
  const DEFAULT_CENTER=[70,47];
  let refreshInFlight=false;
  let shipments=[];
  let selectedShipmentId='';
  let currentFilter='ALL';
  let currentQuery='';
  let map=null;
  let mapContainer=null;
  let maplibrePromise=null;
  let workspaceRoot=null;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const text=value=>String(value??'').trim();
  const upper=value=>text(value).toUpperCase();
  const shipmentKey=row=>text(row?.shipment_id||row?.shipmentId||row?.id);
  const isClosed=row=>Boolean(row?.closed_at||row?.closedAt)||['CLOSED','COMPLETED','DELIVERED','CANCELLED'].includes(upper(row?.shipment_status||row?.status));
  const routeText=row=>[text(row?.origin_location||row?.origin),text(row?.destination_location||row?.destination)].filter(Boolean).join(' → ')||'Маршрут не опубликован';
  const fmtDate=value=>{
    if(!value)return '—';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return text(value)||'—';
    try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)}catch(_){return d.toLocaleString()}
  };
  const statusLabel=value=>{
    const raw=upper(value);
    const labels={PLANNED:'Запланировано',READY:'Готово к отправке',IN_TRANSIT:'В пути',DEPARTED:'Отправлено',ARRIVED:'Прибыло',DELIVERED:'Доставлено',CLOSED:'Завершено',COMPLETED:'Завершено',CANCELLED:'Отменено',EXECUTING:'В исполнении',OPEN:'Открыто'};
    return labels[raw]||text(value)||'Статус не опубликован';
  };
  const statusTone=value=>{
    const raw=upper(value);
    if(['ARRIVED','DELIVERED','CLOSED','COMPLETED'].includes(raw))return 'ok';
    if(['CANCELLED','ERROR','BLOCKED'].includes(raw))return 'bad';
    if(['IN_TRANSIT','DEPARTED','EXECUTING'].includes(raw))return 'live';
    return 'neutral';
  };

  function railRoot(){
    for(const selector of ['#page-rail','#page-monitoring','[data-page="rail"]','[data-page="monitoring"]']){
      const el=document.querySelector(selector);
      if(el)return el;
    }
    const title=[...document.querySelectorAll('h1,h2,h3')].find(el=>text(el.textContent)==='Онлайн ЖД');
    return title?.closest('[id^="page-"],section,main,.page')||title?.parentElement||null;
  }

  function injectStyle(){
    if(document.getElementById('rona-client-rail-workspace-v3-style'))return;
    const style=document.createElement('style');
    style.id='rona-client-rail-workspace-v3-style';
    style.textContent=`
      .rona-rail-ws{--rr-border:rgba(113,169,194,.18);--rr-panel:rgba(8,22,32,.82);--rr-panel2:rgba(9,27,39,.72);--rr-text:#eaf4f8;--rr-muted:#8ea6b2;--rr-cyan:#66c6e8;display:grid;gap:14px;color:var(--rr-text);font-family:Inter,Arial,sans-serif}
      .rona-rail-ws *{box-sizing:border-box}.rona-rail-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:20px 22px;border:1px solid var(--rr-border);border-radius:16px;background:linear-gradient(135deg,rgba(10,31,43,.94),rgba(6,18,27,.9));box-shadow:0 14px 40px rgba(0,0,0,.18)}
      .rona-rail-kicker{font-size:10px;font-weight:800;letter-spacing:.14em;color:#71b9d2;text-transform:uppercase;margin-bottom:6px}.rona-rail-title{margin:0;font-size:25px;line-height:1.1;font-weight:850;letter-spacing:-.02em}.rona-rail-sub{margin:7px 0 0;color:var(--rr-muted);font-size:12px;line-height:1.5}
      .rona-rail-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.rona-rail-pill,.rona-rail-btn{border:1px solid rgba(111,188,218,.25);border-radius:999px;background:rgba(12,34,46,.72);color:#b9d5df;font-size:10px;font-weight:750;white-space:nowrap}.rona-rail-pill{padding:7px 10px}.rona-rail-btn{padding:7px 11px;cursor:pointer}.rona-rail-btn:hover{background:rgba(19,54,70,.9);color:#fff}.rona-rail-btn:disabled{opacity:.55;cursor:default}
      .rona-rail-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.rona-rail-metric{padding:14px 16px;border:1px solid var(--rr-border);border-radius:13px;background:var(--rr-panel)}.rona-rail-metric-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#7894a1}.rona-rail-metric-value{margin-top:6px;font-size:24px;font-weight:850;color:#f2fbff}.rona-rail-metric-note{margin-top:4px;font-size:10px;color:#718994}
      .rona-rail-grid{display:grid;grid-template-columns:minmax(360px,.9fr) minmax(480px,1.35fr);gap:12px;align-items:stretch}.rona-rail-panel{border:1px solid var(--rr-border);border-radius:14px;background:var(--rr-panel);overflow:hidden}.rona-rail-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 14px;border-bottom:1px solid rgba(113,169,194,.12)}.rona-rail-panel-title{font-size:13px;font-weight:800}.rona-rail-panel-note{font-size:9px;color:#718a96}.rona-rail-tools{display:flex;gap:7px;padding:10px 12px;border-bottom:1px solid rgba(113,169,194,.1)}.rona-rail-input,.rona-rail-select{height:32px;border:1px solid rgba(114,166,190,.18);border-radius:8px;background:#07141d;color:#dceaf0;font:600 10px Inter,Arial,sans-serif;outline:none}.rona-rail-input{min-width:0;flex:1;padding:0 10px}.rona-rail-select{padding:0 8px}.rona-rail-input:focus,.rona-rail-select:focus{border-color:rgba(102,198,232,.55)}
      .rona-rail-list{max-height:410px;overflow:auto}.rona-rail-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:12px 13px;border-bottom:1px solid rgba(113,169,194,.08);cursor:pointer;transition:background .15s ease}.rona-rail-row:hover,.rona-rail-row.is-selected{background:rgba(25,62,79,.42)}.rona-rail-row:last-child{border-bottom:0}.rona-rail-id{font-size:11px;font-weight:800;color:#eaf5f9}.rona-rail-route{margin-top:5px;font-size:10px;color:#9db2bb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rona-rail-deal{margin-top:4px;font-size:9px;color:#66818d}.rona-rail-status{align-self:start;padding:5px 7px;border-radius:999px;border:1px solid rgba(128,160,175,.2);font-size:8px;font-weight:800;color:#a9bdc6;background:rgba(14,31,40,.8)}.rona-rail-status.live{color:#9fe2f5;border-color:rgba(75,189,225,.3);background:rgba(19,86,108,.22)}.rona-rail-status.ok{color:#aee7cc;border-color:rgba(92,197,145,.28);background:rgba(25,88,62,.22)}.rona-rail-status.bad{color:#f4b0b3;border-color:rgba(229,94,100,.28);background:rgba(99,33,39,.22)}
      .rona-rail-empty{padding:34px 20px;text-align:center;color:#78919d;font-size:11px;line-height:1.55}.rona-rail-map-shell{position:relative;height:365px;min-height:365px;background:#07121a}.rona-rail-map{position:absolute;inset:0}.rona-rail-map-message{position:absolute;left:12px;bottom:12px;z-index:5;max-width:min(430px,calc(100% - 24px));padding:8px 10px;border:1px solid rgba(133,177,195,.24);border-radius:9px;background:rgba(5,15,22,.88);backdrop-filter:blur(8px);color:#a8bec7;font-size:9px;line-height:1.4;pointer-events:none}.rona-rail-map-state{position:absolute;right:12px;top:12px;z-index:5;padding:6px 9px;border-radius:999px;border:1px solid rgba(111,188,218,.25);background:rgba(5,18,26,.86);color:#b5d3df;font-size:9px;font-weight:800}.rona-rail-map-fallback{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;background:radial-gradient(circle at 50% 40%,rgba(31,73,91,.32),rgba(5,15,22,.96));color:#8da7b2;font-size:11px;line-height:1.5}
      .rona-rail-detail{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px}.rona-rail-detail-item{min-width:0;padding:10px;border:1px solid rgba(113,169,194,.11);border-radius:9px;background:rgba(5,17,25,.46)}.rona-rail-detail-label{font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#6f8995}.rona-rail-detail-value{margin-top:5px;font-size:10px;font-weight:700;color:#d8e8ee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rona-rail-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 13px;border:1px solid var(--rr-border);border-radius:11px;background:rgba(7,19,28,.66);color:#738c97;font-size:9px}.rona-rail-foot strong{color:#aac2cc;font-weight:750}
      .rona-rail-ws .maplibregl-ctrl-group{background:#0b1c27;border:1px solid rgba(118,170,191,.24);box-shadow:none}.rona-rail-ws .maplibregl-ctrl button{filter:invert(1);opacity:.8}.rona-rail-ws .maplibregl-ctrl-attrib{background:rgba(5,15,22,.76);color:#8ca4af;font-size:9px}.rona-rail-ws .maplibregl-ctrl-attrib a{color:#99bdca}
      @media(max-width:1100px){.rona-rail-grid{grid-template-columns:1fr}.rona-rail-map-shell{height:330px}.rona-rail-list{max-height:320px}}@media(max-width:720px){.rona-rail-hero{align-items:flex-start;flex-direction:column}.rona-rail-actions{justify-content:flex-start}.rona-rail-metrics{grid-template-columns:repeat(2,1fr)}.rona-rail-detail{grid-template-columns:repeat(2,1fr)}.rona-rail-grid{grid-template-columns:minmax(0,1fr)}.rona-rail-tools{flex-direction:column}.rona-rail-select{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function removeLegacyTariffMatrix(root){
    const re=/^Матрица\s+ЖД(?:-|–|—|\s)*тарифов$/iu;
    for(const heading of [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]){
      if(!re.test(text(heading.textContent)))continue;
      const block=heading.closest('article,.card,.panel,[class*="card"],[class*="panel"],section');
      if(block&&block!==root&&!block.contains(root)){block.remove();continue}
      const parent=heading.parentElement;
      if(parent&&parent!==root&&!parent.contains(root))parent.remove();
    }
    document.querySelectorAll('[data-rail-tariff-matrix],[data-rona-rail-tariffs],#rail-tariff-matrix,#railTariffMatrix').forEach(el=>{if(el!==root&&!el.contains(root))el.remove()});
  }

  function workspaceMarkup(){
    return `<div class="rona-rail-ws" id="rona-client-rail-workspace-v3">
      <section class="rona-rail-hero">
        <div><div class="rona-rail-kicker">RONA Trade · Operations</div><h1 class="rona-rail-title">Онлайн ЖД</h1><p class="rona-rail-sub">Операционная картина железнодорожных отправок по данным клиентского контура.</p></div>
        <div class="rona-rail-actions"><span class="rona-rail-pill" id="rona-rail-sync-pill">Автообновление · 30 с</span><button class="rona-rail-btn" id="rona-rail-refresh" type="button">Обновить</button></div>
      </section>
      <section class="rona-rail-metrics">
        <div class="rona-rail-metric"><div class="rona-rail-metric-label">Отправки</div><div class="rona-rail-metric-value" id="rona-rail-kpi-total">0</div><div class="rona-rail-metric-note">доступные клиенту</div></div>
        <div class="rona-rail-metric"><div class="rona-rail-metric-label">Открытые</div><div class="rona-rail-metric-value" id="rona-rail-kpi-open">0</div><div class="rona-rail-metric-note">без даты закрытия</div></div>
        <div class="rona-rail-metric"><div class="rona-rail-metric-label">Завершённые</div><div class="rona-rail-metric-value" id="rona-rail-kpi-closed">0</div><div class="rona-rail-metric-note">закрытые отправки</div></div>
        <div class="rona-rail-metric"><div class="rona-rail-metric-label">Маршруты</div><div class="rona-rail-metric-value" id="rona-rail-kpi-routes">0</div><div class="rona-rail-metric-note">уникальные направления</div></div>
      </section>
      <section class="rona-rail-grid">
        <article class="rona-rail-panel">
          <div class="rona-rail-panel-head"><div><div class="rona-rail-panel-title">Железнодорожные отправки</div><div class="rona-rail-panel-note" id="rona-rail-list-note">Синхронизация…</div></div></div>
          <div class="rona-rail-tools"><input class="rona-rail-input" id="rona-rail-search" type="search" placeholder="Поиск по отправке, сделке или маршруту" autocomplete="off"><select class="rona-rail-select" id="rona-rail-filter"><option value="ALL">Все</option><option value="OPEN">Открытые</option><option value="CLOSED">Завершённые</option></select></div>
          <div class="rona-rail-list" id="rona-rail-list"><div class="rona-rail-empty">Загрузка актуальных отправок…</div></div>
        </article>
        <article class="rona-rail-panel">
          <div class="rona-rail-panel-head"><div><div class="rona-rail-panel-title">Интерактивная карта</div><div class="rona-rail-panel-note">Панорамирование и масштабирование доступны постоянно</div></div></div>
          <div class="rona-rail-map-shell"><div class="rona-rail-map" id="rona-rail-map"></div><div class="rona-rail-map-state" id="rona-rail-map-state">Загрузка карты</div><div class="rona-rail-map-message" id="rona-rail-map-message">Карта работает независимо от сервиса позиционирования. Маркеры вагонов появятся только после публикации подтверждённых координат.</div></div>
          <div class="rona-rail-detail" id="rona-rail-detail"></div>
        </article>
      </section>
      <div class="rona-rail-foot"><span><strong>Источник:</strong> авторизованный серверный контур отправок</span><span id="rona-rail-last-sync">Последнее обновление: —</span></div>
    </div>`;
  }

  function isRailVisible(){
    const root=railRoot();
    if(!root||!root.isConnected)return false;
    const s=getComputedStyle(root);
    return s.display!=='none'&&s.visibility!=='hidden'&&root.getClientRects().length>0;
  }

  function bindWorkspace(root){
    root.querySelector('#rona-rail-refresh')?.addEventListener('click',()=>refresh(true));
    root.querySelector('#rona-rail-search')?.addEventListener('input',event=>{currentQuery=text(event.target?.value).toLowerCase();renderList()});
    root.querySelector('#rona-rail-filter')?.addEventListener('change',event=>{currentFilter=upper(event.target?.value)||'ALL';renderList()});
  }

  function ensureWorkspace(){
    const root=railRoot();
    if(!root)return null;
    removeLegacyTariffMatrix(root);
    if(root.dataset.ronaClientRailWorkspace!=='v3'||!root.querySelector('#rona-client-rail-workspace-v3')){
      if(map&&typeof map.remove==='function'){try{map.remove()}catch(_){ }}
      map=null;mapContainer=null;
      root.dataset.ronaClientRailWorkspace='v3';
      root.innerHTML=workspaceMarkup();
      injectStyle();
      bindWorkspace(root);
      workspaceRoot=root;
      render();
    }else workspaceRoot=root;
    return root;
  }

  function filteredShipments(){
    return shipments.filter(row=>{
      if(currentFilter==='OPEN'&&isClosed(row))return false;
      if(currentFilter==='CLOSED'&&!isClosed(row))return false;
      if(currentQuery){
        const hay=[shipmentKey(row),row?.deal_id,row?.dealId,row?.origin_location,row?.destination_location,row?.shipment_status].map(text).join(' ').toLowerCase();
        if(!hay.includes(currentQuery))return false;
      }
      return true;
    });
  }

  function renderMetrics(){
    const root=workspaceRoot||ensureWorkspace();if(!root)return;
    const total=shipments.length,closed=shipments.filter(isClosed).length,open=total-closed;
    const routes=new Set(shipments.map(routeText).filter(v=>v&&v!=='Маршрут не опубликован')).size;
    const values={total,open,closed,routes};
    for(const [name,value] of Object.entries(values)){const el=root.querySelector(`#rona-rail-kpi-${name}`);if(el)el.textContent=String(value)}
  }

  function renderDetails(){
    const root=workspaceRoot||ensureWorkspace();if(!root)return;
    let selected=shipments.find(row=>shipmentKey(row)===selectedShipmentId)||shipments[0]||null;
    if(selected&&!selectedShipmentId)selectedShipmentId=shipmentKey(selected);
    const detail=root.querySelector('#rona-rail-detail');
    const msg=root.querySelector('#rona-rail-map-message');
    if(!detail)return;
    if(!selected){
      detail.innerHTML='<div class="rona-rail-empty" style="grid-column:1/-1">Выберите отправку после её публикации в клиентском контуре.</div>';
      if(msg)msg.textContent='Карта готова к работе. Маркеры вагонов будут показаны только после публикации подтверждённых координат.';
      return;
    }
    const status=selected.shipment_status||selected.status;
    detail.innerHTML=`
      <div class="rona-rail-detail-item"><div class="rona-rail-detail-label">Отправка</div><div class="rona-rail-detail-value" title="${esc(shipmentKey(selected))}">${esc(shipmentKey(selected)||'—')}</div></div>
      <div class="rona-rail-detail-item"><div class="rona-rail-detail-label">Сделка</div><div class="rona-rail-detail-value" title="${esc(selected.deal_id||selected.dealId||'')}">${esc(selected.deal_id||selected.dealId||'—')}</div></div>
      <div class="rona-rail-detail-item"><div class="rona-rail-detail-label">Статус</div><div class="rona-rail-detail-value">${esc(statusLabel(status))}</div></div>
      <div class="rona-rail-detail-item"><div class="rona-rail-detail-label">Маршрут</div><div class="rona-rail-detail-value" title="${esc(routeText(selected))}">${esc(routeText(selected))}</div></div>
      <div class="rona-rail-detail-item"><div class="rona-rail-detail-label">План отправления</div><div class="rona-rail-detail-value">${esc(fmtDate(selected.planned_departure_at||selected.plannedDepartureAt))}</div></div>
      <div class="rona-rail-detail-item"><div class="rona-rail-detail-label">Факт отправления</div><div class="rona-rail-detail-value">${esc(fmtDate(selected.actual_departure_at||selected.actualDepartureAt))}</div></div>
      <div class="rona-rail-detail-item"><div class="rona-rail-detail-label">План прибытия</div><div class="rona-rail-detail-value">${esc(fmtDate(selected.planned_arrival_at||selected.plannedArrivalAt))}</div></div>
      <div class="rona-rail-detail-item"><div class="rona-rail-detail-label">Факт прибытия</div><div class="rona-rail-detail-value">${esc(fmtDate(selected.actual_arrival_at||selected.actualArrivalAt))}</div></div>`;
    if(msg)msg.textContent=`${routeText(selected)}. Карта доступна для навигации; точные позиции вагонов появятся только при наличии опубликованных координат.`;
  }

  function renderList(){
    const root=workspaceRoot||ensureWorkspace();if(!root)return;
    const list=root.querySelector('#rona-rail-list'),note=root.querySelector('#rona-rail-list-note');
    if(!list)return;
    const rows=filteredShipments();
    if(note)note.textContent=`Показано ${rows.length} из ${shipments.length}`;
    if(!rows.length){
      list.innerHTML=`<div class="rona-rail-empty">${shipments.length?'По текущему фильтру отправок нет.':'Железнодорожные отправки пока не опубликованы для этого клиентского контура.'}</div>`;
      renderDetails();
      return;
    }
    if(!rows.some(row=>shipmentKey(row)===selectedShipmentId))selectedShipmentId=shipmentKey(rows[0]);
    list.innerHTML=rows.map((row,index)=>{
      const key=shipmentKey(row),status=row.shipment_status||row.status;
      return `<div class="rona-rail-row ${key===selectedShipmentId?'is-selected':''}" data-rail-row="${index}" tabindex="0" role="button" aria-label="Открыть отправку ${esc(key)}"><div><div class="rona-rail-id">${esc(key||'Отправка')}</div><div class="rona-rail-route" title="${esc(routeText(row))}">${esc(routeText(row))}</div><div class="rona-rail-deal">${esc(row.deal_id||row.dealId||'')}</div></div><span class="rona-rail-status ${statusTone(status)}">${esc(statusLabel(status))}</span></div>`;
    }).join('');
    [...list.querySelectorAll('[data-rail-row]')].forEach((el,index)=>{
      const activate=()=>{selectedShipmentId=shipmentKey(rows[index]);renderList();renderDetails()};
      el.addEventListener('click',activate);
      el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate()}});
    });
    renderDetails();
  }

  function render(){renderMetrics();renderList()}

  function loadMapLibre(){
    if(window.maplibregl)return Promise.resolve(window.maplibregl);
    if(maplibrePromise)return maplibrePromise;
    maplibrePromise=new Promise((resolve,reject)=>{
      if(!document.querySelector(`link[href^="${MAPLIBRE_CSS}"]`)){
        const link=document.createElement('link');link.rel='stylesheet';link.href=MAPLIBRE_CSS;document.head.appendChild(link);
      }
      let script=document.querySelector(`script[src^="${MAPLIBRE_JS}"]`);
      if(script){
        script.addEventListener('load',()=>window.maplibregl?resolve(window.maplibregl):reject(new Error('MAPLIBRE_GLOBAL_MISSING')),{once:true});
        script.addEventListener('error',()=>reject(new Error('MAPLIBRE_LOAD_FAILED')),{once:true});
        return;
      }
      script=document.createElement('script');script.src=MAPLIBRE_JS;script.async=true;
      script.addEventListener('load',()=>window.maplibregl?resolve(window.maplibregl):reject(new Error('MAPLIBRE_GLOBAL_MISSING')),{once:true});
      script.addEventListener('error',()=>reject(new Error('MAPLIBRE_LOAD_FAILED')),{once:true});
      document.head.appendChild(script);
    });
    return maplibrePromise;
  }

  function setMapState(label,tone='normal'){
    const root=workspaceRoot||railRoot();const el=root?.querySelector('#rona-rail-map-state');if(!el)return;
    el.textContent=label;
    el.style.color=tone==='error'?'#f2b3b6':tone==='ok'?'#afe6ce':'#b5d3df';
  }

  async function ensureMap(){
    const root=ensureWorkspace();if(!root||!isRailVisible())return;
    const container=root.querySelector('#rona-rail-map');if(!container)return;
    if(map&&mapContainer===container){try{map.resize()}catch(_){ }return}
    setMapState('Загрузка карты');
    try{
      const lib=await loadMapLibre();
      if(!container.isConnected)return;
      container.innerHTML='';
      mapContainer=container;
      map=new lib.Map({container,center:DEFAULT_CENTER,zoom:2.25,minZoom:2,maxZoom:12,attributionControl:true,style:{version:8,sources:{osm:{type:'raster',tiles:[TILE_TEMPLATE],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm',type:'raster',source:'osm',minzoom:0,maxzoom:19}]}});
      map.addControl(new lib.NavigationControl({showCompass:false}),'top-left');
      map.on('load',()=>setMapState('Карта готова','ok'));
      map.on('error',event=>{if(event?.error)setMapState('Проверка картографического слоя','normal')});
      setTimeout(()=>{try{map.resize()}catch(_){ }},80);
    }catch(_){
      container.innerHTML='<div class="rona-rail-map-fallback">Базовый картографический слой временно недоступен.<br>Данные отправок продолжают обновляться автоматически.</div>';
      setMapState('Карта недоступна','error');
    }
  }

  async function fetchShipments(){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(SHIPMENTS_API,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal:controller.signal});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!Array.isArray(payload?.shipments))throw new Error(payload?.code||`HTTP_${response.status}`);
      return payload.shipments;
    }finally{clearTimeout(timer)}
  }

  function publishState(ok,errorCode=null){
    const state={
      shipments:[...shipments],
      source:'AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS',
      shipment_source:SHIPMENTS_API,
      auto_refresh:true,
      refresh_interval_ms:DATA_REFRESH_MS,
      movement_source:'NOT_CONNECTED',
      movement_publication:false,
      movements:[],
      last_sync_at:new Date().toISOString(),
      source_state:ok?'READY':'DEGRADED',
      error_code:errorCode
    };
    window.__RONA_RAIL__={state,refresh:()=>refresh(true)};
    window.__RONA_CLIENT_RAIL_REFRESH__=window.__RONA_RAIL__.refresh;
    document.documentElement.dataset.ronaClientRailMode='CLIENT_WORKSPACE_AUTO_30S';
    document.documentElement.dataset.ronaClientRailSourceState=state.source_state;
    document.documentElement.dataset.ronaClientRailTariffMatrix='REMOVED';
    window.dispatchEvent(new CustomEvent('rona:rail:update',{detail:state}));
    document.dispatchEvent(new CustomEvent('rona:rail:update',{detail:state}));
  }

  async function refresh(manual=false){
    if(refreshInFlight||document.visibilityState==='hidden')return;
    refreshInFlight=true;
    const root=ensureWorkspace();
    const button=root?.querySelector('#rona-rail-refresh'),pill=root?.querySelector('#rona-rail-sync-pill');
    if(button)button.disabled=true;
    if(pill)pill.textContent=manual?'Обновление…':'Автообновление · 30 с';
    try{
      shipments=await fetchShipments();
      publishState(true);
      render();
      const stamp=root?.querySelector('#rona-rail-last-sync');if(stamp)stamp.textContent=`Последнее обновление: ${new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date())}`;
      if(pill)pill.textContent='Автообновление · 30 с · данные актуальны';
    }catch(error){
      publishState(false,text(error?.message)||'REQUEST_FAILED');
      const note=root?.querySelector('#rona-rail-list-note');if(note)note.textContent='Серверные данные временно недоступны';
      if(pill)pill.textContent='Автообновление · восстанавливаю связь';
    }finally{
      refreshInFlight=false;
      if(button)button.disabled=false;
      ensureMap();
    }
  }

  function resume(){
    ensureWorkspace();
    refresh(true);
    setTimeout(ensureMap,0);
  }

  document.addEventListener('DOMContentLoaded',resume,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resume()});
  document.addEventListener('click',()=>setTimeout(()=>{if(isRailVisible())ensureMap()},0),true);
  window.addEventListener('pageshow',resume);
  window.addEventListener('focus',()=>{ensureWorkspace();if(isRailVisible())ensureMap()});
  window.setInterval(()=>refresh(false),DATA_REFRESH_MS);
  window.setInterval(()=>{ensureWorkspace();if(isRailVisible())ensureMap()},2500);
  injectStyle();
  ensureWorkspace();
  refresh(true);
})();
