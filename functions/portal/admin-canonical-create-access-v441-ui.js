const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_CANONICAL_CREATE_ACCESS_V441__)return;
window.__RONA_CANONICAL_CREATE_ACCESS_V441__='RONA_Admin_LK_LOCAL_v4_4_1_Clients_Agents_Canonical_CreateAccess_Local.html';
if(location.pathname!=='/portal/admin')return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function ensureStyle(){
  if(q('#ronaCanonicalCreateAccessV441Style'))return;
  const s=el('style');s.id='ronaCanonicalCreateAccessV441Style';s.textContent=[
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
    '.rona-approved-contract-top{display:flex;gap:8px;align-items:flex-start}.rona-approved-contract-top input{margin-top:3px;accent-color:#e53a46}.rona-approved-contract-name{font-size:14px;font-weight:800;line-height:1.35;overflow-wrap:anywhere}.rona-approved-contract-id{font-size:12px;line-height:1.45;color:#b6c4d1;margin:7px 0 0;overflow-wrap:anywhere}.rona-approved-contract-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px}',
    '.rona-approved-state{display:inline-flex;align-items:center;min-height:29px;padding:0 9px;border:1px solid rgba(222,236,248,.26);border-radius:10px;font-size:11px;font-weight:850}.rona-approved-state.ready{color:#caf2df;border-color:rgba(141,225,187,.42);background:rgba(50,128,94,.20)}.rona-approved-state.wait{color:#ffe2a4;border-color:rgba(243,202,120,.48);background:rgba(132,95,25,.22)}',
    '.rona-approved-upload{min-height:34px;padding:6px 10px;border:1px solid rgba(222,236,248,.30);border-radius:10px;background:rgba(8,21,35,.72);color:#fff;font-size:12px;font-weight:800;cursor:pointer}.rona-approved-upload:hover{background:rgba(15,33,52,.86)}',
    '.rona-approved-note{padding:13px 14px;border-left:3px solid #f3ca78;background:rgba(120,87,25,.20);border-radius:10px;font-size:13px;line-height:1.5;color:#f2e4c5}.rona-approved-note label{display:flex;align-items:flex-start;gap:8px;cursor:pointer}.rona-approved-note input{margin-top:3px;accent-color:#e53a46}',
    '.rona-approved-access-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.rona-approved-access-primary{height:44px;padding:0 15px;border:1px solid rgba(255,130,138,.50);border-radius:12px;background:rgba(202,34,47,.90);color:#fff;font-size:14px;font-weight:850;cursor:pointer}.rona-approved-access-primary:hover{background:rgba(218,42,55,.96)}.rona-approved-access-primary:disabled,.rona-approved-upload:disabled{opacity:.5;cursor:wait}',
    '.rona-approved-agent-note{padding:12px 13px;border:1px solid rgba(145,201,248,.22);border-radius:11px;background:rgba(48,91,129,.14);color:#c8d8e4;font-size:13px;line-height:1.5}',
    '@media(max-width:900px){.rona-approved-contract-grid{grid-template-columns:1fr}.rona-approved-access-grid2{grid-template-columns:1fr}.rona-approved-access-mask{padding:16px}.rona-approved-access-modal{width:min(720px,100%);max-height:calc(100vh - 32px)}}'
  ].join('');document.head.append(s)
}

const business=()=>window.__RONA_OWNER_ADMIN_SNAPSHOT__&&typeof window.__RONA_OWNER_ADMIN_SNAPSHOT__==='object'?window.__RONA_OWNER_ADMIN_SNAPSHOT__:{};
const live=()=>window.__RONA_ADMIN_LIVE_SNAPSHOT__&&typeof window.__RONA_ADMIN_LIVE_SNAPSHOT__==='object'?window.__RONA_ADMIN_LIVE_SNAPSHOT__:{};
const authority=()=>live().authority&&typeof live().authority==='object'?live().authority:{};
const clients=()=>{const b=business();return Array.isArray(b.clients)?b.clients:Array.isArray(b.companies)?b.companies:[]};
const agents=()=>{const a=business().agents;return Array.isArray(a)?a:[]};
const contracts=()=>{const a=authority().contracts;return Array.isArray(a)?a:[]};
const contractId=c=>String(c?.contractId||c?.contract_id||c?.id||'').trim();
const clientId=c=>String(c?.clientId||c?.client_id||c?.companyId||c?.company_id||'').trim();
function clientByIds(cid,id){return clients().find(x=>String(x?.client_id||x?.clientId||x?.id||'').trim()===cid||String(x?.contract_id||x?.contractId||'').trim()===id)||null}
function companyRows(){
  const rows=[],seen=new Set();
  for(const c of contracts()){
    const id=contractId(c);if(!id||seen.has(id))continue;
    const status=String(c?.contractStatus||c?.status||'').toUpperCase();if(['REVOKED','ARCHIVED','CANCELLED','EXPIRED'].some(x=>status===x||status.includes(x)))continue;
    const cid=clientId(c),cl=clientByIds(cid,id);seen.add(id);rows.push({
      contract_id:id,
      client_id:cid||String(cl?.client_id||cl?.clientId||''),
      current_external_contract_number:String(c?.currentExternalContractNumber||c?.externalContractNumber||c?.contractNumber||cl?.current_external_contract_number||cl?.contract_number||id),
      legal_name:String(c?.companyName||c?.company_name||c?.clientName||c?.client_name||cl?.legal_name||cl?.company_name||cl?.name||cid||'Компания')
    })
  }
  for(const cl of clients()){
    const id=String(cl?.contract_id||cl?.contractId||'').trim();if(!id||seen.has(id))continue;seen.add(id);rows.push({contract_id:id,client_id:String(cl?.client_id||cl?.clientId||''),current_external_contract_number:String(cl?.current_external_contract_number||cl?.contract_number||id),legal_name:String(cl?.legal_name||cl?.company_name||cl?.name||cl?.client_id||'Компания')})
  }
  return rows
}
async function notice(message,title='Проверка'){
  if(window.RONA_ADMIN_DIALOGS?.message)return window.RONA_ADMIN_DIALOGS.message(String(message),{title});
  let n=q('#ronaCanonicalAccessInlineNotice');if(!n){n=el('div','rona-approved-note');n.id='ronaCanonicalAccessInlineNotice';const body=q('.rona-approved-access-body');if(body)body.prepend(n)}if(n)n.textContent=String(message)
}
async function backendCreate(payload){
  for(let i=0;i<30;i++){const b=window.__RONA_PORTAL_BACKEND__;if(b&&typeof b.createAccessUser==='function')return b.createAccessUser(payload);await sleep(100)}
  const e=new Error('ACCESS_BACKEND_UNAVAILABLE');e.code='ACCESS_BACKEND_UNAVAILABLE';throw e
}
function removeCompeting(){qa('.ca-modal-backdrop,.rona-canonical-access-mask,.rona-approved-access-mask').forEach(n=>n.remove())}

function openCanonicalAccessModal(){
  ensureStyle();removeCompeting();
  const previous=document.activeElement,mask=el('div','rona-approved-access-mask'),modal=el('section','rona-approved-access-modal'),head=el('div','rona-approved-access-head'),copy=el('div'),close=el('button','rona-approved-access-close','×'),body=el('div','rona-approved-access-body');
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Создать пользователя');mask.dataset.ronaApprovedAccess='true';
  copy.append(el('h2','','Создать пользователя'),el('p','','Один ИД пользователя может иметь доступ к нескольким компаниям и контрактам'));
  close.type='button';close.setAttribute('aria-label','Закрыть');head.append(copy,close);modal.append(head,body);mask.append(modal);document.body.append(mask);
  let closed=false;const finish=()=>{if(closed)return;closed=true;mask.remove();document.removeEventListener('keydown',onKey,true);try{previous?.focus?.()}catch(_){}};close.onclick=finish;mask.addEventListener('mousedown',ev=>{if(ev.target===mask)finish()});const onKey=ev=>{if(ev.key==='Escape')finish()};document.addEventListener('keydown',onKey,true);

  const type=el('select'),bindingRole=el('select'),name=el('input'),login=el('input'),email=el('input'),phone=el('input'),agentSelect=el('select'),openWithout=el('input');
  type.append(new Option('Клиент','Клиент'),new Option('Агент','Агент'));['Уполномоченный представитель','Директор','Бухгалтер','Логистика'].forEach(x=>bindingRole.append(new Option(x,x)));
  name.placeholder='Ф.И.О. пользователя';login.placeholder='Единый логин';email.placeholder='Электронная почта';email.type='email';phone.placeholder='Телефон';phone.type='tel';
  agentSelect.append(new Option('Выберите агента',''));agents().forEach(ag=>{const id=String(ag?.agent_person_id||ag?.id||'').trim(),caption=String(ag?.agent_name||ag?.display_name||ag?.full_name||id);if(id)agentSelect.append(new Option(caption,id))});
  openWithout.type='checkbox';openWithout.id='ronaApprovedOpenWithout';
  const makeField=(caption,node)=>{const l=el('label','rona-approved-access-field');l.append(el('span','',caption),node);return l};
  const top=el('div','rona-approved-access-grid2');top.append(makeField('Тип доступа',type),makeField('Роль пользователя',bindingRole));body.append(top);
  const names=el('div','rona-approved-access-grid2 rona-approved-access-subsection');names.append(makeField('Ф.И.О. пользователя',name),makeField('Единый логин',login));body.append(names);
  const contacts=el('div','rona-approved-access-grid2 rona-approved-access-subsection');contacts.append(makeField('Электронная почта',email),makeField('Телефон',phone));body.append(contacts);

  const agentWrap=el('div','rona-approved-access-subsection'),agentNote=el('div','rona-approved-agent-note','Будет создан доступ в кабинет агента по выбранному действующему профилю агента. Договорная привязка клиента для этого типа доступа не создаётся.');agentWrap.append(makeField('Профиль агента',agentSelect),agentNote);body.append(agentWrap);
  const contractSection=el('div','rona-approved-access-subsection'),contractLabel=el('div','rona-approved-access-label','Разрешённые компании / контракты'),contractGrid=el('div','rona-approved-contract-grid');contractSection.append(contractLabel,contractGrid);body.append(contractSection);
  const rows=companyRows(),selectedIds=()=>qa('input[data-contract-id]:checked',contractGrid).map(x=>String(x.dataset.contractId||'')).filter(Boolean),syncCards=()=>qa('.rona-approved-contract-card',contractGrid).forEach(card=>{const cb=q('input[data-contract-id]',card);card.classList.toggle('is-selected',!!cb?.checked)});
  rows.forEach(c=>{const id=String(c.contract_id||'').trim();if(!id)return;const card=el('label','rona-approved-contract-card'),topLine=el('div','rona-approved-contract-top'),cb=el('input'),ct=el('div'),foot=el('div','rona-approved-contract-foot');cb.type='checkbox';cb.dataset.contractId=id;cb.addEventListener('change',syncCards);ct.append(el('div','rona-approved-contract-name',c.legal_name||c.client_id||'Компания'),el('div','rona-approved-contract-id',[c.client_id,c.current_external_contract_number,id].filter(Boolean).join(' · ')));topLine.append(cb,ct);foot.append(el('span','rona-approved-state ready','Договор подтверждён'));card.append(topLine,foot);contractGrid.append(card)});syncCards();
  if(!rows.length)contractGrid.append(el('div','rona-approved-note','Доступные компании / контракты не получены. Обновите раздел и повторите попытку.'));

  const openWrap=el('div','rona-approved-note rona-approved-access-subsection'),openLabel=el('label');openLabel.append(openWithout,el('span','','Открыть без контракта — учётная запись будет создана для выбранной компании, но доступ к данным компании останется закрытым до загрузки и подтверждения подписанного договора.'));openWrap.append(openLabel);body.append(openWrap);
  const gateNote=el('div','rona-approved-note rona-approved-access-subsection','Новая пользовательская связь активируется по Contract ID только после серверного подтверждения действующего двусторонне подписанного PDF. Пароль и ИД пользователя создаются серверным сервисом.');body.append(gateNote);
  const actions=el('div','rona-approved-access-actions'),create=el('button','rona-approved-access-primary','Создать единую учётную запись');create.type='button';actions.append(create);body.append(actions);

  function syncRole(){const isAgent=type.value==='Агент';agentWrap.hidden=!isAgent;contractSection.hidden=isAgent;openWrap.hidden=isAgent;gateNote.hidden=isAgent;bindingRole.disabled=isAgent;bindingRole.title=isAgent?'Для агента применяется фиксированный профиль прав.':''}
  type.onchange=syncRole;syncRole();

  create.onclick=async()=>{
    const nm=name.value.trim(),lg=login.value.trim(),mail=email.value.trim(),ph=phone.value.trim(),isAgent=type.value==='Агент',ids=selectedIds(),scope=agentSelect.value.trim();
    if(!nm||!lg)return notice('Укажите Ф.И.О. пользователя и единый логин.','Проверка');
    if(!mail)return notice('Укажите электронную почту пользователя.','Проверка');
    if(isAgent&&!scope)return notice('Выберите профиль агента.','Проверка');
    if(!isAgent&&!ids.length)return notice('Выберите хотя бы одну компанию / контракт.','Проверка');
    create.disabled=true;
    try{
      const payload={name:nm,login:lg,email:mail,phone:ph,role:isAgent?'Агент':'Клиент',bindingRole:bindingRole.value||'Уполномоченный представитель',contractIds:isAgent?[]:ids,openWithoutContract:!isAgent&&openWithout.checked};if(isAgent)payload.agentScope=scope;
      const out=await backendCreate(payload);finish();
      const pending=Array.isArray(out?.pendingContractIds)?out.pendingContractIds:[];
      await notice(isAgent?'Доступ агента создан и подтверждён сервером.':pending.length?'Учётная запись создана. Доступ к данным выбранной компании ожидает подтверждения договора.':'Доступ клиента создан и подтверждён сервером.','Доступ создан');
      location.reload()
    }catch(e){
      const code=String(e?.code||e?.message||'REQUEST_FAILED'),messages={ADMIN_PASSWORD_CANCELLED:'Создание доступа отменено.',PASSWORD_POLICY_FAILED:'Пароль не соответствует требованиям безопасности.',LOGIN_ALREADY_EXISTS:'Такой логин уже существует.',SIGNED_CONTRACT_REQUIRED:'Для выбранной компании требуется подтверждённый договор либо режим открытия без договора.',COMPANY_REQUIRED:'Выберите хотя бы одну компанию / договор.',AGENT_PROFILE_NOT_FOUND:'Профиль агента не найден.',AGENT_PORTAL_USER_ALREADY_EXISTS:'Для этого агента уже существует активный доступ.',INVALID_EMAIL:'Проверьте электронную почту.',ACCESS_BACKEND_UNAVAILABLE:'Серверный контур управления доступом временно недоступен.'};await notice(messages[code]||('Операция не выполнена: '+code),'Ошибка')
    }finally{create.disabled=false}
  };
  queueMicrotask(()=>name.focus())
}

function enforceOwner(){
  const page=q('#page-access');if(page){page.dataset.ronaAccessUiOwner='clients-agents-current-v4';page.dataset.ronaAccessCreateOwner='approved-canonical-v4.4.1';qa('button',page).forEach(b=>{if(String(b.textContent||'').trim()==='Создать доступ')b.textContent='Создать пользователя'})}
  document.documentElement.dataset.ronaAccessOwner='clients-agents-current-v4';document.documentElement.dataset.ronaAccessCreateOwner='approved-canonical-v4.4.1';
  window.__RONA_ACCESS_CANONICAL_FORM__='RONA_Admin_LK_LOCAL_v4_4_1_Clients_Agents_Canonical_CreateAccess_Local.html';window.__RONA_ACCESS_CREATE_OWNER__='approved-canonical-v4.4.1'
}
window.addEventListener('click',ev=>{const button=ev.target?.closest?.('button');if(!button)return;const page=button.closest('#page-access'),marked=button.matches('[data-rona-create-access="primary"],[data-action="create-access"]'),named=page&&['Создать доступ','Создать пользователя'].includes(String(button.textContent||'').trim());if(!marked&&!named)return;ev.preventDefault();ev.stopImmediatePropagation();ev.stopPropagation();openCanonicalAccessModal()},true);
window.addEventListener('rona:admin-pagechange',ev=>{if(String(ev?.detail?.page||'')==='access'){enforceOwner();setTimeout(enforceOwner,80);setTimeout(enforceOwner,220)}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enforceOwner,{once:true});else enforceOwner();
})();`;

export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-access-canonical-source':'RONA_Admin_LK_LOCAL_v4_4_1_Clients_Agents_Canonical_CreateAccess_Local.html','x-rona-access-create-owner':'approved-canonical-v4.4.1','x-rona-access-workspace-owner':'clients-agents-current-v4'}})}
