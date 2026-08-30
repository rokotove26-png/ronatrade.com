(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  if(window.__RONA_CLIENT_RAIL_PRODUCTION__==='20260830-client-workspace-v3')return;
  window.__RONA_CLIENT_RAIL_PRODUCTION__='20260830-client-workspace-v3';

  const TILE_SELECTOR='img.rona-rail-v7-tile';
  const TILE_RETRY_AFTER_MS=30000;
  const DATA_REFRESH_MS=30000;
  const REQUEST_TIMEOUT_MS=12000;
  const SHIPMENTS_API='/portal/api/v1/client/shipments';
  const TARIFF_MATRIX_TITLES=new Set(['МАТРИЦА ЖД ТАРИФОВ','МАТРИЦА Ж/Д ТАРИФОВ','МАТРИЦА ЖЕЛЕЗНОДОРОЖНЫХ ТАРИФОВ']);
  let refreshInFlight=false;
  let lastShipments=[];
  let lastLoadOk=false;
  let filterText='';

  function tileSpec(src){
    const raw=String(src||'');
    let m=/^https:\/\/tile\.openstreetmap\.org\/(\d{1,2})\/(\d+)\/(\d+)\.png(?:\?.*)?$/i.exec(raw);
    if(m)return{z:m[1],x:m[2],y:m[3]};
    try{
      const u=new URL(raw,location.origin);
      m=/^\/portal\/map-assets\/osm\/(\d{1,2})\/(\d+)\/(\d+)\.png$/.exec(u.pathname);
      if(m)return{z:m[1],x:m[2],y:m[3]};
    }catch(_){ }
    return null;
  }
  function direct(spec){return `https://tile.openstreetmap.org/${spec.z}/${spec.x}/${spec.y}.png`}
  function proxy(spec){return `/portal/map-assets/osm/${spec.z}/${spec.x}/${spec.y}.png`}
  function sourceKind(img){
    const raw=String(img.currentSrc||img.src||'');
    return raw.includes('/portal/map-assets/osm/')?'proxy':raw.includes('tile.openstreetmap.org/')?'direct':'other';
  }
  function switchSource(img,target){
    const spec=tileSpec(img.currentSrc||img.src);
    if(!spec)return false;
    if(target==='proxy'){
      if(img.dataset.ronaRailProxyTried==='1')return false;
      img.dataset.ronaRailProxyTried='1';
      img.src=proxy(spec);
      return true;
    }
    if(target==='direct'){
      if(img.dataset.ronaRailDirectTried==='1')return false;
      img.dataset.ronaRailDirectTried='1';
      img.referrerPolicy='strict-origin-when-cross-origin';
      img.src=direct(spec);
      return true;
    }
    return false;
  }
  function recover(img){
    if(!(img instanceof HTMLImageElement))return;
    const kind=sourceKind(img);
    if(kind==='direct'){
      img.dataset.ronaRailDirectTried='1';
      if(switchSource(img,'proxy'))return;
    }else if(kind==='proxy'){
      img.dataset.ronaRailProxyTried='1';
      if(switchSource(img,'direct'))return;
    }
    img.dataset.ronaRailFailedAt=String(Date.now());
  }
  function manage(img){
    if(!(img instanceof HTMLImageElement)||!tileSpec(img.currentSrc||img.src))return;
    if(img.dataset.ronaRailManaged!=='1'){
      img.dataset.ronaRailManaged='1';
      img.addEventListener('load',()=>{img.dataset.ronaRailFailedAt=''});
      img.addEventListener('error',()=>recover(img));
    }
    if(img.complete&&img.naturalWidth===0){
      const failedAt=Number(img.dataset.ronaRailFailedAt||0);
      if(failedAt&&Date.now()-failedAt>=TILE_RETRY_AFTER_MS){
        img.dataset.ronaRailDirectTried='';
        img.dataset.ronaRailProxyTried='';
        img.dataset.ronaRailFailedAt='';
      }
      recover(img);
    }
  }

  function norm(value){return String(value||'').replace(/\s+/g,' ').trim().toUpperCase()}
  function railTitle(){return [...document.querySelectorAll('h1,h2,h3')].find(el=>norm(el.textContent)==='ОНЛАЙН ЖД')||null}
  function railRoot(){
    for(const selector of ['#page-rail','#page-monitoring','[data-page="rail"]','[data-page="monitoring"]']){
      const el=document.querySelector(selector);
      if(el)return el;
    }
    const title=railTitle();
    return title?.closest('section,[id^="page-"],main,.page')||title?.parentElement||null;
  }
  function findVisualContainer(node,root){
    let cur=node;
    for(let i=0;i<6&&cur&&cur!==root;i++,cur=cur.parentElement){
      const cls=String(cur.className||'');
      if(cur.tagName==='ARTICLE'||/card|panel|tile|box|matrix|tariff/i.test(cls))return cur;
    }
    return node.parentElement&&node.parentElement!==root?node.parentElement:null;
  }
  function removeClientTariffMatrix(){
    const root=railRoot();
    if(!root)return 0;
    let removed=0;
    for(const node of root.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span,p')){
      if(!TARIFF_MATRIX_TITLES.has(norm(node.textContent)))continue;
      const box=findVisualContainer(node,root);
      if(!box||box===root||box.dataset.ronaClientRailTariffRemoved==='1')continue;
      box.dataset.ronaClientRailTariffRemoved='1';
      box.hidden=true;
      box.setAttribute('aria-hidden','true');
      removed++;
    }
    document.documentElement.dataset.ronaClientRailTariffMatrix='REMOVED';
    return removed;
  }

  function ensureStyle(){
    if(document.getElementById('ronaClientRailWorkspaceStyleV3'))return;
    const style=document.createElement('style');
    style.id='ronaClientRailWorkspaceStyleV3';
    style.textContent=`
      .rona-client-rail-current-v3{--rr-accent:#e35054;--rr-border:rgba(148,181,198,.20);--rr-bg:rgba(7,16,23,.72);--rr-bg2:rgba(12,25,34,.82);--rr-muted:#8fa6b2;--rr-text:#eef5f8}
      #rona-client-rail-workspace-v3{display:grid;gap:14px;margin:14px 0 18px;padding:0;color:var(--rr-text);font-family:Inter,Arial,sans-serif}
      #rona-client-rail-workspace-v3 *{box-sizing:border-box}
      .rr-command{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:16px 18px;border:1px solid var(--rr-border);border-radius:15px;background:linear-gradient(135deg,rgba(14,31,42,.94),rgba(6,15,22,.90));box-shadow:0 14px 40px rgba(0,0,0,.18)}
      .rr-command-kicker{font-size:10px;font-weight:800;letter-spacing:.12em;color:#7fa1b1;text-transform:uppercase}
      .rr-command-title{margin-top:5px;font-size:16px;font-weight:800;color:#f3f8fa}
      .rr-command-note{margin-top:4px;max-width:720px;font-size:12px;line-height:1.45;color:var(--rr-muted)}
      .rr-live{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;align-items:center;min-width:230px}
      .rr-pill{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid rgba(126,169,191,.23);border-radius:999px;background:rgba(4,12,18,.55);font-size:10px;font-weight:750;color:#b5c8d1;white-space:nowrap}
      .rr-dot{width:7px;height:7px;border-radius:50%;background:#6ecb8d;box-shadow:0 0 0 3px rgba(110,203,141,.10)}
      .rr-pill[data-state="DEGRADED"] .rr-dot{background:#e5ad5e;box-shadow:0 0 0 3px rgba(229,173,94,.10)}
      .rr-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .rr-metric{padding:13px 14px;border:1px solid var(--rr-border);border-radius:13px;background:var(--rr-bg)}
      .rr-metric-label{font-size:10px;font-weight:700;letter-spacing:.04em;color:#829aa7;text-transform:uppercase}
      .rr-metric-value{margin-top:6px;font-size:20px;font-weight:850;color:#f5f9fb}
      .rr-metric-sub{margin-top:2px;font-size:10px;color:#78909d}
      .rr-panel{overflow:hidden;border:1px solid var(--rr-border);border-radius:15px;background:var(--rr-bg)}
      .rr-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;border-bottom:1px solid rgba(148,181,198,.14)}
      .rr-panel-title{font-size:12px;font-weight:800;color:#eaf3f7}
      .rr-tools{display:flex;align-items:center;gap:8px;min-width:0}
      .rr-search{width:min(320px,44vw);padding:8px 10px;border:1px solid rgba(136,174,193,.22);border-radius:9px;background:rgba(3,11,16,.62);color:#eef5f8;font:600 11px/1.2 Inter,Arial,sans-serif;outline:none}
      .rr-search:focus{border-color:rgba(133,191,220,.58);box-shadow:0 0 0 3px rgba(101,170,203,.10)}
      .rr-btn{padding:8px 11px;border:1px solid rgba(190,213,224,.23);border-radius:9px;background:rgba(14,31,41,.85);color:#dce9ef;font:750 10px/1 Inter,Arial,sans-serif;cursor:pointer}
      .rr-btn:hover{border-color:rgba(227,80,84,.50);background:rgba(227,80,84,.10)}
      .rr-table-wrap{overflow:auto;max-width:100%}
      .rr-table{width:100%;border-collapse:collapse;min-width:780px}
      .rr-table th{padding:9px 12px;background:rgba(6,17,24,.62);color:#78929f;font-size:9px;font-weight:800;letter-spacing:.06em;text-align:left;text-transform:uppercase;white-space:nowrap}
      .rr-table td{padding:11px 12px;border-top:1px solid rgba(148,181,198,.10);color:#cfdee5;font-size:10px;line-height:1.35;vertical-align:middle}
      .rr-table tbody tr:hover{background:rgba(111,162,187,.055)}
      .rr-deal{font-weight:800;color:#f0f6f9}
      .rr-route{font-weight:650;color:#d9e6eb}
      .rr-status{display:inline-flex;max-width:180px;padding:4px 7px;border:1px solid rgba(143,181,199,.18);border-radius:999px;background:rgba(10,25,34,.75);color:#a9c1cd;font-size:9px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rr-empty{padding:34px 18px;text-align:center;color:#829aa7;font-size:11px;line-height:1.5}
      .rr-empty strong{display:block;margin-bottom:5px;color:#cddde5;font-size:12px}
      .rona-client-rail-current-v3 .rona-rail-v7-real,.rona-client-rail-current-v3 .rona-rail-v4-map{border-radius:15px!important;border-color:rgba(148,181,198,.22)!important;box-shadow:0 14px 40px rgba(0,0,0,.13)!important}
      .rona-client-rail-current-v3 .rona-rail-v7-map-viewport{border-radius:12px!important}
      @media(max-width:900px){.rr-command{display:grid}.rr-live{justify-content:flex-start;min-width:0}.rr-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.rr-panel-head{align-items:flex-start;flex-direction:column}.rr-tools{width:100%}.rr-search{width:100%;flex:1}}
      @media(max-width:560px){.rr-metrics{grid-template-columns:1fr 1fr}.rr-command{padding:14px}.rr-tools{display:grid;grid-template-columns:1fr auto}.rr-metric-value{font-size:18px}}
    `;
    document.head.appendChild(style);
  }

  function fmtDate(value){
    if(!value)return '—';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return String(value);
    try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d)}catch(_){return d.toLocaleString()}
  }
  function statusLabel(value){
    const raw=String(value||'').trim();
    const code=raw.toUpperCase();
    const known={PLANNED:'Запланировано',READY:'Готово к отправке',DEPARTED:'Отправлено',IN_TRANSIT:'В пути',ARRIVED:'Прибыло',DELIVERED:'Доставлено',COMPLETED:'Завершено',CLOSED:'Закрыто',CANCELLED:'Отменено'};
    return known[code]||raw.replace(/_/g,' ')||'—';
  }
  function shipmentKey(row){return [row?.shipment_id,row?.deal_id,row?.origin_location,row?.destination_location,row?.shipment_status].map(v=>String(v||'').toLowerCase()).join(' ')}
  function visibleShipments(){
    const q=filterText.trim().toLowerCase();
    return q?lastShipments.filter(row=>shipmentKey(row).includes(q)):lastShipments;
  }
  function uniqueRoutes(rows){
    const set=new Set();
    for(const row of rows){
      const a=String(row?.origin_location||'').trim(),b=String(row?.destination_location||'').trim();
      if(a||b)set.add(`${a}→${b}`);
    }
    return set.size;
  }
  function ensureWorkspace(){
    const root=railRoot();
    if(!root)return null;
    root.classList.add('rona-client-rail-current-v3');
    ensureStyle();
    removeClientTariffMatrix();
    let workspace=root.querySelector('#rona-client-rail-workspace-v3');
    if(workspace)return workspace;
    workspace=document.createElement('section');
    workspace.id='rona-client-rail-workspace-v3';
    workspace.setAttribute('aria-label','Железнодорожные отгрузки клиента');
    workspace.innerHTML=`
      <div class="rr-command">
        <div><div class="rr-command-kicker">Железнодорожные отгрузки</div><div class="rr-command-title">Рабочая панель клиента</div><div class="rr-command-note">Текущие железнодорожные отгрузки из серверного контура RONA Trade. Раздел обновляется автоматически; внешнее позиционирование вагонов сейчас не используется.</div></div>
        <div class="rr-live"><span class="rr-pill" id="rrLiveState"><span class="rr-dot"></span><span id="rrLiveText">Автообновление включено</span></span><span class="rr-pill" id="rrUpdated">Ожидание данных</span></div>
      </div>
      <div class="rr-metrics">
        <div class="rr-metric"><div class="rr-metric-label">ЖД отгрузки</div><div class="rr-metric-value" id="rrMetricTotal">—</div><div class="rr-metric-sub">в текущем клиентском контуре</div></div>
        <div class="rr-metric"><div class="rr-metric-label">Маршруты</div><div class="rr-metric-value" id="rrMetricRoutes">—</div><div class="rr-metric-sub">уникальные направления</div></div>
        <div class="rr-metric"><div class="rr-metric-label">Со статусом</div><div class="rr-metric-value" id="rrMetricStatuses">—</div><div class="rr-metric-sub">серверный статус указан</div></div>
        <div class="rr-metric"><div class="rr-metric-label">Обновление</div><div class="rr-metric-value">30 с</div><div class="rr-metric-sub">автоматически и по кнопке</div></div>
      </div>
      <div class="rr-panel">
        <div class="rr-panel-head"><div class="rr-panel-title">Отгрузки и маршруты</div><div class="rr-tools"><input class="rr-search" id="rrSearch" type="search" placeholder="Сделка, маршрут или статус" autocomplete="off"><button class="rr-btn" id="rrRefresh" type="button">Обновить</button></div></div>
        <div class="rr-table-wrap" id="rrTableWrap"></div>
      </div>
    `;
    const title=railTitle();
    const anchor=title?.closest('header')||title;
    if(anchor?.parentNode)anchor.parentNode.insertBefore(workspace,anchor.nextSibling);else root.prepend(workspace);
    const search=workspace.querySelector('#rrSearch');
    if(search)search.addEventListener('input',()=>{filterText=search.value||'';renderWorkspace()});
    const button=workspace.querySelector('#rrRefresh');
    if(button)button.addEventListener('click',()=>refresh());
    return workspace;
  }
  function renderWorkspace(){
    const workspace=ensureWorkspace();
    if(!workspace)return;
    const rows=visibleShipments();
    const total=workspace.querySelector('#rrMetricTotal'),routes=workspace.querySelector('#rrMetricRoutes'),statuses=workspace.querySelector('#rrMetricStatuses'),wrap=workspace.querySelector('#rrTableWrap');
    if(total)total.textContent=String(lastShipments.length);
    if(routes)routes.textContent=String(uniqueRoutes(lastShipments));
    if(statuses)statuses.textContent=String(lastShipments.filter(row=>String(row?.shipment_status||'').trim()).length);
    if(!wrap)return;
    if(!lastLoadOk){
      wrap.innerHTML='<div class="rr-empty"><strong>Данные временно недоступны</strong>Повторная попытка выполняется автоматически каждые 30 секунд.</div>';
      return;
    }
    if(!rows.length){
      const message=lastShipments.length?'По текущему фильтру ничего не найдено.':'Сервер не вернул ЖД-отгрузки по текущему клиентскому контуру.';
      wrap.innerHTML=`<div class="rr-empty"><strong>${lastShipments.length?'Нет совпадений':'Нет опубликованных отгрузок'}</strong>${message}</div>`;
      return;
    }
    const table=document.createElement('table');
    table.className='rr-table';
    table.innerHTML='<thead><tr><th>Отгрузка</th><th>Сделка</th><th>Маршрут</th><th>Статус</th><th>Отправление</th><th>Прибытие</th></tr></thead>';
    const body=document.createElement('tbody');
    for(const row of rows){
      const tr=document.createElement('tr');
      const departure=row?.actual_departure_at||row?.planned_departure_at;
      const arrival=row?.actual_arrival_at||row?.planned_arrival_at;
      const values=[row?.shipment_id||'—',row?.deal_id||'—',`${row?.origin_location||'—'} → ${row?.destination_location||'—'}`,statusLabel(row?.shipment_status),fmtDate(departure),fmtDate(arrival)];
      values.forEach((value,index)=>{const td=document.createElement('td');td.textContent=String(value);if(index===1)td.className='rr-deal';if(index===2)td.className='rr-route';if(index===3){const span=document.createElement('span');span.className='rr-status';span.textContent=String(value);td.textContent='';td.append(span)}tr.append(td)});
      body.append(tr);
    }
    table.append(body);
    wrap.replaceChildren(table);
  }
  function paintStatus(ok,lastSyncAt){
    document.documentElement.dataset.ronaClientRailMode='AUTO_30S';
    document.documentElement.dataset.ronaClientRailSourceState=ok?'READY':'DEGRADED';
    if(lastSyncAt)document.documentElement.dataset.ronaClientRailLastSync=lastSyncAt;
    const workspace=ensureWorkspace();
    if(!workspace)return;
    const state=workspace.querySelector('#rrLiveState'),text=workspace.querySelector('#rrLiveText'),updated=workspace.querySelector('#rrUpdated');
    if(state)state.dataset.state=ok?'READY':'DEGRADED';
    if(text)text.textContent=ok?'Автообновление включено':'Восстанавливаю соединение';
    if(updated)updated.textContent=lastSyncAt?`Обновлено ${fmtDate(lastSyncAt)}`:'Ожидание данных';
  }

  async function fetchShipments(){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(SHIPMENTS_API,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal:controller.signal});
      const payload=await response.json().catch(()=>({}));
      return{ok:response.ok&&Array.isArray(payload?.shipments),shipments:Array.isArray(payload?.shipments)?payload.shipments:[]};
    }finally{clearTimeout(timer)}
  }
  function publishState(lastSyncAt){
    const current=window.__RONA_RAIL__&&typeof window.__RONA_RAIL__==='object'?window.__RONA_RAIL__:{};
    const previous=current.state&&typeof current.state==='object'?current.state:{};
    const state={...previous,shipments:lastShipments,movements:[],source:'AUTHORITATIVE_SERVER_CLIENT_SHIPMENTS',shipment_source:SHIPMENTS_API,auto_refresh:true,refresh_interval_ms:DATA_REFRESH_MS,last_sync_at:lastSyncAt,source_state:lastLoadOk?'READY':'DEGRADED',external_positioning_used:false};
    current.state=state;
    current.refresh=refresh;
    window.__RONA_RAIL__=current;
    window.__RONA_CLIENT_RAIL_REFRESH__=refresh;
    window.dispatchEvent(new CustomEvent('rona:rail:update',{detail:state}));
    document.dispatchEvent(new CustomEvent('rona:rail:update',{detail:state}));
  }
  function scanTiles(){
    if(document.visibilityState==='hidden')return;
    document.querySelectorAll(TILE_SELECTOR).forEach(manage);
    removeClientTariffMatrix();
    ensureWorkspace();
  }
  async function refresh(){
    if(refreshInFlight||document.visibilityState==='hidden')return;
    refreshInFlight=true;
    const startedAt=Date.now(),lastSyncAt=new Date().toISOString();
    const button=ensureWorkspace()?.querySelector('#rrRefresh');
    if(button){button.disabled=true;button.textContent='Обновляю…'}
    try{
      try{
        const result=await fetchShipments();
        lastLoadOk=result.ok;
        if(result.ok)lastShipments=result.shipments;
      }catch(_){lastLoadOk=false}
      renderWorkspace();
      paintStatus(lastLoadOk,lastSyncAt);
      publishState(lastSyncAt);
    }finally{
      refreshInFlight=false;
      if(button){button.disabled=false;button.textContent='Обновить'}
      document.documentElement.dataset.ronaClientRailRefreshMs=String(Date.now()-startedAt);
      scanTiles();
    }
  }
  function resume(){
    if(document.visibilityState==='hidden')return;
    ensureWorkspace();
    removeClientTariffMatrix();
    scanTiles();
    refresh();
  }

  document.addEventListener('DOMContentLoaded',resume,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resume()});
  window.addEventListener('pageshow',resume);
  window.addEventListener('focus',resume);
  window.setInterval(scanTiles,5000);
  window.setInterval(refresh,DATA_REFRESH_MS);
  ensureWorkspace();
  removeClientTariffMatrix();
  scanTiles();
  refresh();
})();
