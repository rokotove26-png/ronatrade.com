const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_CLIENTS_AGENTS_CURRENT__)return;
window.__RONA_CLIENTS_AGENTS_CURRENT__='20260826-current-only-v2';
if(location.pathname!=='/portal/admin')return;

const OWNER_API='/portal/owner-api';
const AUTH='/portal/admin-authority';
const S={view:'companies',search:'',busy:false};
let business=null,authority=null;
const q=(s,r=document)=>r.querySelector(s);
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function installShellParity(){
  if(q('#ronaAdminCanonicalShellParityV2'))return;
  const s=el('style');s.id='ronaAdminCanonicalShellParityV2';
  s.textContent=`
  :root{--rona-shell-panel:rgba(6,16,27,.95);--rona-shell-line:rgba(132,196,224,.16);--rona-shell-text:#f4f8fb;--rona-shell-muted:#9fb4c0;--rona-shell-active:rgba(31,86,128,.48)}
  @media(min-width:901px){
    html body .app{grid-template-columns:232px minmax(0,1fr)!important;grid-template-rows:62px minmax(0,1fr)!important}
    html body .sidebar{padding:14px 12px 20px!important;border-right:1px solid var(--rona-shell-line)!important;background:radial-gradient(360px 260px at 0 0,rgba(31,91,128,.14),transparent 70%),linear-gradient(180deg,rgba(5,14,24,.985),rgba(6,17,29,.945))!important;backdrop-filter:blur(20px) saturate(120%)!important}
    html body .brand{height:88px!important;margin-bottom:8px!important}
    html body .brand img{width:138px!important;height:70px!important}
    html body .nav-group{margin:17px 10px 8px!important;color:#718b9d!important;font-size:10px!important;line-height:1.2!important;font-weight:850!important;letter-spacing:.14em!important}
    html body #nav{gap:4px!important;padding:0 0 12px!important}
    html body #nav button{min-height:43px!important;gap:11px!important;padding:10px 12px!important;border-radius:11px!important;color:#bfd0dc!important;font-size:13.5px!important;line-height:1.22!important;font-weight:720!important;border:1px solid transparent!important}
    html body #nav button:hover{background:rgba(89,215,255,.075)!important;color:#fff!important;border-color:rgba(89,215,255,.08)!important}
    html body #nav button.active,html body #nav button[aria-current="page"]{background:linear-gradient(135deg,rgba(37,96,138,.62),rgba(28,54,93,.56))!important;border-color:rgba(89,215,255,.22)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important}
    html body #nav .nav-icon{width:18px!important;min-width:18px!important;font-size:15px!important;color:#91afc1!important}
    html body .topbar{grid-column:2!important;min-height:62px!important;padding:9px 16px!important;border-bottom:1px solid var(--rona-shell-line)!important;background:linear-gradient(180deg,rgba(5,13,22,.95),rgba(5,13,22,.80))!important;backdrop-filter:blur(20px) saturate(125%)!important}
    html body .search{height:38px!important;border-color:rgba(150,198,223,.17)!important;background:rgba(6,13,21,.75)!important;color:#eaf2f7!important}
    html body .role-pill,html body .logout{height:36px!important;font-size:12px!important;background:rgba(8,18,29,.78)!important;border-color:rgba(150,198,223,.18)!important}
    html body main{grid-column:2!important}
    html body .page{min-height:calc(100vh - 62px)!important}
  }
  `;
  document.head.appendChild(s);
  document.documentElement.dataset.ronaAdminShellParity='canonical-home-v2';
}

const NAV={selected:'',until:0,observer:null};
function navButton(id){return q('#nav button[data-page="'+id+'"]')}
function navPage(id){return q('#page-'+id)}
function enforceSelectedPage(){
  if(!NAV.selected||Date.now()>NAV.until)return;
  const target=navPage(NAV.selected),button=navButton(NAV.selected);
  if(!target||!button)return;
  for(const p of Array.from(document.querySelectorAll('main .page[id^="page-"]'))){
    const on=p===target;p.classList.toggle('active',on);
  }
  for(const b of Array.from(document.querySelectorAll('#nav button[data-page]'))){
    const on=b===button;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  }
}
function armNavigation(id){
  if(!id||!navPage(id))return;
  NAV.selected=id;NAV.until=Date.now()+30000;
  window.__RONA_ADMIN_SELECTED_PAGE__=id;
  [0,20,80,220,600,1400,3200,7000,12000,20000,29000].forEach(ms=>setTimeout(enforceSelectedPage,ms));
}
function installNavigationStability(){
  if(window.__RONA_ADMIN_NAV_STABILITY_V2__)return;
  window.__RONA_ADMIN_NAV_STABILITY_V2__=true;
  document.addEventListener('click',event=>{
    const b=event.target?.closest?.('#nav button[data-page]');
    if(!b)return;
    armNavigation(String(b.dataset.page||''));
    queueMicrotask(enforceSelectedPage);
  },true);
  NAV.observer=new MutationObserver(()=>{if(NAV.selected&&Date.now()<=NAV.until)queueMicrotask(enforceSelectedPage)});
  const main=q('#current-admin-main')||q('main'),nav=q('#nav');
  if(main)NAV.observer.observe(main,{subtree:true,attributes:true,attributeFilter:['class']});
  if(nav)NAV.observer.observe(nav,{subtree:true,attributes:true,attributeFilter:['class','aria-current']});
}

function page(){return q('#page-access')}
function pill(text,tone='neutral'){return el('span','rona-fin-pill rona-fin-pill--'+tone,text)}
function card(title){const c=el('section','rona-owner-card ca-current-card');if(title)c.append(el('h2','',title));for(let i=1;i<arguments.length;i++)if(arguments[i])c.append(arguments[i]);return c}
function notice(msg,title='Клиенты и агенты'){
  if(window.RONA_ADMIN_DIALOGS?.message)return window.RONA_ADMIN_DIALOGS.message(String(msg),{title});
  const b=el('div','ca-current-modal-backdrop'),m=el('section','rona-owner-card ca-current-modal'),h=el('h2','',title),p=el('div','ca-current-copy',String(msg)),ok=el('button','ca-current-primary','Закрыть');
  ok.type='button';ok.onclick=()=>b.remove();m.append(h,p,ok);b.append(m);document.body.append(b)
}
async function json(url,opts={}){const init={credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},...opts};const r=await fetch(url,init);const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false){const e=new Error(String(j?.code||'REQUEST_FAILED'));e.code=String(j?.code||'REQUEST_FAILED');e.status=r.status;throw e}return j.data||j}
async function owner(path,opts={}){return json(OWNER_API+'?path='+encodeURIComponent(path),opts)}
async function auth(path,opts={}){return json(AUTH+path,opts)}
async function loadAll(){const [b,a]=await Promise.all([owner('/admin/bootstrap'),auth('/bootstrap')]);business=b||{};authority=a||{};window.__RONA_OWNER_ADMIN_SNAPSHOT__=business;window.__RONA_ADMIN_LIVE_SNAPSHOT__={...(window.__RONA_ADMIN_LIVE_SNAPSHOT__||{}),authority,at:new Date().toISOString()};return{business,authority}}
async function refresh(){try{await loadAll();render()}catch(e){showError(e.code||e.message)}}
function showError(text){const r=ensureRoot();if(!r)return;r.replaceChildren(hero(),card('Раздел временно недоступен',el('div','rona-owner-danger',String(text||'REQUEST_FAILED'))))}

function style(){
  if(q('#ronaCaCurrentStyle'))return;
  const s=el('style');s.id='ronaCaCurrentStyle';s.textContent=[
  '#page-access>#rona-ca4{display:grid!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;width:min(100%,1480px)!important;margin:0 auto!important;padding:clamp(18px,2.1vw,30px) clamp(12px,1.8vw,26px) 42px!important;gap:14px}',
  '#page-access>*:not(#rona-ca4){display:none!important}',
  '.ca-current-hero{margin:0!important;display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:18px!important;flex-wrap:wrap!important}.ca-current-hero-copy{min-width:260px;flex:1}.ca-current-hero-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ca-current-hero .ca-current-primary{min-height:42px;padding:9px 15px}',
  '.ca-current-toolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.ca-current-search{min-width:280px;flex:1}.ca-current-tabs{display:flex;gap:7px;flex-wrap:wrap}.ca-current-tabs button,.ca-current-search,.ca-current-select,.ca-current-btn,.ca-current-primary,.ca-current-modal input,.ca-current-modal select{font:inherit;color:inherit;border:1px solid rgba(145,190,214,.20);border-radius:10px;background:rgba(5,11,17,.62);padding:9px 11px}.ca-current-tabs button,.ca-current-btn,.ca-current-primary{cursor:pointer;font-weight:800}.ca-current-tabs button[aria-pressed="true"],.ca-current-primary{border-color:rgba(89,215,255,.42);background:linear-gradient(135deg,rgba(39,105,145,.48),rgba(24,58,92,.54))}.ca-current-primary:hover{border-color:rgba(89,215,255,.62);background:linear-gradient(135deg,rgba(45,122,166,.56),rgba(27,68,107,.60))}',
  '.ca-current-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.ca-current-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px}.ca-current-card{margin:0!important}.ca-current-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ca-current-name{font-size:16px;font-weight:850}.ca-current-id,.ca-current-copy{font-size:12px;line-height:1.5;color:var(--rv-muted,#9fb4c0)}.ca-current-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.ca-current-cell{padding:9px 8px;border-bottom:1px solid rgba(145,190,214,.10)}.ca-current-cell span{display:block;font-size:11px;color:var(--rv-muted,#9fb4c0)}.ca-current-cell strong{display:block;margin-top:4px;font-size:13px}.ca-current-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.ca-current-actions .ca-current-select{min-width:220px;flex:1}',
  '.ca-current-users{overflow:auto}.ca-current-users table{width:100%;min-width:900px;border-collapse:collapse}.ca-current-users th,.ca-current-users td{padding:11px 9px;border-bottom:1px solid rgba(145,190,214,.10);text-align:left;font-size:12px;vertical-align:top}.ca-current-users th{color:var(--rv-muted,#9fb4c0);font-size:10px;text-transform:uppercase;letter-spacing:.06em}.ca-current-bindings{display:grid;gap:6px}.ca-current-binding{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px;border:1px solid rgba(145,190,214,.12);border-radius:9px}.ca-current-binding-text{min-width:0}.ca-current-binding-text strong{display:block;font-size:11px}.ca-current-binding-text span{display:block;margin-top:2px;color:var(--rv-muted,#9fb4c0);font-size:10px}',
  '.ca-current-modal-backdrop{position:fixed;inset:0;z-index:2147483200;background:rgba(1,6,11,.78);display:grid;place-items:center;padding:20px;backdrop-filter:blur(9px)}.ca-current-modal{width:min(660px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px!important;display:grid;gap:12px;background:rgba(7,17,28,.985)!important}.ca-current-form{display:grid;gap:11px}.ca-current-form label{display:grid;gap:6px;font-size:12px;font-weight:700}.ca-current-form select[multiple]{min-height:145px}.ca-current-modal-actions{display:flex;justify-content:flex-end;gap:8px}.ca-current-role-note{padding:10px 11px;border:1px solid rgba(89,215,255,.16);border-radius:10px;background:rgba(89,215,255,.055);font-size:12px;line-height:1.45;color:var(--rv-muted,#9fb4c0)}',
  '.ca-current-empty{padding:18px;border:1px dashed rgba(145,190,214,.18);border-radius:14px;color:var(--rv-muted,#9fb4c0);font-size:12px;line-height:1.5}.ca-current-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.ca-current-chip{display:inline-flex;padding:4px 8px;border:1px solid rgba(145,190,214,.15);border-radius:999px;font-size:10px}.ca-current-btn:disabled,.ca-current-primary:disabled{opacity:.5;cursor:wait}',
  '@media(max-width:980px){.ca-current-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:680px){.ca-current-kpis,.ca-current-meta{grid-template-columns:1fr}.ca-current-grid{grid-template-columns:1fr}.ca-current-toolbar{display:grid}.ca-current-search{min-width:0;width:100%}.ca-current-tabs{display:grid;grid-template-columns:1fr}.ca-current-modal-actions{display:grid}.ca-current-modal-actions button{width:100%}.ca-current-hero-actions{width:100%}.ca-current-hero-actions button{width:100%}}'
  ].join('');document.head.append(s)
}
function ensureRoot(){const p=page();if(!p)return null;style();let r=q('#rona-ca4',p);if(!r){r=el('section','ca-current');r.id='rona-ca4';p.prepend(r)}for(const x of Array.from(p.children)){if(x!==r){x.style.setProperty('display','none','important');x.setAttribute('aria-hidden','true')}}return r}
function hero(){
  const h=el('section','rona-visual-hero ca-current-hero'),c=el('div','ca-current-hero-copy'),actions=el('div','ca-current-hero-actions');
  c.append(el('div','rona-visual-kicker','RONA TRADE · CLIENTS'),el('h1','rona-visual-title','Клиенты и агенты'),el('div','rona-visual-sub','Компании, закреплённые агенты и действующие доступы. Основная операция раздела — создание клиентского или агентского доступа.'));
  const create=el('button','ca-current-primary','Создать доступ');create.type='button';create.dataset.ronaCreateAccess='primary';create.onclick=()=>createAccessModal();actions.append(create);h.append(c,actions);return h
}
function cell(l,v){const c=el('div','ca-current-cell');c.append(el('span','',l),el('strong','',v||'—'));return c}
function clients(){return Array.isArray(business?.clients)?business.clients:Array.isArray(business?.companies)?business.companies:[]}
function agents(){return Array.isArray(business?.agents)?business.agents:[]}
function users(){return Array.isArray(authority?.accessUsers)?authority.accessUsers:[]}
function contracts(){return Array.isArray(authority?.contracts)?authority.contracts:[]}
function activeContracts(){return contracts().filter(x=>!['REVOKED','ARCHIVED','CANCELLED','EXPIRED'].includes(String(x.contractStatus||x.status||'').toUpperCase()))}
function toolbar(){const b=card(''),row=el('div','ca-current-toolbar'),search=el('input','ca-current-search');search.type='search';search.placeholder='Поиск по компании, Client ID, договору, агенту или пользователю';search.value=S.search;search.oninput=()=>{S.search=search.value;drawBody()};const tabs=el('div','ca-current-tabs');[['companies','Компании'],['agents','Агенты'],['users','Пользователи и доступы']].forEach(([v,t])=>{const x=el('button','',t);x.type='button';x.setAttribute('aria-pressed',String(S.view===v));x.onclick=()=>{S.view=v;render()};tabs.append(x)});const reload=el('button','ca-current-btn','Обновить');reload.type='button';reload.onclick=refresh;row.append(search,tabs,reload);b.append(row);return b}
function kpis(){const cs=clients(),as=agents(),us=users(),assigned=cs.filter(x=>String(x.agent_person_id||'').trim()).length,active=us.filter(x=>String(x.status||'').toUpperCase()==='ACTIVE').length,g=el('div','ca-current-kpis');for(const [t,v,c] of [['Компаний',cs.length,'Текущий контур'],['Агентов',as.length,'Зарегистрированные агенты'],['С агентом',assigned,'Закрепление по компании'],['Активных доступов',active,'Серверная авторизация']]){const x=card(t,el('div','rona-owner-kpi',String(v)),el('div','rona-owner-muted',c));g.append(x)}return g}
function clientMatches(x,s){return !s||norm([x.legal_name,x.client_id,x.contract_id,x.current_external_contract_number,x.agent_name].join(' ')).includes(s)}
function agentMatches(a,s){if(!s)return true;const id=String(a.agent_person_id||a.id||''),owned=clients().filter(x=>String(x.agent_person_id||'')===id).map(x=>x.legal_name).join(' ');return norm([a.agent_name,a.display_name,a.full_name,id,owned].join(' ')).includes(s)}
function companyCard(x){const head=el('div','ca-current-head'),left=el('div'),assigned=String(x.agent_person_id||'').trim();left.append(el('div','ca-current-name',x.legal_name||'Компания'),el('div','ca-current-id',x.client_id||'—'));head.append(left,pill(assigned?'Агент назначен':'Без агента',assigned?'success':'neutral'));const meta=el('div','ca-current-meta');meta.append(cell('Договор',x.current_external_contract_number||x.contract_id||'—'),cell('Contract ID',x.contract_id||'—'));const row=el('div','ca-current-actions'),sel=el('select','ca-current-select');sel.append(new Option('Без агента',''));for(const a of agents())sel.append(new Option(a.agent_name||a.display_name||a.full_name||a.agent_person_id||'Агент',a.agent_person_id||a.id||''));sel.value=x.agent_person_id||'';const save=el('button','ca-current-primary','Сохранить');save.type='button';save.onclick=async()=>{save.disabled=true;try{await owner('/admin/clients/'+encodeURIComponent(x.client_id)+'/agent',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({agentPersonId:sel.value||null})});await refresh();await notice('Закрепление агента сохранено.')}catch(e){await notice(e.code||e.message,'Ошибка')}finally{save.disabled=false}};row.append(sel,save);return card('',head,meta,row)}
function companiesView(){const s=norm(S.search),xs=clients().filter(x=>clientMatches(x,s)),g=el('div','ca-current-grid');if(!xs.length)return el('div','ca-current-empty','По выбранному фильтру компаний нет.');xs.forEach(x=>g.append(companyCard(x)));return g}
function agentsView(){const s=norm(S.search),xs=agents().filter(a=>agentMatches(a,s)),g=el('div','ca-current-grid');if(!xs.length)return el('div','ca-current-empty','По выбранному фильтру агентов нет.');for(const a of xs){const id=String(a.agent_person_id||a.id||''),owned=clients().filter(x=>String(x.agent_person_id||'')===id),head=el('div','ca-current-head'),left=el('div');left.append(el('div','ca-current-name',a.agent_name||a.display_name||a.full_name||'Агент'),el('div','ca-current-id',id||'—'));head.append(left,pill(owned.length?owned.length+' клиент(ов)':'Без клиентов',owned.length?'success':'neutral'));const chips=el('div','ca-current-chips');owned.forEach(x=>chips.append(el('span','ca-current-chip',x.legal_name||x.client_id||'Клиент')));g.append(card('',head,chips.childNodes.length?chips:el('div','ca-current-copy','Компании пока не закреплены.')))}return g}
function contractLabel(c){return String(c.currentExternalContractNumber||c.externalContractNumber||c.contractNumber||c.contractId||c.id||'Договор')}
function bindingStatus(v){const s=String(v||'').toUpperCase();return s==='ACTIVE'?pill('Активен','success'):s==='SUSPENDED'?pill('Приостановлен','warn'):pill(s||'—','neutral')}
async function mutate(path,body={}){return auth(path,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body)})}
function bindingControl(u,b){const row=el('div','ca-current-binding'),text=el('div','ca-current-binding-text');text.append(el('strong','',b.company||b.contractId||'Договор'),el('span','',b.contractId||''));const actions=el('div','ca-current-actions'),status=String(b.status||'').toUpperCase();actions.append(bindingStatus(status));if(status==='ACTIVE'){const btn=el('button','ca-current-btn','Отозвать');btn.type='button';btn.onclick=async()=>{btn.disabled=true;try{await mutate('/access/users/'+encodeURIComponent(u.id)+'/contracts/'+encodeURIComponent(b.contractId)+'/revoke');await refresh()}catch(e){await notice(e.code||e.message,'Ошибка')}finally{btn.disabled=false}};actions.append(btn)}else if(['REVOKED','SUSPENDED'].includes(status)){const btn=el('button','ca-current-btn','Восстановить');btn.type='button';btn.onclick=async()=>{btn.disabled=true;try{await mutate('/access/users/'+encodeURIComponent(u.id)+'/contracts/'+encodeURIComponent(b.contractId)+'/restore');await refresh()}catch(e){await notice(e.code||e.message,'Ошибка')}finally{btn.disabled=false}};actions.append(btn)}row.append(text,actions);return row}
function modal(title){const back=el('div','ca-current-modal-backdrop'),box=el('section','rona-owner-card ca-current-modal');box.append(el('h2','',title));back.append(box);document.body.append(back);return{back,box,close:()=>back.remove()}}
function label(t,input){const l=el('label');l.append(el('span','',t),input);return l}
async function localPassword(){
  if(window.RONA_ADMIN_DIALOGS?.password)return String(await window.RONA_ADMIN_DIALOGS.password('Установите первоначальный пароль для доступа'));
  return new Promise((resolve,reject)=>{
    const m=modal('Первоначальный пароль'),form=el('div','ca-current-form'),a=el('input'),b=el('input');a.type=b.type='password';a.autocomplete=b.autocomplete='new-password';form.append(label('Пароль',a),label('Повторите пароль',b));const note=el('div','ca-current-role-note','Не менее 10 символов: заглавная и строчная буквы, цифра и специальный символ.');const actions=el('div','ca-current-modal-actions'),cancel=el('button','ca-current-btn','Отмена'),ok=el('button','ca-current-primary','Подтвердить');cancel.type=ok.type='button';cancel.onclick=()=>{m.close();reject(new Error('ADMIN_PASSWORD_CANCELLED'))};ok.onclick=()=>{const x=String(a.value||''),y=String(b.value||'');if(x!==y)return notice('Пароли не совпадают.','Проверка');if(x.length<10)return notice('Пароль должен содержать не менее 10 символов.','Проверка');m.close();resolve(x)};actions.append(cancel,ok);m.box.append(form,note,actions);a.focus()
  })
}
async function createAccess(payload){
  for(let i=0;i<20;i++){
    const backend=window.__RONA_PORTAL_BACKEND__;
    if(backend&&typeof backend.createAccessUser==='function')return backend.createAccessUser(payload);
    await sleep(100)
  }
  const initialPassword=await localPassword();
  return mutate('/access/users',{...payload,initialPassword})
}
function createAccessModal(){
  const m=modal('Создать доступ'),form=el('div','ca-current-form'),role=el('select'),name=el('input'),email=el('input'),phone=el('input'),contractsSelect=el('select'),agentSelect=el('select');
  role.append(new Option('Клиент','Клиент'),new Option('Агент','Агент'));name.placeholder='ФИО';email.placeholder='name@company.com';email.type='email';phone.placeholder='Телефон (необязательно)';phone.type='tel';
  contractsSelect.multiple=true;for(const c of activeContracts())contractsSelect.append(new Option(contractLabel(c),String(c.contractId||c.id||'')));
  agentSelect.append(new Option('Выберите профиль агента',''));for(const a of agents()){const id=String(a.agent_person_id||a.id||'');if(id)agentSelect.append(new Option(a.agent_name||a.display_name||a.full_name||id,id))}
  const roleWrap=label('Тип доступа',role),nameWrap=label('ФИО',name),emailWrap=label('Электронная почта / логин',email),phoneWrap=label('Телефон',phone),clientWrap=label('Договоры клиента',contractsSelect),agentWrap=label('Профиль агента',agentSelect),note=el('div','ca-current-role-note');
  const sync=()=>{const isAgent=role.value==='Агент';clientWrap.hidden=isAgent;agentWrap.hidden=!isAgent;note.textContent=isAgent?'Будет создан доступ в кабинет агента. Профиль агента обязателен; договорная привязка не требуется.':'Будет создан доступ клиента по выбранным договорам. Выберите хотя бы один действующий договор.'};
  role.onchange=sync;form.append(roleWrap,nameWrap,emailWrap,phoneWrap,clientWrap,agentWrap,note);sync();
  const actions=el('div','ca-current-modal-actions'),cancel=el('button','ca-current-btn','Отмена'),save=el('button','ca-current-primary','Создать доступ');cancel.type=save.type='button';cancel.onclick=m.close;
  save.onclick=async()=>{
    const nm=name.value.trim(),mail=email.value.trim(),isAgent=role.value==='Агент';if(!nm||!mail)return notice('Укажите ФИО и электронную почту.','Проверка');
    const contractIds=Array.from(contractsSelect.selectedOptions).map(o=>o.value).filter(Boolean),agentScope=agentSelect.value.trim();
    if(isAgent&&!agentScope)return notice('Выберите профиль агента.','Проверка');if(!isAgent&&!contractIds.length)return notice('Выберите хотя бы один действующий договор.','Проверка');
    save.disabled=true;try{
      const payload={name:nm,login:mail,email:mail,phone:phone.value.trim(),role:isAgent?'Агент':'Клиент',bindingRole:'Уполномоченный представитель',contractIds:isAgent?[]:contractIds};if(isAgent)payload.agentScope=agentScope;
      const out=await createAccess(payload);m.close();S.view='users';await refresh();const initial=String(out?.initialPassword||'').trim();await notice(isAgent?'Доступ агента создан и подтверждён сервером.':initial?'Доступ клиента создан. Первоначальный пароль: '+initial:'Доступ клиента создан и подтверждён сервером.','Доступ создан')
    }catch(e){const code=String(e?.code||e?.message||'REQUEST_FAILED'),messages={ADMIN_PASSWORD_CANCELLED:'Создание доступа отменено.',ADMIN_PASSWORD_MISMATCH:'Пароли не совпадают.',PASSWORD_POLICY_FAILED:'Пароль не соответствует требованиям безопасности.',INVALID_INITIAL_PASSWORD:'Пароль не соответствует требованиям безопасности.',LOGIN_ALREADY_EXISTS:'Такой логин уже существует.',COMPANY_REQUIRED:'Выберите хотя бы одну компанию или договор.',SIGNED_CONTRACT_REQUIRED:'Для выбранной компании требуется подтверждённый договор.',AGENT_PROFILE_NOT_FOUND:'Профиль агента не найден.',AGENT_PORTAL_USER_ALREADY_EXISTS:'Для этого агента уже существует активный доступ.',INVALID_EMAIL:'Проверьте электронную почту.'};await notice(messages[code]||('Операция не выполнена: '+code),'Ошибка')
    }finally{save.disabled=false}
  };
  actions.append(cancel,save);m.box.append(form,actions);name.focus()
}
function addContractModal(u){const m=modal('Добавить договор пользователю'),select=el('select');select.multiple=true;const existing=new Set((u.bindings||[]).filter(b=>String(b.status||'').toUpperCase()==='ACTIVE').map(b=>String(b.contractId||'')));for(const c of activeContracts()){const id=String(c.contractId||c.id||'');if(id&&!existing.has(id))select.append(new Option(contractLabel(c),id))}const actions=el('div','ca-current-modal-actions'),cancel=el('button','ca-current-btn','Отмена'),save=el('button','ca-current-primary','Добавить');cancel.type=save.type='button';cancel.onclick=m.close;save.onclick=async()=>{const ids=Array.from(select.selectedOptions).map(o=>o.value).filter(Boolean);if(!ids.length)return notice('Выберите договор.','Проверка');save.disabled=true;try{await mutate('/access/users/'+encodeURIComponent(u.id)+'/contracts',{contractIds:ids});m.close();await refresh()}catch(e){await notice(e.code||e.message,'Ошибка')}finally{save.disabled=false}};m.box.append(label('Договоры',select),actions);actions.append(cancel,save)}
function usersView(){const s=norm(S.search),xs=users().filter(u=>!s||norm([u.name,u.login,u.role,(u.bindings||[]).map(b=>[b.company,b.contractId].join(' ')).join(' ')].join(' ')).includes(s)),wrap=card('Пользователи и доступы'),top=el('div','ca-current-actions'),create=el('button','ca-current-primary','Создать доступ');create.type='button';create.onclick=createAccessModal;top.append(create);wrap.append(top);if(!xs.length){wrap.append(el('div','ca-current-empty','Пользователи по выбранному фильтру не найдены.'));return wrap}const w=el('div','ca-current-users'),t=document.createElement('table'),thead=document.createElement('thead'),hr=document.createElement('tr');['Пользователь','Роль','Логин','Статус','Договоры','Действия'].forEach(x=>hr.append(el('th','',x)));thead.append(hr);const tb=document.createElement('tbody');for(const u of xs){const tr=document.createElement('tr'),bindings=el('div','ca-current-bindings');(u.bindings||[]).forEach(b=>bindings.append(bindingControl(u,b)));if(!bindings.childNodes.length)bindings.append(el('div','ca-current-copy','Нет договорных привязок'));const actions=el('div','ca-current-actions'),roleText=String(u.role||'Клиент');if(!norm(roleText).includes('агент')){const add=el('button','ca-current-btn','Добавить договор');add.type='button';add.onclick=()=>addContractModal(u);actions.append(add)}if(String(u.status||'').toUpperCase()==='ACTIVE'){const block=el('button','ca-current-btn','Заблокировать');block.type='button';block.onclick=async()=>{block.disabled=true;try{await mutate('/access/users/'+encodeURIComponent(u.id)+'/block');await refresh()}catch(e){await notice(e.code||e.message,'Ошибка')}finally{block.disabled=false}};actions.append(block)}const cells=[el('strong','',u.name||'—'),roleText,u.login||'—',bindingStatus(u.status),bindings,actions];for(const v of cells){const td=document.createElement('td');td.append(v?.nodeType?v:document.createTextNode(String(v)));tr.append(td)}tb.append(tr)}t.append(thead,tb);w.append(t);wrap.append(w);return wrap}
function drawBody(){const r=ensureRoot();if(!r||!business||!authority)return;const old=q('#ca-current-body',r);if(!old)return;old.replaceChildren(S.view==='agents'?agentsView():S.view==='users'?usersView():companiesView())}
function render(){const r=ensureRoot();if(!r)return;if(!business||!authority){r.replaceChildren(hero(),card('Загрузка',el('div','rona-owner-muted','Получаю актуальные данные…')));return}const body=el('div');body.id='ca-current-body';body.append(S.view==='agents'?agentsView():S.view==='users'?usersView():companiesView());r.replaceChildren(hero(),kpis(),toolbar(),body);window.__RONA_CLIENTS_AGENTS_CURRENT_READY__=true;window.__RONA_CLIENTS_AGENTS_V4_READY__=true;window.__RONA_ACCESS_CANONICAL_V4__=true}
async function boot(){installShellParity();installNavigationStability();for(let i=0;i<80&&!q('#page-access');i++)await sleep(50);try{await loadAll();render()}catch(e){showError(e.code||e.message)}}
installShellParity();installNavigationStability();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('rona:admin-app-ready',()=>{if(!business||!authority)boot()});
})();`;

export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-clients-agents-ui':'current-only-v2','x-rona-access-create':'client-agent-v2','x-rona-admin-nav-stability':'v2','x-rona-shell-parity':'canonical-home-v2','x-rona-legacy-dependency':'none'}})}
