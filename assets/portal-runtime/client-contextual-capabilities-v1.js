(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260903-client-contextual-capabilities-v1';
  if(window.__RONA_CLIENT_CONTEXTUAL_CAPABILITIES__===MARK)return;
  window.__RONA_CLIENT_CONTEXTUAL_CAPABILITIES__=MARK;

  const API='/portal/api';
  const TERMINAL_DEALS=new Set(['CLOSED','COMPLETED','DONE','CANCELLED','CANCELED','ARCHIVED','SUPERSEDED','RESOURCE_DENIED']);
  const TERMINAL_APPS=new Set(['DEAL_REGISTERED','ARCHIVED','CANCELLED','CANCELED','REJECTED']);
  const CLOSING_RE=/(CLOS|CLOSED|COMPLET|DONE|ARCHIV|ЗАКРЫВ|АКТ|УПД|СЧЕТ[- ]?ФАКТУР|ИНВОЙС|ТОРГ|CMR|ЖД|НАКЛАДН)/iu;
  const MARKET_ANALYTICS_RE=/(ANALYT|FORECAST|ПРОГНОЗ|АНАЛИТ)/iu;
  const MARKET_NEWS_RE=/(NEWS|НОВОСТ)/iu;
  const moduleByNavLabel=new Map([
    ['главная','home'],
    ['мои компании','companies'],
    ['цены','prices'],
    ['заявки','applications'],
    ['сделки','deals'],
    ['платежи и взаиморасчеты','payments'],
    ['платежи и взаиморасчёты','payments'],
    ['платежи','payments'],
    ['онлайн жд','rail'],
    ['закрывающие документы','closingDocuments'],
    ['архив сделок','archive'],
    ['претензии','claims'],
    ['сообщения','messages'],
    ['аналитика','analytics'],
    ['новости топливного рынка снг','news']
  ]);
  const state={ctx:null,detail:null,rail:null,shipments:null,claims:null,market:null,capabilities:null,loading:null,contextKey:'',observer:null,scheduled:false,syncing:false,loadSeq:0};
  const norm=v=>String(v??'').replace(/\s+/gu,' ').trim();
  const low=v=>norm(v).toLocaleLowerCase('ru-RU').replaceAll('ё','е');
  const upper=v=>norm(v).toUpperCase();
  const esc=v=>norm(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr=v=>Array.isArray(v)?v:[];
  const authority=()=>window.RONA_CLIENT_CONTEXT||null;
  const contextKey=c=>norm(c?.client_id)+'|'+norm(c?.contract_id);
  const displayName=ctx=>norm(document.documentElement.dataset.ronaClientDisplayName)||norm(ctx?.legal_name)||norm(ctx?.client_id)||'Компания';
  const visible=el=>{if(!el||!el.isConnected||el.hidden)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
  const activeDeals=detail=>arr(detail?.deals).filter(d=>!TERMINAL_DEALS.has(upper(d?.business_status||d?.status||d?.current_status)));
  const terminalDeals=detail=>arr(detail?.deals).filter(d=>TERMINAL_DEALS.has(upper(d?.business_status||d?.status||d?.current_status)));
  const activeApps=detail=>arr(detail?.applications).filter(a=>!TERMINAL_APPS.has(upper(a?.status)));
  const terminalApps=detail=>arr(detail?.applications).filter(a=>TERMINAL_APPS.has(upper(a?.status)));

  async function request(path){
    try{
      const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
      const body=await r.json().catch(()=>null);
      if(!r.ok||body?.ok===false)return null;
      return body;
    }catch{return null}
  }
  function optionalRows(payload,key){
    if(!payload)return[];
    if(Array.isArray(payload))return payload;
    if(Array.isArray(payload[key]))return payload[key];
    if(Array.isArray(payload?.data?.[key]))return payload.data[key];
    return[];
  }
  function closingDocuments(detail){
    return arr(detail?.documents).filter(d=>CLOSING_RE.test(norm(d?.document_type)+' '+norm(d?.authoritative_filename)));
  }
  function marketKinds(payload){
    const rows=optionalRows(payload,'market');
    let analytics=0,news=0;
    for(const row of rows){
      const probe=[row?.item_type,row?.publication_type,row?.title,row?.headline,row?.forecast_scenario,row?.analytics_unit].map(norm).join(' ');
      if(MARKET_NEWS_RE.test(probe))news++;
      else if(MARKET_ANALYTICS_RE.test(probe)||row?.actual_value!=null||row?.forecast_value!=null)analytics++;
    }
    return{analytics,news,total:rows.length};
  }
  function cap(enabled,count=0,emptyAllowed=false){
    return Object.freeze({enabled:Boolean(enabled),count:Number(count)||0,state:enabled?(count>0?'available-data':(emptyAllowed?'available-empty':'available-data')):'unavailable'});
  }
  function computeCapabilities(){
    const detail=state.detail||{},deals=arr(detail.deals),apps=arr(detail.applications),payments=arr(detail.payments),prices=arr(detail.prices);
    const actDeals=activeDeals(detail),termDeals=terminalDeals(detail),termApps=terminalApps(detail),closing=closingDocuments(detail);
    const railRows=[...optionalRows(state.rail,'rail'),...optionalRows(state.rail,'wagons'),...optionalRows(state.rail,'rail_documents')];
    const shipmentRows=optionalRows(state.shipments,'shipments');
    const railEnabled=Boolean(state.rail?.production_enabled)||railRows.length>0||shipmentRows.length>0;
    const claimRows=optionalRows(state.claims,'claims');
    const market=marketKinds(state.market);
    const financeEnabled=payments.length>0||actDeals.length>0;
    const closingEnabled=closing.length>0||deals.some(d=>CLOSING_RE.test(norm(d?.business_status||d?.status||d?.current_status||d?.current_status_label)));
    const archiveCount=termDeals.length+termApps.length;
    return Object.freeze({
      home:cap(true,1),
      companies:cap(true,authority()?.getAuthorizedContexts?.().length||1),
      prices:cap(prices.length>0,prices.length),
      applications:cap(apps.length>0||prices.length>0,apps.length,prices.length>0),
      deals:cap(deals.length>0,deals.length),
      payments:cap(financeEnabled,payments.length,actDeals.length>0),
      rail:cap(railEnabled,railRows.length+shipmentRows.length,railEnabled),
      closingDocuments:cap(closingEnabled,closing.length,closingEnabled),
      archive:cap(archiveCount>0,archiveCount),
      claims:cap(claimRows.length>0,claimRows.length),
      messages:cap(Boolean(state.ctx),0,true),
      analytics:cap(market.analytics>0,market.analytics),
      news:cap(market.news>0,market.news)
    });
  }
  function capability(key){return state.capabilities?.[key]||cap(false,0)}

  function navHost(el){
    const candidate=el.closest('li,[role="menuitem"],.nav-item,.menu-item,.sidebar-item,.menu-entry');
    if(candidate){const controls=candidate.querySelectorAll('a,button,[role="button"]');if(controls.length<=1)return candidate}
    return el;
  }
  function moduleKeyFromControl(el){
    const label=low(el.textContent);
    if(moduleByNavLabel.has(label))return moduleByNavLabel.get(label);
    for(const [name,key] of moduleByNavLabel){if(label===name||label.startsWith(name+' '))return key}
    return '';
  }
  function isCurrentControl(el){return el.matches('[aria-current="page"],[aria-selected="true"],.active,.is-active')||el.parentElement?.matches?.('.active,.is-active,[aria-current="page"]')}
  function syncNavigation(){
    const controls=[...document.querySelectorAll('nav a,nav button,aside a,aside button,[role="navigation"] a,[role="navigation"] button')];
    let currentUnavailable=false;
    for(const control of controls){
      const key=moduleKeyFromControl(control);if(!key)continue;
      const c=capability(key),host=navHost(control);
      host.dataset.ronaClientModule=key;host.dataset.ronaClientModuleState=c.state;host.dataset.ronaClientModuleCount=String(c.count);
      host.hidden=!c.enabled;
      control.setAttribute('aria-disabled',c.enabled?'false':'true');
      if(!c.enabled&&isCurrentControl(control))currentUnavailable=true;
    }
    const marketVisible=capability('analytics').enabled||capability('news').enabled;
    for(const leaf of document.querySelectorAll('aside *,nav *')){
      if(leaf.childElementCount===0&&low(leaf.textContent)==='рынок')leaf.hidden=!marketVisible;
    }
    document.documentElement.dataset.ronaClientCapabilities=MARK;
    if(currentUnavailable)queueMicrotask(()=>triggerSection('Главная'));
  }
  function triggerSection(label){
    const target=low(label);
    const candidates=[...document.querySelectorAll('nav a,nav button,aside a,aside button,[role="navigation"] a,[role="navigation"] button')];
    const control=candidates.find(el=>low(el.textContent)===target&&!navHost(el).hidden);
    if(control){control.click();return true}
    return false;
  }

  function protectedUiLeaf(el){
    return Boolean(el.closest('[data-rona-logout-bound],[data-rona-client-canonical-logout],[class*="status"],[class*="badge"],[data-status],[data-service],[data-access]'));
  }
  function syncHeaderIdentity(){
    if(!state.ctx)return;
    const display=displayName(state.ctx);
    const roots=[document.querySelector('header'),document.querySelector('.topbar'),...document.querySelectorAll('[class*="topbar"],[class*="header"]')].filter(Boolean);
    for(const root of [...new Set(roots)]){
      for(const leaf of root.querySelectorAll('*')){
        if(leaf.childElementCount!==0||protectedUiLeaf(leaf))continue;
        const before=norm(leaf.textContent);if(!before)continue;
        if(/[·•]/u.test(before)&&/(контракт|договор)/iu.test(before)){
          const sep=before.search(/(?:контракт|договор)/iu);
          if(sep>0){const tail=before.slice(sep);const after=display+' · '+tail;if(after!==before)leaf.textContent=after}
        }
      }
    }
  }
  function contextCard(ctx){
    const id=norm(ctx?.client_id),contract=norm(ctx?.contract_id);if(!id||!contract)return null;
    const leaves=[...document.querySelectorAll('main *,[role="main"] *')].filter(el=>el.childElementCount===0&&(norm(el.textContent).includes(id)||norm(el.textContent).includes(contract)));
    let best=null,bestLen=Infinity;
    for(const leaf of leaves){
      let node=leaf;
      for(let depth=0;node&&node!==document.body&&depth<8;depth++,node=node.parentElement){
        const text=norm(node.textContent);if(!text.includes(id)||!text.includes(contract)||text.length>2600)continue;
        const r=node.getBoundingClientRect();if(r.width<220||r.width>1500)continue;
        if(text.length<bestLen){best=node;bestLen=text.length}
      }
    }
    return best;
  }
  const reservedCompanyWords=new Set(['ПОДПИСАННЫЙ КОНТРАКТ','ТЕКУЩАЯ КОМПАНИЯ','ЗАЯВОК','СДЕЛОК','ДЕЙСТВИЙ','КОНТРАКТ','ДОГОВОР']);
  function syncCompanyName(card){
    if(!card||!state.ctx)return;
    const display=displayName(state.ctx),legal=norm(state.ctx.legal_name),leaves=[...card.querySelectorAll('*')].filter(el=>el.childElementCount===0&&norm(el.textContent));
    let best=null,bestScore=0;
    for(let i=0;i<leaves.length;i++){
      const el=leaves[i],text=norm(el.textContent),u=upper(text);
      if(text===display||text===legal||reservedCompanyWords.has(u)||/RONA-C\d{3}/u.test(text)||/CTR-\d{4}/u.test(text)||/(контракт|договор|номер|заяв|сдел|действ)/iu.test(text))continue;
      if(text.length<3||text.length>120)continue;
      let score=0;
      if(/^[A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9 .&'«»“”"_-]{2,}$/u.test(text))score+=100;
      if(i<8)score+=30;
      if(/[A-ZА-ЯЁ]{3,}/u.test(text))score+=20;
      if(score>bestScore){best=el;bestScore=score}
    }
    if(best&&bestScore>=80)best.textContent=display;
  }
  function metricBox(label){
    let node=label.parentElement;
    for(let depth=0;node&&depth<4;depth++,node=node.parentElement){
      const text=upper(node.textContent),numeric=[...node.querySelectorAll('*')].some(el=>el.childElementCount===0&&/^\d+$/.test(norm(el.textContent)));
      const other=['ЗАЯВОК','СДЕЛОК','ДЕЙСТВИЙ'].filter(x=>x!==upper(label.textContent)&&text.includes(x));
      if(numeric&&other.length===0)return node;
    }
    return label.parentElement;
  }
  function setMetric(card,labelText,value,hide=false){
    if(!card)return;
    const label=[...card.querySelectorAll('*')].find(el=>el.childElementCount===0&&upper(el.textContent)===labelText);
    if(!label)return;
    const box=metricBox(label);if(!box)return;
    if(hide){box.hidden=true;box.dataset.ronaContextMetric='unsupported';return}
    box.hidden=false;box.dataset.ronaContextMetric='authoritative';
    const number=[...box.querySelectorAll('*')].find(el=>el.childElementCount===0&&/^\d+$/.test(norm(el.textContent)));
    if(number)number.textContent=String(value);
  }
  function syncCompanyDirectory(){
    if(!state.ctx||!state.detail)return;
    const card=contextCard(state.ctx);if(!card)return;
    syncCompanyName(card);
    setMetric(card,'ЗАЯВОК',arr(state.detail.applications).length);
    setMetric(card,'СДЕЛОК',arr(state.detail.deals).length);
    setMetric(card,'ДЕЙСТВИЙ',0,true);
    card.dataset.ronaClientId=state.ctx.client_id;card.dataset.ronaContractId=state.ctx.contract_id;card.dataset.ronaContextSource='server-authoritative-current-context';
  }

  function panelByTitle(root,title){
    if(!root)return null;
    const leaf=[...root.querySelectorAll('*')].find(el=>el.childElementCount===0&&norm(el.textContent)===title);
    return leaf?.closest('.rona-cc-panel')||null;
  }
  function contextualStarter(owner){
    let starter=owner.querySelector('[data-rona-client-contextual-starter="true"]');
    if(!starter){starter=document.createElement('section');starter.className='rona-cc-panel';starter.dataset.ronaClientContextualStarter='true'}
    const apps=activeApps(state.detail),prices=arr(state.detail?.prices);
    let title='Текущий контекст',body='';
    if(apps.length){
      title='Заявки в работе';
      body=apps.slice(0,4).map(a=>`<div class="rona-cc-alert" data-tone="wait"><strong>${esc(a?.application_id||'Заявка')}</strong><span>${esc([a?.product,a?.status].map(norm).filter(Boolean).join(' · ')||'Статус заявки загружен из серверного контура')}</span></div>`).join('');
      body+=`<button class="rona-cc-open" type="button" data-rona-contextual-nav="Заявки">Открыть заявки</button>`;
    }else if(prices.length){
      title='Новая заявка';
      body=`<div class="rona-cc-alert" data-tone="ok"><strong>Доступны опубликованные условия</strong><span>Для выбранной компании и договора можно создать новую заявку.</span></div><button class="rona-cc-open" type="button" data-rona-contextual-nav="Заявки">Создать заявку</button>`;
    }else{
      body='<div class="rona-cc-alert"><strong>Доступных действий пока нет</strong><span>Для выбранного договора нет опубликованных цен и активных заявок.</span></div>';
    }
    starter.innerHTML=`<div class="rona-cc-panel-head"><div><strong class="rona-cc-panel-title">${title}</strong><span class="rona-cc-panel-sub">Текущие данные выбранного договора</span></div></div><div class="rona-cc-attention">${body}</div>`;
    return starter;
  }
  function syncQuickActions(owner){
    const panel=panelByTitle(owner,'Быстрые действия');if(!panel)return;
    let visibleCount=0;
    for(const button of panel.querySelectorAll('[data-home-action="section"]')){
      const key=moduleByNavLabel.get(low(button.dataset.section||button.textContent))||moduleKeyFromControl(button);
      if(!key){button.hidden=false;visibleCount++;continue}
      const enabled=capability(key).enabled;button.hidden=!enabled;button.dataset.ronaClientModuleState=capability(key).state;if(enabled)visibleCount++;
    }
    panel.hidden=visibleCount===0;
  }
  function syncHome(){
    const owner=document.querySelector('[data-rona-client-home-owner="command-center-v2"]');if(!owner||!state.detail)return;
    const deals=activeDeals(state.detail),apps=activeApps(state.detail),payments=arr(state.detail.payments);
    const dealsPanel=panelByTitle(owner,'Сделки в работе');
    if(dealsPanel)dealsPanel.hidden=deals.length===0;
    const kpis=owner.querySelector('.rona-cc-kpis');if(kpis)kpis.hidden=deals.length===0;
    const finance=panelByTitle(owner,'Финансовое исполнение');if(finance)finance.hidden=deals.length===0&&payments.length===0;
    const attention=panelByTitle(owner,'Требует внимания');if(attention)attention.hidden=deals.length===0&&apps.length===0;
    const management=panelByTitle(owner,'Контур управления');if(management)management.hidden=true;
    syncQuickActions(owner);
    const firstColumn=owner.querySelector('.rona-cc-main > div:first-child');
    const starter=contextualStarter(owner);
    if(deals.length===0){if(firstColumn&&!starter.isConnected)firstColumn.appendChild(starter);starter.hidden=false}else starter.hidden=true;
    const bottom=owner.querySelector('.rona-cc-bottom');if(bottom){const shown=[...bottom.children].some(el=>!el.hidden);bottom.hidden=!shown}
    owner.dataset.ronaContextualProjection='true';
  }
  function syncDealsPage(){
    if(!state.detail)return;
    const all=arr(state.detail.deals),active=activeDeals(state.detail);
    for(const leaf of document.querySelectorAll('main *,[role="main"] *')){
      if(leaf.childElementCount!==0||!visible(leaf))continue;
      const text=norm(leaf.textContent);
      if(/^\d+\s+в\s+контуре$/iu.test(text))leaf.textContent=all.length===active.length?`${active.length} активных`:`${active.length} активн. · ${all.length} всего`;
      else if(/Открытых сделок нет/iu.test(text)&&all.length>0)leaf.textContent=`Активных сделок нет. Всего в доступном контуре: ${all.length}.`;
    }
  }
  function syncPageStates(){
    syncHeaderIdentity();
    syncCompanyDirectory();
    syncHome();
    syncDealsPage();
  }
  function syncUi(){
    if(state.syncing)return;state.syncing=true;
    try{syncNavigation();syncPageStates()}finally{state.syncing=false}
  }
  function scheduleUi(){if(state.scheduled)return;state.scheduled=true;setTimeout(()=>{state.scheduled=false;syncUi()},80)}

  async function loadForContext(ctx){
    const seq=++state.loadSeq,stateKey=contextKey(ctx);state.ctx=ctx||null;state.contextKey=stateKey;
    if(!ctx){state.detail=null;state.rail=null;state.shipments=null;state.claims=null;state.market=null;state.capabilities=computeCapabilities();syncUi();return}
    const q=`clientId=${encodeURIComponent(ctx.client_id)}&contractId=${encodeURIComponent(ctx.contract_id)}`;
    const [context,rail,shipments,claims,market]=await Promise.all([
      request(`/v1/client/context?${q}`),
      request(`/v1/client/rail?${q}`),
      request(`/v1/client/shipments?${q}`),
      request(`/v1/client/claims?${q}`),
      request(`/v1/client/market?${q}`)
    ]);
    if(seq!==state.loadSeq||contextKey(authority()?.getCurrentContext?.())!==stateKey)return;
    state.detail=context?.data||null;state.rail=rail;state.shipments=shipments;state.claims=claims;state.market=market;
    state.capabilities=computeCapabilities();
    document.documentElement.dataset.ronaClientCapabilityContext=stateKey;
    syncUi();
    window.dispatchEvent(new CustomEvent('rona:client-capabilities-ready',{detail:{client_id:ctx.client_id,contract_id:ctx.contract_id,capabilities:state.capabilities}}));
  }
  async function refresh(){
    const a=authority();if(!a)return;
    let ctx=a.getCurrentContext?.()||null;
    if(!ctx){try{ctx=await a.whenReady?.()}catch{ctx=null}}
    const key=contextKey(ctx);if(key===state.contextKey&&state.detail){scheduleUi();return}
    await loadForContext(ctx);
  }
  function startObserver(){
    if(state.observer||!document.body)return;
    state.observer=new MutationObserver(()=>scheduleUi());
    state.observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  function onContextChanged(event){const ctx=event?.detail?.client_id&&event?.detail?.contract_id?authority()?.getCurrentContext?.():null;loadForContext(ctx||null)}
  function onClick(event){const b=event.target?.closest?.('[data-rona-contextual-nav]');if(!b)return;event.preventDefault();triggerSection(b.dataset.ronaContextualNav)}
  function start(){
    startObserver();document.addEventListener('click',onClick,true);
    window.addEventListener('rona:client-context-changed',onContextChanged);
    window.addEventListener('rona:client-context-ready',refresh);
    window.addEventListener('rona:client-home:rendered',scheduleUi);
    window.addEventListener('pageshow',scheduleUi,{passive:true});
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
