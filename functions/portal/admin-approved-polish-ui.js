const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_ADMIN_APPROVED_POLISH__)return;
window.__RONA_ADMIN_APPROVED_POLISH__='20260826-claims-access-radio-approved-v2';
if(location.pathname!=='/portal/admin')return;

const AUTH='/portal/admin-authority';
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let authorityCache=null;

function ensureStyle(){
  if(q('#ronaApprovedAdminPolishStyle'))return;
  const s=el('style');s.id='ronaApprovedAdminPolishStyle';s.textContent=[
    '#page-claims>.rona-claims-r2-root,#page-claims>.rona-claims-section-title{width:min(100%,1480px)!important;max-width:1480px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}',
    '#page-claims .rona-claims-work{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:14px!important;width:100%!important;max-width:none!important}',
    '#page-claims .rona-claims-registry,#page-claims .rona-claims-side,#page-claims .rona-claims-side>.rona-owner-card{width:100%!important;max-width:none!important;min-width:0!important;box-sizing:border-box!important}',
    '#page-claims .rona-claims-side{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:14px!important}',
    '#page-claims .rona-claims-side>.rona-claims-detail-card{grid-column:auto!important}',
    '#page-messages.rona-radio-single-owner-ready>*:not(.rona-rs-root[data-kind="radio"]){display:none!important}',
    '#page-messages.rona-radio-single-owner-ready>.rona-rs-root[data-kind="radio"]{display:grid!important;visibility:visible!important;opacity:1!important}',
    '.rona-approved-access-mask{position:fixed;inset:0;z-index:2147483250;background:rgba(2,8,14,.70);display:flex;align-items:center;justify-content:center;padding:30px;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}',
    '.rona-approved-access-modal{width:min(860px,96vw);max-height:88vh;overflow:auto;border:1px solid rgba(222,236,248,.30);border-radius:20px;background:rgba(5,16,28,.985);color:#f7fbff;box-shadow:0 30px 100px rgba(0,0,0,.56)}',
    '.rona-approved-access-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px;border-bottom:1px solid rgba(222,236,248,.20)}',
    '.rona-approved-access-head h2{font-size:25px;line-height:1.2;margin:0;font-weight:850}.rona-approved-access-head p{font-size:14px;line-height:1.5;color:#b6c4d1;margin:5px 0 0}',
    '.rona-approved-access-close{width:42px;height:42px;flex:0 0 42px;border:1px solid rgba(222,236,248,.30);border-radius:12px;background:transparent;color:#fff;font-size:22px;line-height:1;cursor:pointer}',
    '.rona-approved-access-body{padding:20px}.rona-approved-access-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.rona-approved-access-subsection{margin-top:18px}',
    '.rona-approved-access-field{display:grid;gap:6px;min-width:0}.rona-approved-access-field>span,.rona-approved-access-label{font-size:14px;color:#b6c4d1;font-weight:650}',
    '.rona-approved-access-field input,.rona-approved-access-field select{width:100%;height:44px;min-width:0;border:1px solid rgba(222,236,248,.30);border-radius:12px;background:rgba(7,18,31,.78);color:#fff;padding:0 13px;outline:none;font-size:14px;box-sizing:border-box}',
    '.rona-approved-access-field input:focus,.rona-approved-access-field select:focus{border-color:rgba(145,201,248,.72);box-shadow:0 0 0 3px rgba(145,201,248,.10)}.rona-approved-access-field select option{background:#07121f}',
    '.rona-approved-contract-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:8px}',
    '.rona-approved-contract-card{position:relative;display:block;min-width:0;border:1px solid rgba(222,236,248,.30);border-radius:12px;background:rgba(10,23,38,.66);padding:12px;cursor:pointer}.rona-approved-contract-card:hover{border-color:rgba(229,58,70,.48)}.rona-approved-contract-card.is-selected{border-color:rgba(229,58,70,.68);box-shadow:inset 3px 0 0 rgba(229,58,70,.78)}',
    '.rona-approved-contract-top{display:flex;gap:8px;align-items:flex-start}.rona-approved-contract-top input{margin-top:3px;accent-color:#e53a46}.rona-approved-contract-name{font-size:14px;font-weight:800;line-height:1.35;overflow-wrap:anywhere}.rona-approved-contract-id{font-size:12px;line-height:1.45;color:#b6c4d1;margin:7px 0 0;overflow-wrap:anywhere}',
    '.rona-approved-contract-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px}.rona-approved-state{display:inline-flex;align-items:center;min-height:29px;padding:0 9px;border:1px solid rgba(222,236,248,.26);border-radius:10px;font-size:11px;font-weight:850}.rona-approved-state.ready{color:#caf2df;border-color:rgba(141,225,187,.42);background:rgba(50,128,94,.20)}.rona-approved-state.wait{color:#ffe2a4;border-color:rgba(243,202,120,.48);background:rgba(132,95,25,.22)}',
    '.rona-approved-upload{min-height:34px;padding:6px 10px;border:1px solid rgba(222,236,248,.30);border-radius:10px;background:rgba(8,21,35,.72);color:#fff;font-size:12px;font-weight:800;cursor:pointer}.rona-approved-upload:hover{background:rgba(15,33,52,.86)}',
    '.rona-approved-note{padding:13px 14px;border-left:3px solid #f3ca78;background:rgba(120,87,25,.20);border-radius:10px;font-size:13px;line-height:1.5;color:#f2e4c5}.rona-approved-note label{display:flex;align-items:flex-start;gap:8px;cursor:pointer}.rona-approved-note input{margin-top:3px;accent-color:#e53a46}',
    '.rona-approved-access-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.rona-approved-access-primary{height:44px;padding:0 15px;border:1px solid rgba(255,130,138,.50);border-radius:12px;background:rgba(202,34,47,.90);color:#fff;font-size:14px;font-weight:850;cursor:pointer}.rona-approved-access-primary:hover{background:rgba(218,42,55,.96)}.rona-approved-access-primary:disabled,.rona-approved-upload:disabled{opacity:.5;cursor:wait}',
    '.rona-approved-agent-note{padding:12px 13px;border:1px solid rgba(145,201,248,.22);border-radius:11px;background:rgba(48,91,129,.14);color:#c8d8e4;font-size:13px;line-height:1.5}',
    '@media(max-width:900px){.rona-approved-contract-grid{grid-template-columns:1fr}.rona-approved-access-grid2{grid-template-columns:1fr}.rona-approved-access-mask{padding:16px}.rona-approved-access-modal{width:min(720px,100%);max-height:calc(100vh - 32px)}}'
  ].join('');document.head.append(s)
}

function enforceRadioSingleOwner(){
  const page=q('#page-messages');if(!page)return false;
  const current=q(':scope>.rona-rs-root[data-kind="radio"]',page);
  if(!current){page.classList.remove('rona-radio-single-owner-ready');return false}
  page.classList.add('rona-radio-single-owner-ready');
  current.style.removeProperty('display');current.removeAttribute('aria-hidden');
  window.__RONA_RADIO_SINGLE_OWNER__='remaining-sections-r2';
  return true
}
function installRadioSingleOwner(){
  const page=q('#page-messages');if(!page||page.__ronaRadioSingleOwner)return;
  page.__ronaRadioSingleOwner=true;enforceRadioSingleOwner();
  new MutationObserver(()=>enforceRadioSingleOwner()).observe(page,{childList:true});
  window.addEventListener('rona:admin-pagechange',ev=>{if(String(ev?.detail?.page||'')!=='messages')return;queueMicrotask(enforceRadioSingleOwner);setTimeout(enforceRadioSingleOwner,80);setTimeout(enforceRadioSingleOwner,220)})
}

function notice(message,title='Клиенты и агенты'){
  if(window.RONA_ADMIN_DIALOGS?.message)return window.RONA_ADMIN_DIALOGS.message(String(message),{title});
  window.alert(String(message));return Promise.resolve(true)
}
async function confirmAction(message,title='Подтверждение'){
  if(window.RONA_ADMIN_DIALOGS?.confirm)return !!(await window.RONA_ADMIN_DIALOGS.confirm(String(message),{title,confirmLabel:'Подтвердить'}));
  return window.confirm(String(message))
}
async function fetchAuthority(force=false){
  if(!force&&authorityCache)return authorityCache;
  const r=await fetch(AUTH+'/bootstrap',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}}),j=await r.json().catch(()=>({}));
  if(!r.ok||j?.ok===false){const e=new Error(String(j?.code||'AUTHORITY_BOOTSTRAP_FAILED'));e.code=String(j?.code||'AUTHORITY_BOOTSTRAP_FAILED');throw e}
  authorityCache=j.data||j||{};
  window.__RONA_ADMIN_LIVE_SNAPSHOT__={...(window.__RONA_ADMIN_LIVE_SNAPSHOT__||{}),authority:authorityCache,at:new Date().toISOString()};
  return authorityCache
}
function business(){return window.__RONA_OWNER_ADMIN_SNAPSHOT__||{}}
function accessWorkspace(){return window.__RONA_ADMIN_LIVE_SNAPSHOT__?.accessWorkspace||{} }
function roles(){const xs=accessWorkspace()?.rightsModel?.clientRoles;return Array.isArray(xs)&&xs.length?xs:['Уполномоченный представитель','Директор','Бухгалтер','Логистика']}
function contracts(a){return (Array.isArray(a?.contracts)?a.contracts:[]).filter(c=>!['REVOKED','ARCHIVED','CANCELLED','CANCELED','EXPIRED','SUPERSEDED'].includes(String(c.contractStatus||c.status||c.lifecycleState||'').toUpperCase()))}
function agents(){const b=business(),xs=Array.isArray(b?.agents)?b.agents:[];const map=new Map();for(const a of xs){const id=String(a?.agent_person_id||a?.agentPersonId||a?.id||'').trim();if(id&&!map.has(id))map.set(id,a)}return [...map.values()]}
function gateProfile(a,id){const xs=Array.isArray(a?.signedContractGate?.contracts)?a.signedContractGate.contracts:[];return xs.find(x=>String(x?.contractId||'')===String(id||''))||null}
function ready(a,c){const id=String(c?.contractId||c?.id||''),g=gateProfile(a,id);if(g)return g.bilateralSignedConfirmed===true&&g.serverConfirmed!==false;return c?.bilateralSignedConfirmed===true||c?.serverConfirmed===true||!!c?.signedContractConfirmedAt||!!c?.currentSignedDocumentId}
function contractName(c){return String(c?.legalName||c?.clientName||c?.companyName||c?.clientId||'Компания')}
function contractCaption(c){const n=String(c?.currentExternalContractNumber||c?.externalContractNumber||c?.contractNumber||'').trim(),id=String(c?.contractId||c?.id||'').trim();return[n,id].filter(Boolean).join(' · ')||'Договор'}
function field(label,node){const l=el('label','rona-approved-access-field');l.append(el('span','',label),node);return l}
function removeCurrentAccessModals(){qa('.ca-modal-backdrop').forEach(n=>n.remove())}
async function backend(){for(let i=0;i<40;i++){const b=window.__RONA_PORTAL_BACKEND__;if(b&&typeof b.createAccessUser==='function')return b;await sleep(100)}throw Object.assign(new Error('ADMIN_BACKEND_UNAVAILABLE'),{code:'ADMIN_BACKEND_UNAVAILABLE'})}
function errorText(e){const code=String(e?.code||e?.message||'REQUEST_FAILED'),m={ADMIN_PASSWORD_CANCELLED:'Создание доступа отменено.',ADMIN_PASSWORD_MISMATCH:'Пароли не совпадают.',PASSWORD_POLICY_FAILED:'Пароль не соответствует требованиям безопасности.',LOGIN_ALREADY_EXISTS:'Такой логин уже существует.',SIGNED_CONTRACT_REQUIRED:'Для выбранной компании требуется подтверждённый двусторонне подписанный договор либо режим «Открыть без контракта».',COMPANY_REQUIRED:'Выберите хотя бы одну компанию / контракт.',AGENT_PROFILE_NOT_FOUND:'Профиль агента не найден.',AGENT_PROFILE_AMBIGUOUS:'Профиль агента определён неоднозначно.',AGENT_LEGAL_ENTITY_AMBIGUOUS:'Для агента найдено несколько юридических лиц.',AGENT_PORTAL_USER_ALREADY_EXISTS:'Для этого агента уже существует активный доступ.',INVALID_EMAIL:'Проверьте электронную почту.',ADMIN_BACKEND_UNAVAILABLE:'Серверный контур управления доступом не подключён.',EXECUTIVE_SOURCE_CONTRACT_REQUIRED:'Контракт ещё не зарегистрирован Исполнительным директором.',SOURCE_CONTRACT_AMBIGUOUS:'Для компании найдено несколько контрактов. Выберите конкретный Contract ID.',PDF_REQUIRED:'Выберите PDF-файл.',PDF_SIZE_INVALID:'Размер PDF не соответствует требованиям.',PDF_TYPE_INVALID:'Разрешён только PDF-файл.',PDF_SIGNATURE_INVALID:'Файл не является корректным PDF.',BILATERAL_ATTESTATION_REQUIRED:'Не подтверждено двустороннее подписание договора.'};return m[code]||('Операция не выполнена: '+code)}

async function openApprovedAccess(){
  if(q('.rona-approved-access-mask'))return;
  ensureStyle();removeCurrentAccessModals();
  let a;try{a=await fetchAuthority(false)}catch(e){await notice(errorText(e));return}
  const mask=el('div','rona-approved-access-mask'),modal=el('section','rona-approved-access-modal'),head=el('div','rona-approved-access-head'),copy=el('div'),close=el('button','rona-approved-access-close','×'),body=el('div','rona-approved-access-body');
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Создать пользователя');mask.dataset.ronaApprovedAccess='true';
  copy.append(el('h2','','Создать пользователя'),el('p','','Один ИД пользователя может иметь доступ к нескольким компаниям и контрактам'));
  close.type='button';close.setAttribute('aria-label','Закрыть');close.onclick=()=>mask.remove();head.append(copy,close);modal.append(head,body);mask.append(modal);document.body.append(mask);
  mask.addEventListener('mousedown',ev=>{if(ev.target===mask)mask.remove()});

  const type=el('select'),bindingRole=el('select'),name=el('input'),login=el('input'),email=el('input'),phone=el('input'),agentSelect=el('select'),openWithout=el('input');
  type.append(new Option('Клиент','Клиент'),new Option('Агент','Агент'));roles().forEach(x=>bindingRole.append(new Option(String(x),String(x))));
  name.placeholder='Ф.И.О. пользователя';login.placeholder='Единый логин';email.placeholder='Электронная почта';email.type='email';phone.placeholder='Телефон';phone.type='tel';
  agentSelect.append(new Option('Выберите агента',''));for(const ag of agents()){const id=String(ag.agent_person_id||ag.agentPersonId||ag.id||''),label=String(ag.agent_name||ag.display_name||ag.displayAlias||ag.full_name||ag.fullName||id);if(id)agentSelect.append(new Option(label,id))}
  openWithout.type='checkbox';openWithout.id='ronaApprovedOpenWithout';
  const top=el('div','rona-approved-access-grid2');top.append(field('Тип доступа',type),field('Роль пользователя',bindingRole));body.append(top);
  const names=el('div','rona-approved-access-grid2 rona-approved-access-subsection');names.append(field('Ф.И.О. пользователя',name),field('Единый логин',login));body.append(names);
  const contacts=el('div','rona-approved-access-grid2 rona-approved-access-subsection');contacts.append(field('Электронная почта',email),field('Телефон',phone));body.append(contacts);
  const agentWrap=el('div','rona-approved-access-subsection'),agentNote=el('div','rona-approved-agent-note','Будет создан доступ в кабинет агента по выбранному действующему профилю агента. Договорная привязка клиента для этого типа доступа не создаётся.');agentWrap.append(field('Профиль агента',agentSelect),agentNote);body.append(agentWrap);
  const contractSection=el('div','rona-approved-access-subsection'),contractLabel=el('div','rona-approved-access-label','Разрешённые компании / контракты'),contractGrid=el('div','rona-approved-contract-grid');contractSection.append(contractLabel,contractGrid);body.append(contractSection);
  const openWrap=el('div','rona-approved-note rona-approved-access-subsection'),openLabel=el('label');openLabel.append(openWithout,el('span','','Открыть без контракта — учётная запись будет создана для выбранной компании, но доступ к данным компании останется закрытым до загрузки и подтверждения подписанного договора.'));openWrap.append(openLabel);body.append(openWrap);
  const gateNote=el('div','rona-approved-note rona-approved-access-subsection','Новая пользовательская связь активируется по Contract ID только после серверного подтверждения действующего двусторонне подписанного PDF. Пароль и ИД пользователя создаются серверным сервисом.');body.append(gateNote);
  const actions=el('div','rona-approved-access-actions'),create=el('button','rona-approved-access-primary','Создать единую учётную запись');create.type='button';actions.append(create);body.append(actions);

  function selectedIds(){return qa('input[data-contract-id]:checked',contractGrid).map(x=>String(x.dataset.contractId||'')).filter(Boolean)}
  function syncCards(){qa('.rona-approved-contract-card',contractGrid).forEach(card=>{const cb=q('input[data-contract-id]',card);card.classList.toggle('is-selected',!!cb?.checked)})}
  async function upload(c,btn){
    const b=await backend();if(typeof b.attachSignedContractToExistingContract!=='function'){await notice('Серверный контур загрузки подписанного договора не подключён.');return}
    const picker=document.createElement('input');picker.type='file';picker.accept='application/pdf,.pdf';picker.hidden=true;document.body.append(picker);
    picker.addEventListener('change',async()=>{const file=picker.files?.[0]||null;picker.remove();if(!file)return;const ok=await confirmAction('Подтверждаете, что выбранный PDF является действующим двусторонне подписанным договором для выбранной компании?','Подтверждение договора');if(!ok)return;btn.disabled=true;try{await b.attachSignedContractToExistingContract({clientId:String(c.clientId||''),contractId:String(c.contractId||c.id||''),signedContractFile:file,adminClaimsBilateralSigned:true,adminAttestation:{type:'BILATERAL_SIGNED_CONTRACT_ATTESTATION',confirmed:true}});a=await fetchAuthority(true);renderContracts();await notice('Подписанный договор загружен и подтверждён сервером.','Договор подтверждён')}catch(e){await notice(errorText(e),'Договор не загружен')}finally{btn.disabled=false}},{once:true});picker.click()
  }
  function renderContracts(){
    contractGrid.replaceChildren();const xs=contracts(a);if(!xs.length){contractGrid.append(el('div','rona-approved-agent-note','Доступных компаний / контрактов в текущем серверном контуре нет.'));return}
    for(const c of xs){const id=String(c.contractId||c.id||'');if(!id)continue;const card=el('label','rona-approved-contract-card'),topLine=el('div','rona-approved-contract-top'),cb=el('input'),text=el('div'),foot=el('div','rona-approved-contract-foot'),isReady=ready(a,c);cb.type='checkbox';cb.dataset.contractId=id;cb.addEventListener('change',syncCards);text.append(el('div','rona-approved-contract-name',contractName(c)),el('div','rona-approved-contract-id',String(c.clientId||'')+(c.clientId?' · ':'')+contractCaption(c)));topLine.append(cb,text);foot.append(el('span','rona-approved-state '+(isReady?'ready':'wait'),isReady?'Договор подтверждён':'Требует договора'));if(!isReady){const up=el('button','rona-approved-upload','Загрузить договор');up.type='button';up.onclick=ev=>{ev.preventDefault();ev.stopPropagation();void upload(c,up)};foot.append(up)}card.append(topLine,foot);contractGrid.append(card)}syncCards()
  }
  renderContracts();
  function syncRole(){const isAgent=type.value==='Агент';agentWrap.hidden=!isAgent;contractSection.hidden=isAgent;openWrap.hidden=isAgent;gateNote.hidden=isAgent;bindingRole.disabled=isAgent;bindingRole.title=isAgent?'Для агента применяется фиксированный серверный профиль прав.':''}
  type.onchange=syncRole;syncRole();
  create.onclick=async()=>{const nm=name.value.trim(),lg=login.value.trim(),mail=email.value.trim(),ph=phone.value.trim(),isAgent=type.value==='Агент',ids=selectedIds(),scope=agentSelect.value.trim();if(!nm||!lg){await notice('Укажите Ф.И.О. пользователя и единый логин.','Проверка');return}if(!mail){await notice('Укажите электронную почту пользователя.','Проверка');return}if(isAgent&&!scope){await notice('Выберите профиль агента.','Проверка');return}if(!isAgent&&!ids.length){await notice('Выберите хотя бы одну компанию / контракт.','Проверка');return}if(!isAgent&&!openWithout.checked){const missing=contracts(a).filter(c=>ids.includes(String(c.contractId||c.id||''))&&!ready(a,c));if(missing.length){await notice('Для выбранной компании нет подтверждённого Администратором двусторонне подписанного договора. Загрузите договор либо выберите «Открыть без контракта».','Проверка');return}}
    create.disabled=true;try{const b=await backend(),payload={name:nm,login:lg,email:mail,phone:ph,role:isAgent?'Агент':'Клиент',bindingRole:bindingRole.value||'Уполномоченный представитель',contractIds:isAgent?[]:ids,openWithoutContract:!isAgent&&openWithout.checked};if(isAgent)payload.agentScope=scope;const out=await b.createAccessUser(payload);if(!out||out.ok===false||!out.userId)throw Object.assign(new Error('ACCESS_CREATE_NOT_CONFIRMED'),{code:'ACCESS_CREATE_NOT_CONFIRMED'});mask.remove();authorityCache=null;window.dispatchEvent(new CustomEvent('rona:admin-module-retry',{detail:{module:'clients-agents-current',page:'access'}}));const pending=Array.isArray(out.pendingContractIds)?out.pendingContractIds:[];await notice(isAgent?'Учётная запись агента создана и подтверждена сервером.':pending.length?'Учётная запись создана. Доступ к выбранной компании ожидает загрузки и подтверждения договора.':'Учётная запись создана и доступ к выбранной компании подтверждён сервером.','Доступ создан')}catch(e){if(String(e?.code||e?.message)!=='ADMIN_PASSWORD_CANCELLED')await notice(errorText(e),'Ошибка')}finally{create.disabled=false}
  };
  name.focus();window.__RONA_APPROVED_ACCESS_OPEN__=true
}

function isCreateButton(node){const b=node?.closest?.('#page-access button');if(!b)return null;const t=String(b.textContent||'').replace(/\s+/g,' ').trim();return b.dataset.ronaCreateAccess==='primary'||b.dataset.action==='create-access'||t==='Создать доступ'?b:null}
document.addEventListener('click',ev=>{const b=isCreateButton(ev.target);if(!b)return;ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();void openApprovedAccess()},true);
window.addEventListener('rona:admin-pagechange',ev=>{const page=String(ev?.detail?.page||'');if(page==='claims')ensureStyle();if(page==='messages')enforceRadioSingleOwner()});
ensureStyle();installRadioSingleOwner();window.__RONA_ADMIN_APPROVED_POLISH_READY__=true;
})();`;

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-admin-polish':'claims-access-radio-approved-v2',
    'x-rona-shell-mutation':'claims-layout-access-modal-radio-single-owner'
  }});
}