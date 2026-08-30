(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260830-movizor-required-v1';
  if(window.__RONA_CLIENT_RAIL_MOVIZOR_GATE__===MARK)return;
  window.__RONA_CLIENT_RAIL_MOVIZOR_GATE__=MARK;

  const PROVIDER_API='/portal/api/v1/client/rail';
  const PROVIDER='MOVIZOR';
  const CHECK_MS=30000;
  let providerLive=false;
  let providerCode='RAIL_PROVIDER_CHECK_PENDING';
  let providerCheckedAt='';
  let checkInFlight=false;

  const text=value=>String(value??'').trim();
  const upper=value=>text(value).toUpperCase();

  function railRoot(){
    for(const selector of ['#page-rail','#page-monitoring','[data-page="rail"]','[data-page="monitoring"]']){
      const el=document.querySelector(selector);
      if(el)return el;
    }
    return null;
  }

  function runtimeHasMovizor(){
    const state=window.__RONA_RAIL__?.state;
    return upper(state?.movement_source)===PROVIDER && state?.movement_publication===true;
  }

  function operational(){
    return providerLive&&runtimeHasMovizor();
  }

  function installStyle(){
    if(document.getElementById('rona-client-rail-movizor-gate-v1-style'))return;
    const style=document.createElement('style');
    style.id='rona-client-rail-movizor-gate-v1-style';
    style.textContent=`
      .rona-rail-ws{font-family:inherit!important;gap:12px!important}
      .rona-rail-kicker{font-size:8.5px!important;letter-spacing:.09em!important}
      .rona-rail-title{font-size:18px!important;line-height:1.15!important;font-weight:800!important}
      .rona-rail-sub{font-size:10.5px!important;line-height:1.4!important}
      .rona-rail-pill,.rona-rail-btn{font-family:inherit!important;font-size:9px!important}
      .rona-rail-metric-label{font-size:8.5px!important}.rona-rail-metric-value{font-size:18px!important}.rona-rail-metric-note{font-size:9px!important}
      .rona-rail-panel-title{font-size:11.5px!important}.rona-rail-panel-note{font-size:8.5px!important}
      .rona-rail-input,.rona-rail-select{font-family:inherit!important;font-size:9px!important}
      .rona-rail-id{font-size:10.5px!important}.rona-rail-route{font-size:9px!important}.rona-rail-deal{font-size:8.4px!important}.rona-rail-status{font-size:8.5px!important}
      .rona-rail-empty,.rona-rail-map-fallback{font-size:10px!important}.rona-rail-map-message,.rona-rail-map-state{font-size:8.5px!important}
      .rona-rail-detail-label{font-size:7.7px!important}.rona-rail-detail-value{font-size:9.4px!important}.rona-rail-foot{font-size:8.5px!important}
      [data-rona-movizor-ready="false"] .rona-rail-map{display:none!important}
      [data-rona-movizor-ready="false"] .rona-rail-tools{opacity:.45;pointer-events:none}
      [data-rona-movizor-ready="false"] .rona-rail-list{display:none!important}
      [data-rona-movizor-ready="false"] .rona-rail-detail{display:none!important}
      [data-rona-movizor-ready="false"] .rona-rail-metric-value{color:#8aa4af!important}
      .rona-movizor-blocker{margin:0 12px 12px;padding:16px;border:1px solid rgba(228,186,82,.24);border-radius:11px;background:linear-gradient(180deg,rgba(83,61,18,.15),rgba(24,29,31,.28));color:#d7e7ed}
      .rona-movizor-blocker strong{display:block;font-size:11.5px;color:#f1d58b}.rona-movizor-blocker p{margin:6px 0 0;font-size:9.5px;line-height:1.45;color:#91adba}
      .rona-movizor-blocker-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
      .rona-movizor-blocker-item{padding:9px 10px;border:1px solid rgba(110,164,188,.14);border-radius:9px;background:rgba(5,19,29,.42)}
      .rona-movizor-blocker-item span{display:block;font-size:7.7px;letter-spacing:.07em;text-transform:uppercase;color:#6f93a2}.rona-movizor-blocker-item b{display:block;margin-top:5px;font-size:9.4px;color:#d7e9f0}
      .rona-movizor-map-blocker{position:absolute;inset:0;z-index:8;display:grid;place-items:center;padding:24px;text-align:center;background:radial-gradient(circle at 50% 42%,rgba(28,61,76,.25),rgba(5,15,22,.97));color:#8faab6;font-size:10px;line-height:1.5}
      @media(max-width:760px){.rona-movizor-blocker-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function blockerMarkup(){
    const providerStatus=providerLive?'Шлюз доступен':'Не подключён';
    const publication=runtimeHasMovizor()?'Включена':'Отключена';
    return `<div class="rona-movizor-blocker" id="rona-movizor-blocker">
      <strong>Онлайн ЖД не введён в эксплуатацию</strong>
      <p>Рабочий статус раздела допускается только после фактического подключения MOVIZOR, получения авторитетных данных о вагонах и включения клиентской публикации. До этого момента нулевые показатели не считаются фактом отсутствия отправок.</p>
      <div class="rona-movizor-blocker-grid">
        <div class="rona-movizor-blocker-item"><span>Провайдер</span><b>${PROVIDER}</b></div>
        <div class="rona-movizor-blocker-item"><span>Подключение</span><b>${providerStatus}</b></div>
        <div class="rona-movizor-blocker-item"><span>Публикация движений</span><b>${publication}</b></div>
      </div>
    </div>`;
  }

  function enforce(){
    installStyle();
    const root=railRoot();
    if(!root)return;
    const live=operational();
    root.dataset.ronaMovizorReady=live?'true':'false';
    document.documentElement.dataset.ronaClientRailProvider=PROVIDER;
    document.documentElement.dataset.ronaClientRailOperational=live?'true':'false';
    document.documentElement.dataset.ronaClientRailProviderCode=providerCode;

    const button=root.querySelector('#rona-rail-refresh');
    const pill=root.querySelector('#rona-rail-sync-pill');
    const mapState=root.querySelector('#rona-rail-map-state');
    const mapShell=root.querySelector('.rona-rail-map-shell');

    if(live){
      root.querySelector('#rona-movizor-blocker')?.remove();
      root.querySelector('#rona-movizor-map-blocker')?.remove();
      if(button)button.disabled=false;
      return;
    }

    if(button)button.disabled=true;
    if(pill)pill.textContent='MOVIZOR · подключение требуется';
    if(mapState)mapState.textContent='MOVIZOR не подключён';
    for(const id of ['total','open','closed','routes']){
      const value=root.querySelector(`#rona-rail-kpi-${id}`);
      if(value)value.textContent='—';
    }
    const metricNotes=root.querySelectorAll('.rona-rail-metric-note');
    metricNotes.forEach(node=>{node.textContent='после подключения MOVIZOR'});

    const leftPanel=root.querySelector('.rona-rail-grid .rona-rail-panel');
    if(leftPanel&&!root.querySelector('#rona-movizor-blocker'))leftPanel.insertAdjacentHTML('beforeend',blockerMarkup());
    if(mapShell&&!root.querySelector('#rona-movizor-map-blocker')){
      const block=document.createElement('div');
      block.id='rona-movizor-map-blocker';
      block.className='rona-movizor-map-blocker';
      block.innerHTML='<div><strong style="display:block;color:#d6e8ef;font-size:11.5px;margin-bottom:6px">Интерактивная карта недоступна</strong>MOVIZOR не подключён к production-контуру. Карта и координаты вагонов будут открыты только после подтверждённого подключения и публикации движения.</div>';
      mapShell.appendChild(block);
    }
  }

  async function checkProvider(){
    if(checkInFlight)return;
    checkInFlight=true;
    try{
      const response=await fetch(PROVIDER_API,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      const payload=await response.json().catch(()=>({}));
      providerCheckedAt=new Date().toISOString();
      const declaredProvider=upper(payload?.provider);
      const enabled=payload?.production_enabled===true||payload?.client_publication_enabled===true||payload?.publication_enabled===true||payload?.enabled===true;
      providerLive=response.ok&&payload?.ok!==false&&declaredProvider===PROVIDER&&enabled;
      providerCode=providerLive?'MOVIZOR_PROVIDER_GATE_READY':text(payload?.code)||`HTTP_${response.status}`;
    }catch(error){
      providerLive=false;
      providerCode=text(error?.message)||'MOVIZOR_PROVIDER_CHECK_FAILED';
      providerCheckedAt=new Date().toISOString();
    }finally{
      checkInFlight=false;
      enforce();
      window.__RONA_CLIENT_RAIL_MOVIZOR_STATE__={provider:PROVIDER,provider_live:providerLive,runtime_publishing:runtimeHasMovizor(),operational:operational(),provider_code:providerCode,checked_at:providerCheckedAt};
    }
  }

  document.addEventListener('rona:rail:update',enforce);
  document.addEventListener('DOMContentLoaded',()=>{enforce();checkProvider()},{once:true});
  window.addEventListener('pageshow',()=>{enforce();checkProvider()});
  window.addEventListener('focus',()=>{enforce();checkProvider()});
  setInterval(enforce,1500);
  setInterval(checkProvider,CHECK_MS);
  enforce();
  checkProvider();
})();
