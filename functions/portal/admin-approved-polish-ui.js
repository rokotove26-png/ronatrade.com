const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_ADMIN_APPROVED_POLISH__)return;
window.__RONA_ADMIN_APPROVED_POLISH__='20260828-canonical-access-v3413-v4';
if(location.pathname!=='/portal/admin')return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};

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
    '.rona-admin-dialog-mask{position:fixed;inset:0;z-index:2147483400;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,8,14,.78);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}',
    '.rona-admin-dialog{width:min(500px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;border:1px solid rgba(222,236,248,.30);border-radius:18px;background:rgba(5,16,28,.99);color:#f7fbff;box-shadow:0 28px 90px rgba(0,0,0,.52)}',
    '.rona-admin-dialog-head{padding:20px 22px 12px}.rona-admin-dialog-head h2{margin:0;font-size:22px;line-height:1.2}.rona-admin-dialog-body{padding:4px 22px 20px;color:#b6c4d1;font-size:14px;line-height:1.55;white-space:pre-wrap}',
    '.rona-admin-dialog-fields{display:grid;gap:13px;padding:0 22px 4px}.rona-admin-dialog-field{display:grid;gap:7px}.rona-admin-dialog-field span{font-size:13px;color:#b6c4d1}.rona-admin-dialog-field input{width:100%;height:44px;border:1px solid rgba(222,236,248,.30);border-radius:12px;background:rgba(7,18,31,.82);color:#fff;padding:0 13px;outline:none}',
    '.rona-admin-dialog-hint{padding:8px 22px 0;color:#b6c4d1;font-size:12px;line-height:1.45}.rona-admin-dialog-error{padding:9px 22px 0;color:#ff9ca4;font-size:12px;line-height:1.4}',
    '.rona-admin-dialog-actions{display:flex;justify-content:flex-end;gap:10px;padding:20px 22px;border-top:1px solid rgba(222,236,248,.16)}.rona-admin-dialog-actions button{height:42px;padding:0 15px;border:1px solid rgba(222,236,248,.30);border-radius:11px;background:rgba(8,21,35,.82);color:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer}.rona-admin-dialog-actions button[data-primary=true]{background:rgba(202,34,47,.90);border-color:rgba(255,130,138,.50)}',
    '.rona-canonical-access-mask{position:fixed;inset:0;z-index:2147483460;background:rgba(2,8,14,.68);display:flex;align-items:center;justify-content:center;padding:30px;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}',
    '.rona-canonical-access-modal{width:min(860px,96vw);max-height:88vh;overflow:auto;border:1px solid var(--line,rgba(222,236,248,.24));border-radius:20px;background:rgba(5,16,28,.98);color:#fff;box-shadow:0 30px 100px rgba(0,0,0,.58)}',
    '.rona-canonical-access-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px;border-bottom:1px solid var(--line,rgba(222,236,248,.18))}.rona-canonical-access-head h2{font-size:25px;line-height:1.2;margin:0}.rona-canonical-access-head p{font-size:14px;line-height:1.5;color:var(--muted,#9fb4c0);margin:5px 0 0}',
    '.rona-canonical-access-close{flex:0 0 auto;width:38px;height:38px;border:1px solid var(--line,rgba(222,236,248,.22));border-radius:11px;background:rgba(7,18,31,.74);color:#fff;font:inherit;font-size:24px;line-height:1;cursor:pointer}',
    '.rona-canonical-access-body{padding:20px}.rona-canonical-access-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.rona-canonical-access-subsection{margin-top:14px}',
    '.rona-canonical-access-body label.rona-canonical-access-label{display:grid;gap:6px;color:var(--muted,#9fb4c0);font-size:13px}.rona-canonical-access-field,.rona-canonical-access-select{box-sizing:border-box;width:100%;height:44px;border:1px solid var(--line,rgba(222,236,248,.24));border-radius:12px;background:rgba(7,18,31,.72);color:#fff;padding:0 13px;outline:none;font:inherit;font-size:14px}.rona-canonical-access-field::placeholder{color:rgba(194,208,220,.58)}',
    '.rona-canonical-access-channels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:8px}.rona-canonical-access-channel{display:block;border:1px solid var(--line,rgba(222,236,248,.20));border-radius:12px;background:var(--panel-soft,rgba(8,21,35,.68));padding:12px;color:#fff;cursor:pointer}.rona-canonical-access-channel.is-blocked{opacity:.58;cursor:not-allowed}.rona-canonical-access-channel-row{display:flex;gap:8px;align-items:flex-start;font-size:14px;font-weight:750}.rona-canonical-access-channel-row input{margin:2px 0 0}.rona-canonical-access-channel p{font-size:12px;line-height:1.45;color:var(--muted,#9fb4c0);margin:6px 0 0;overflow-wrap:anywhere}',
    '.rona-canonical-access-state{display:inline-flex;margin-top:8px;padding:4px 8px;border:1px solid rgba(145,190,214,.18);border-radius:999px;font-size:10px;font-weight:800}.rona-canonical-access-state.ok{border-color:rgba(73,205,141,.34);color:#8ee4ba}.rona-canonical-access-state.warn{border-color:rgba(241,192,87,.32);color:#f4d88c}.rona-canonical-access-state.blocked{border-color:rgba(255,126,137,.30);color:#ffadb5}',
    '.rona-canonical-access-note{margin-top:14px;padding:12px 13px;border:1px solid rgba(241,192,87,.25);border-radius:12px;background:rgba(241,192,87,.07);color:#d7c9a3;font-size:12px;line-height:1.5}.rona-canonical-access-error{min-height:18px;margin-top:10px;color:#ffadb5;font-size:12px;line-height:1.4}',
    '.rona-canonical-access-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}.rona-canonical-access-primary{height:42px;padding:0 15px;border:1px solid rgba(89,215,255,.42);border-radius:11px;background:linear-gradient(135deg,rgba(39,105,145,.52),rgba(24,58,92,.58));color:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer}.rona-canonical-access-primary:disabled{opacity:.55;cursor:wait}',
    '@media(max-width:760px){.rona-canonical-access-mask{padding:16px}.rona-canonical-access-grid2,.rona-canonical-access-channels{grid-template-columns:1fr}.rona-canonical-access-modal{width:100%;max-height:calc(100vh - 32px)}}',
    '@media(max-width:520px){.rona-admin-dialog-mask{padding:16px}.rona-admin-dialog-actions{flex-direction:column-reverse}.rona-admin-dialog-actions button{width:100%}}'
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

function installDialogs(){
  if(window.RONA_ADMIN_DIALOGS?.message&&window.RONA_ADMIN_DIALOGS?.confirm&&window.RONA_ADMIN_DIALOGS?.password)return;
  let queue=Promise.resolve();
  const dialogError=code=>{const e=new Error(code);e.code=code;return e};
  const enqueue=f=>{const run=queue.then(f,f);queue=run.catch(()=>{});return run};
  function frame(title,message){
    ensureStyle();const previous=document.activeElement,mask=el('div','rona-admin-dialog-mask'),card=el('section','rona-admin-dialog'),head=el('div','rona-admin-dialog-head'),h=el('h2','',title||'Уведомление');
    card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');head.append(h);card.append(head);if(message!==undefined&&message!==null)card.append(el('div','rona-admin-dialog-body',String(message)));mask.append(card);document.body.append(mask);
    let closed=false;const close=()=>{if(closed)return;closed=true;mask.remove();try{previous?.focus?.()}catch(_){}};return{mask,card,close}
  }
  function message(message,options={}){return enqueue(()=>new Promise(resolve=>{const f=frame(options.title||'Уведомление',message),a=el('div','rona-admin-dialog-actions'),ok=el('button','','OK');ok.type='button';ok.dataset.primary='true';ok.onclick=()=>{f.close();resolve(true)};a.append(ok);f.card.append(a);queueMicrotask(()=>ok.focus())}))}
  function confirm(message,options={}){return enqueue(()=>new Promise(resolve=>{const f=frame(options.title||'Подтверждение действия',message),a=el('div','rona-admin-dialog-actions'),cancel=el('button','',options.cancelLabel||'Отмена'),ok=el('button','',options.confirmLabel||'Подтвердить');cancel.type=ok.type='button';ok.dataset.primary='true';const done=v=>{f.close();resolve(v===true)};cancel.onclick=()=>done(false);ok.onclick=()=>done(true);f.mask.addEventListener('mousedown',ev=>{if(ev.target===f.mask)done(false)});a.append(cancel,ok);f.card.append(a);queueMicrotask(()=>ok.focus())}))}
  function password(label='Установите первоначальный пароль для учётной записи'){return enqueue(()=>new Promise((resolve,reject)=>{const f=frame('Установите пароль',label),fields=el('div','rona-admin-dialog-fields'),hint=el('div','rona-admin-dialog-hint','Не менее 10 символов: заглавная и строчная буквы, цифра и специальный символ.'),err=el('div','rona-admin-dialog-error'),a=el('div','rona-admin-dialog-actions'),cancel=el('button','','Отмена'),ok=el('button','','Подтвердить');
    const make=(title)=>{const l=el('label','rona-admin-dialog-field'),s=el('span','',title),i=el('input');i.type='password';i.autocomplete='new-password';l.append(s,i);fields.append(l);return i},p1=make('Пароль'),p2=make('Повторите пароль');
    cancel.type=ok.type='button';ok.dataset.primary='true';const fail=t=>{err.textContent=t;p1.focus()};const submit=()=>{const x=String(p1.value||''),y=String(p2.value||'');if(x!==y)return fail('Пароли не совпадают.');if(x.length<10||!/[A-ZА-ЯЁ]/.test(x)||!/[a-zа-яё]/.test(x)||!/[0-9]/.test(x)||!(/[^A-Za-zА-Яа-яЁё0-9]/.test(x)))return fail('Пароль не соответствует требованиям безопасности.');f.close();resolve(x)};cancel.onclick=()=>{f.close();reject(dialogError('ADMIN_PASSWORD_CANCELLED'))};ok.onclick=submit;for(const i of [p1,p2])i.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();submit()}});f.card.append(fields,hint,err,a);a.append(cancel,ok);queueMicrotask(()=>p1.focus())}))}
  window.RONA_ADMIN_DIALOGS=Object.freeze({message,notify:message,confirm,password});
  window.__RONA_ADMIN_DIALOGS_OWNER__='approved-polish-dialog-service-v1';
}

const accessSnapshot=()=>window.__RONA_ADMIN_LIVE_SNAPSHOT__&&typeof window.__RONA_ADMIN_LIVE_SNAPSHOT__==='object'?window.__RONA_ADMIN_LIVE_SNAPSHOT__:{};
const accessAuthority=()=>accessSnapshot().authority&&typeof accessSnapshot().authority==='object'?accessSnapshot().authority:{};
const accessBusiness=()=>window.__RONA_OWNER_ADMIN_SNAPSHOT__&&typeof window.__RONA_OWNER_ADMIN_SNAPSHOT__==='object'?window.__RONA_OWNER_ADMIN_SNAPSHOT__:{};
function accessContracts(){const a=accessAuthority();return Array.isArray(a.contracts)?a.contracts:[]}
function accessClients(){const b=accessBusiness();return Array.isArray(b.clients)?b.clients:Array.isArray(b.companies)?b.companies:[]}
function contractIdOf(c){return String(c?.contractId||c?.contract_id||c?.id||'').trim()}
function clientIdOf(c){return String(c?.clientId||c?.client_id||c?.companyId||c?.company_id||'').trim()}
function clientForContract(c){const cid=clientIdOf(c),contractId=contractIdOf(c);return accessClients().find(x=>String(x?.client_id||x?.clientId||x?.id||'')===cid||String(x?.contract_id||x?.contractId||'')===contractId)||null}
function contractCompanyName(c){const x=clientForContract(c);return String(c?.companyName||c?.company_name||c?.clientName||c?.client_name||x?.legal_name||x?.company_name||x?.name||c?.currentExternalContractNumber||c?.externalContractNumber||c?.contractNumber||contractIdOf(c)||'Компания')}
function contractGate(c){
  const status=String(c?.signedStatus||c?.signed_status||c?.documentStatus||c?.document_status||c?.contractStatus||c?.status||'').toUpperCase();
  const blocked=['REVOKED','ARCHIVED','CANCELLED','EXPIRED','DRAFT','PENDING','UNSIGNED','NOT_SIGNED','REJECTED'].some(x=>status===x||status.includes(x));
  const ownFalse=['bilateralSignedConfirmed','signedPdfConfirmed','signedDocumentConfirmed','signedConfirmed','hasSignedPdf'].some(k=>Object.prototype.hasOwnProperty.call(c||{},k)&&c[k]===false);
  const ownTrue=['bilateralSignedConfirmed','signedPdfConfirmed','signedDocumentConfirmed','signedConfirmed','hasSignedPdf'].some(k=>c?.[k]===true);
  const signed=ownTrue||['SIGNED','EXECUTED','ACTIVE','VALID','APPROVED','CONFIRMED'].some(x=>status===x||status.includes(x));
  if(blocked||ownFalse)return{allow:false,label:'Нет подтверждённого signed PDF',tone:'blocked'};
  if(signed)return{allow:true,label:'Signed PDF подтверждён',tone:'ok'};
  return{allow:true,label:'Signed PDF проверяется сервером',tone:'warn'}
}
async function accessNotice(message,title='Проверка'){if(window.RONA_ADMIN_DIALOGS?.message)return window.RONA_ADMIN_DIALOGS.message(String(message),{title});window.alert(String(message))}
function removeCompetingAccessModals(){qa('.ca-modal-backdrop,.rona-approved-access-mask,.rona-canonical-access-mask').forEach(n=>n.remove())}
function canonicalAccessContractCards(root){
  root.replaceChildren();const contracts=accessContracts().filter(c=>!['REVOKED','ARCHIVED','CANCELLED','EXPIRED'].includes(String(c?.contractStatus||c?.status||'').toUpperCase()));
  if(!contracts.length){const empty=el('div','rona-canonical-access-note','Доступные договоры не получены. Обновите раздел и повторите создание пользователя.');empty.style.gridColumn='1/-1';root.append(empty);return}
  for(const c of contracts){const id=contractIdOf(c);if(!id)continue;const gate=contractGate(c),label=el('label','rona-canonical-access-channel'+(gate.allow?'':' is-blocked')),row=el('div','rona-canonical-access-channel-row'),check=el('input'),name=el('b','',contractCompanyName(c)),meta=el('p','',(clientIdOf(c)||'Client ID')+' · '+id),state=el('span','rona-canonical-access-state '+gate.tone,gate.label);check.type='checkbox';check.className='newContractCheck';check.value=id;check.disabled=!gate.allow;row.append(check,name);label.append(row,meta,state);root.append(label)}
}
function openCanonicalAccessModal(){
  ensureStyle();removeCompetingAccessModals();
  const previous=document.activeElement,mask=el('div','rona-canonical-access-mask'),modal=el('section','rona-canonical-access-modal'),head=el('div','rona-canonical-access-head'),headCopy=el('div'),title=el('h2','','Создать пользователя'),subtitle=el('p','','Один ИД пользователя может иметь доступ к нескольким компаниям и контрактам'),close=el('button','rona-canonical-access-close','×'),body=el('div','rona-canonical-access-body');
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','ronaCanonicalAccessTitle');title.id='ronaCanonicalAccessTitle';close.type='button';close.setAttribute('aria-label','Закрыть');headCopy.append(title,subtitle);head.append(headCopy,close);
  const row1=el('div','rona-canonical-access-grid2'),typeLabel=el('label','rona-canonical-access-label'),typeText=el('span','','Тип доступа'),role=el('select','rona-canonical-access-select'),roleLabel=el('label','rona-canonical-access-label'),roleText=el('span','','Роль пользователя'),binding=el('select','rona-canonical-access-select');
  role.id='newRole';role.append(new Option('Клиент','Клиент'),new Option('Агент — матрица прав не утверждена','Агент'));role.options[1].disabled=true;
  binding.id='newBindingRole';['Уполномоченный представитель','Директор','Бухгалтер','Логистика'].forEach(x=>binding.append(new Option(x,x)));typeLabel.append(typeText,role);roleLabel.append(roleText,binding);row1.append(typeLabel,roleLabel);
  const row2=el('div','rona-canonical-access-grid2 rona-canonical-access-subsection'),name=el('input','rona-canonical-access-field'),login=el('input','rona-canonical-access-field');name.id='newName';name.placeholder='Ф.И.О. пользователя';login.id='newLogin';login.placeholder='Единый логин';row2.append(name,login);
  const row3=el('div','rona-canonical-access-grid2 rona-canonical-access-subsection'),email=el('input','rona-canonical-access-field'),phone=el('input','rona-canonical-access-field');email.id='newEmail';email.type='email';email.placeholder='Электронная почта';phone.id='newPhone';phone.type='tel';phone.placeholder='Телефон';row3.append(email,phone);
  const contractsBlock=el('div','rona-canonical-access-subsection'),contractsTitle=el('div','','Разрешённые компании / контракты'),channels=el('div','rona-canonical-access-channels');contractsTitle.style.color='var(--muted,#9fb4c0)';contractsTitle.style.fontSize='13px';channels.id='newContractOptions';canonicalAccessContractCards(channels);contractsBlock.append(contractsTitle,channels);
  const note=el('div','rona-canonical-access-note','Новая пользовательская связь разрешается только по ИД контракта с действующим двусторонне подписанным PDF, подтверждённым сервером. Пароль и ИД пользователя создаются только серверным сервисом.'),err=el('div','rona-canonical-access-error'),actions=el('div','rona-canonical-access-actions'),save=el('button','rona-canonical-access-primary','Создать единую учётную запись');save.type='button';actions.append(save);body.append(row1,row2,row3,contractsBlock,note,err,actions);modal.append(head,body);mask.append(modal);document.body.append(mask);window.__RONA_APPROVED_ACCESS_OPEN__=true;
  const finish=()=>{window.__RONA_APPROVED_ACCESS_OPEN__=false;mask.remove();try{previous?.focus?.()}catch(_){}};close.onclick=finish;mask.addEventListener('mousedown',ev=>{if(ev.target===mask)finish()});
  const onKey=ev=>{if(ev.key==='Escape'){document.removeEventListener('keydown',onKey,true);finish()}};document.addEventListener('keydown',onKey,true);
  save.onclick=async()=>{const nm=String(name.value||'').trim(),lg=String(login.value||'').trim(),ids=qa('.newContractCheck:checked',mask).map(x=>x.value);err.textContent='';if(!nm||!lg){err.textContent='Укажите Ф.И.О. и единый логин';return}if(!ids.length){err.textContent='Выберите хотя бы одну компанию / контракт';return}const backend=window.__RONA_PORTAL_BACKEND__;if(!backend||typeof backend.createAccessUser!=='function'){err.textContent='Учётная запись не создана: серверный контур управления доступом не подключён.';return}save.disabled=true;try{const req={name:nm,login:lg,role:role.value||'Клиент',bindingRole:binding.value||'Уполномоченный представитель',contractIds:ids,agentScope:null};const out=await backend.createAccessUser(req);if(!out||out.ok===false)throw Object.assign(new Error(String(out?.code||'SERVER_REJECTED')),{code:String(out?.code||'SERVER_REJECTED')});finish();await accessNotice('Учётная запись создана и подтверждена сервером.','Доступ создан');location.reload()}catch(e){const code=String(e?.code||e?.message||'REQUEST_FAILED'),messages={ADMIN_PASSWORD_CANCELLED:'Создание доступа отменено.',PASSWORD_POLICY_FAILED:'Пароль не соответствует требованиям безопасности.',LOGIN_ALREADY_EXISTS:'Такой логин уже существует.',SIGNED_CONTRACT_REQUIRED:'Выбранный ИД контракта не имеет действующего двусторонне подписанного PDF, подтверждённого сервером.',COMPANY_REQUIRED:'Выберите хотя бы одну компанию / контракт.',INVALID_EMAIL:'Проверьте электронную почту.'};err.textContent=messages[code]||('Операция не выполнена: '+code)}finally{save.disabled=false}};
  queueMicrotask(()=>name.focus())
}
function installCanonicalAccessCreate(){
  if(document.__ronaCanonicalAccessCreate)return;document.__ronaCanonicalAccessCreate=true;
  document.addEventListener('click',ev=>{const button=ev.target?.closest?.('button');if(!button)return;const page=button.closest('#page-access');const marked=button.matches('[data-rona-create-access="primary"],[data-action="create-access"]');const named=page&&['Создать доступ','Создать пользователя'].includes(String(button.textContent||'').trim());if(!marked&&!named)return;ev.preventDefault();ev.stopImmediatePropagation();openCanonicalAccessModal()},true);
  window.__RONA_ACCESS_CANONICAL_FORM__='admin-v3.4.13-create-access';
  window.__RONA_ACCESS_CREATE_OWNER__='approved-canonical-v3.4.13'
}
function enforceAccessSingleOwner(){
  qa('.rona-approved-access-mask').forEach(n=>n.remove());
  const page=q('#page-access');if(!page)return;
  page.dataset.ronaAccessUiOwner='clients-agents-current-v4';page.dataset.ronaAccessCreateOwner='approved-canonical-v3.4.13';
  document.documentElement.dataset.ronaAccessOwner='clients-agents-current-v4';document.documentElement.dataset.ronaAccessCreateOwner='approved-canonical-v3.4.13';
  qa('button',page).forEach(b=>{if(String(b.textContent||'').trim()==='Создать доступ')b.textContent='Создать пользователя'});
  if(!q('.rona-canonical-access-mask'))window.__RONA_APPROVED_ACCESS_OPEN__=false
}

window.addEventListener('rona:admin-pagechange',ev=>{const page=String(ev?.detail?.page||'');if(page==='claims')ensureStyle();if(page==='messages')enforceRadioSingleOwner();if(page==='access'){enforceAccessSingleOwner();setTimeout(enforceAccessSingleOwner,80);setTimeout(enforceAccessSingleOwner,220)}});
ensureStyle();installDialogs();installRadioSingleOwner();installCanonicalAccessCreate();enforceAccessSingleOwner();
window.__RONA_ADMIN_APPROVED_POLISH_READY__=true;
})();`;

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-admin-polish':'canonical-access-v3413-v4',
    'x-rona-access-owner':'clients-agents-current-v4',
    'x-rona-access-create-owner':'approved-canonical-v3.4.13',
    'x-rona-shell-mutation':'claims-layout-radio-dialog-service-canonical-access-modal'
  }});
}
