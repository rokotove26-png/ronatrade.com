const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_CANONICAL_CREATE_ACCESS_V441__)return;
window.__RONA_CANONICAL_CREATE_ACCESS_V441__='RONA_Admin_LK_LOCAL_v4_4_1_Clients_Agents_Canonical_CreateAccess_Local.html';
window.__RONA_ACCESS_FUNCTIONAL_BUILD__='create-user-contract-pdf-v5-20260828';
if(location.pathname!=='/portal/admin')return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};
const txt=v=>String(v??'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const state={business:null,authority:null,selected:new Set(),busy:false};

function ensureStyle(){
 if(q('#ronaCanonicalCreateAccessV441Style'))return;
 const s=el('style');s.id='ronaCanonicalCreateAccessV441Style';s.textContent=[
 '.rona-approved-access-mask{position:fixed;inset:0;z-index:2147483250;background:rgba(2,8,14,.76);display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}',
 '.rona-approved-access-modal{width:min(1060px,97vw);max-height:92vh;overflow:auto;border:1px solid rgba(222,236,248,.30);border-radius:20px;background:rgba(5,16,28,.99);color:#f7fbff;box-shadow:0 30px 100px rgba(0,0,0,.58)}',
 '.rona-approved-access-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px 22px;border-bottom:1px solid rgba(222,236,248,.18);position:sticky;top:0;z-index:3;background:rgba(5,16,28,.985)}',
 '.rona-approved-access-head h2{font-size:24px;line-height:1.2;margin:0;font-weight:850}.rona-approved-access-head p{font-size:13px;line-height:1.5;color:#9fb4c0;margin:5px 0 0}',
 '.rona-approved-access-close{width:40px;height:40px;flex:0 0 40px;border:1px solid rgba(222,236,248,.24);border-radius:11px;background:rgba(7,18,31,.72);color:#fff;font-size:21px;line-height:1;cursor:pointer}',
 '.rona-approved-access-body{padding:20px 22px 22px}.rona-approved-access-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}.rona-approved-access-subsection{margin-top:16px}',
 '.rona-approved-access-field{display:grid;gap:6px;min-width:0}.rona-approved-access-field>span,.rona-approved-access-label{font-size:12px;color:#b6c4d1;font-weight:700}.rona-approved-access-label{display:flex;align-items:center;justify-content:space-between;gap:12px}',
 '.rona-approved-access-field input,.rona-approved-access-field select{width:100%;height:42px;min-width:0;border:1px solid rgba(222,236,248,.26);border-radius:11px;background:rgba(7,18,31,.78);color:#fff;padding:0 12px;outline:none;font-size:13px;box-sizing:border-box}',
 '.rona-approved-access-field input:focus,.rona-approved-access-field select:focus{border-color:rgba(145,201,248,.68);box-shadow:0 0 0 3px rgba(145,201,248,.10)}.rona-approved-access-field select option{background:#07121f}',
 '.rona-approved-password-hint{margin-top:8px;color:#8fa6b5;font-size:11px;line-height:1.45}',
 '.rona-approved-contract-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;padding:10px 11px;border:1px solid rgba(145,190,214,.14);border-radius:11px;background:rgba(8,20,33,.52);font-size:12px;color:#9fb4c0}',
 '.rona-approved-contract-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}',
 '.rona-approved-contract-card{position:relative;display:grid;gap:9px;min-width:0;border:1px solid rgba(222,236,248,.22);border-radius:13px;background:rgba(10,23,38,.66);padding:12px}.rona-approved-contract-card.is-selected{border-color:rgba(229,58,70,.62);box-shadow:inset 3px 0 0 rgba(229,58,70,.78)}',
 '.rona-approved-contract-top{display:flex;gap:9px;align-items:flex-start}.rona-approved-contract-top input{margin-top:3px;accent-color:#e53a46}.rona-approved-contract-name{font-size:13px;font-weight:800;line-height:1.35;overflow-wrap:anywhere}.rona-approved-contract-id{font-size:11px;line-height:1.45;color:#91a8b7;margin-top:5px;overflow-wrap:anywhere}',
 '.rona-approved-contract-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.rona-approved-contract-actions{display:flex;gap:7px;flex-wrap:wrap}',
 '.rona-approved-state{display:inline-flex;align-items:center;min-height:28px;padding:0 8px;border:1px solid rgba(222,236,248,.24);border-radius:9px;font-size:10.5px;font-weight:850}.rona-approved-state.ready{color:#caf2df;border-color:rgba(141,225,187,.42);background:rgba(50,128,94,.20)}.rona-approved-state.wait{color:#ffe2a4;border-color:rgba(243,202,120,.48);background:rgba(132,95,25,.22)}.rona-approved-state.missing{color:#ffc7cc;border-color:rgba(229,58,70,.42);background:rgba(123,31,42,.22)}',
 '.rona-approved-upload{min-height:32px;padding:5px 9px;border:1px solid rgba(145,190,214,.26);border-radius:9px;background:rgba(8,21,35,.72);color:#fff;font-size:11px;font-weight:800;cursor:pointer}.rona-approved-upload:hover{background:rgba(15,33,52,.86)}.rona-approved-upload:disabled{opacity:.55;cursor:wait}',
 '.rona-approved-note{padding:12px 13px;border-left:3px solid #f3ca78;background:rgba(120,87,25,.18);border-radius:10px;font-size:12px;line-height:1.5;color:#eadfc9}.rona-approved-note label{display:flex;align-items:flex-start;gap:8px;cursor:pointer}.rona-approved-note input{margin-top:3px;accent-color:#e53a46}',
 '.rona-approved-agent-note{padding:12px 13px;border:1px solid rgba(145,201,248,.20);border-radius:11px;background:rgba(48,91,129,.13);color:#c8d8e4;font-size:12px;line-height:1.5}',
 '.rona-approved-summary{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rona-approved-summary span{padding:5px 8px;border:1px solid rgba(145,190,214,.16);border-radius:999px;font-size:10.5px;color:#a9bcc8}',
 '.rona-approved-access-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:18px;padding-top:16px;border-top:1px solid rgba(222,236,248,.14)}.rona-approved-access-primary{height:42px;padding:0 15px;border:1px solid rgba(255,130,138,.50);border-radius:11px;background:rgba(202,34,47,.90);color:#fff;font-size:13px;font-weight:850;cursor:pointer}.rona-approved-access-primary:hover{background:rgba(218,42,55,.96)}.rona-approved-access-primary:disabled{opacity:.5;cursor:wait}',
 '.rona-approved-access-status{font-size:11px;color:#9fb4c0;line-height:1.45}',
 '.ca-modal-backdrop{position:fixed;inset:0;z-index:2147483290;background:rgba(1,6,11,.80);display:grid;place-items:center;padding:20px;backdrop-filter:blur(9px)}',
 '.ca-modal{width:min(560px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px!important;display:grid;gap:12px;background:rgba(7,17,28,.99)!important;color:#f7fbff;border:1px solid rgba(160,203,224,.16)!important;border-radius:18px!important;box-shadow:0 24px 80px rgba(0,0,0,.34)}',
 '.ca-modal .ca-copy{font-size:12px;line-height:1.55;color:#b6c4d1}.ca-modal-actions{display:flex;justify-content:flex-end;gap:8px}.ca-modal .ca-primary,.ca-modal .ca-btn{font:inherit;color:inherit;border:1px solid rgba(89,215,255,.36);border-radius:10px;background:rgba(24,58,92,.58);padding:9px 12px;cursor:pointer;font-weight:800}.ca-modal .ca-primary{border-color:rgba(255,130,138,.48);background:rgba(202,34,47,.88)}',
 '@media(max-width:900px){.rona-approved-contract-grid,.rona-approved-access-grid2{grid-template-columns:1fr}.rona-approved-access-mask{padding:12px}.rona-approved-access-modal{width:100%;max-height:calc(100vh - 24px)}}'
 ].join('');document.head.append(s)
}

function canonicalNoticeModal(title){const back=el('div','ca-modal-backdrop'),box=el('section','rona-owner-card ca-modal');box.append(el('h2','',title));back.append(box);document.body.append(back);return{back,box}}
function notice(message,title='Клиенты и агенты'){
 ensureStyle();const m=canonicalNoticeModal(title),copy=el('div','ca-copy',message),actions=el('div','ca-modal-actions'),ok=el('button','ca-primary','Закрыть');ok.type='button';
 return new Promise(resolve=>{let closed=false;const close=()=>{if(closed)return;closed=true;m.back.remove();resolve()};ok.onclick=close;m.back.addEventListener('click',e=>{if(e.target===m.back)close()});actions.append(ok);m.box.append(copy,actions);queueMicrotask(()=>ok.focus())})
}
function confirmBox(message,title='Подтверждение'){
 ensureStyle();const m=canonicalNoticeModal(title),copy=el('div','ca-copy',message),actions=el('div','ca-modal-actions'),cancel=el('button','ca-btn','Отмена'),ok=el('button','ca-primary','Подтвердить');cancel.type=ok.type='button';
 return new Promise(resolve=>{let closed=false;const close=v=>{if(closed)return;closed=true;m.back.remove();resolve(v===true)};cancel.onclick=()=>close(false);ok.onclick=()=>close(true);m.back.addEventListener('click',e=>{if(e.target===m.back)close(false)});actions.append(cancel,ok);m.box.append(copy,actions);queueMicrotask(()=>ok.focus())})
}

async function json(url,opts={}){const init={credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},...opts};const r=await fetch(url,init),j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false){const e=new Error(txt(j?.code)||('HTTP_'+r.status));e.code=txt(j?.code)||'REQUEST_FAILED';e.status=r.status;e.payload=j;throw e}return j?.data??j}
const owner=path=>json('/portal/owner-api?path='+encodeURIComponent(path));
const auth=(path,opts={})=>json('/portal/admin-authority'+path,opts);

async function loadData(){
 const [b,a]=await Promise.all([owner('/admin/bootstrap').catch(()=>window.__RONA_OWNER_ADMIN_SNAPSHOT__||{}),auth('/bootstrap').catch(()=>window.__RONA_ADMIN_LIVE_SNAPSHOT__?.authority||{})]);
 state.business=b&&typeof b==='object'?b:{};state.authority=a&&typeof a==='object'?a:{};
 window.__RONA_OWNER_ADMIN_SNAPSHOT__=state.business;window.__RONA_ADMIN_LIVE_SNAPSHOT__={...(window.__RONA_ADMIN_LIVE_SNAPSHOT__||{}),authority:state.authority,at:new Date().toISOString()};return state
}
const clients=()=>{const b=state.business||{};return Array.isArray(b.clients)?b.clients:Array.isArray(b.companies)?b.companies:[]};
const agents=()=>{const a=state.business?.agents;return Array.isArray(a)?a:[]};
const contracts=()=>{const a=state.authority?.contracts;return Array.isArray(a)?a:[]};
const gates=()=>{const x=state.authority?.signedContractGate?.contracts;return Array.isArray(x)?x:[]};
const contractId=c=>txt(c?.contractId||c?.contract_id||c?.id);
const clientId=c=>txt(c?.clientId||c?.client_id||c?.companyId||c?.company_id);
function clientByIds(cid,id){return clients().find(x=>txt(x?.client_id||x?.clientId||x?.id)===cid||txt(x?.contract_id||x?.contractId)===id)||null}
function statusFor(id,c){
 const g=gates().find(x=>txt(x?.contractId||x?.contract_id||x?.id)===id)||{};
 let ready=false;try{if(typeof window.signedContractGateAllows==='function')ready=window.signedContractGateAllows(id)===true}catch(_){ }
 if(!ready)ready=(g?.bilateralSignedConfirmed===true&&g?.serverConfirmed!==false)||(c?.bilateralSignedConfirmed===true&&c?.serverConfirmed!==false)||(c?.signedContractConfirmed===true)||(c?.signed_contract_confirmed===true);
 const documentId=txt(g?.documentId||g?.signedDocumentId||g?.signed_document_id||c?.documentId||c?.signedDocumentId||c?.signed_document_id||c?.currentDocumentId||c?.current_document_id);
 const attached=ready||!!documentId||g?.documentAttached===true||g?.signedPdfAttached===true||c?.documentAttached===true||c?.signedPdfAttached===true;
 return{ready,attached,documentId,gate:g}
}
function companyRows(){
 const rows=[],seen=new Set();
 for(const c of contracts()){
  const id=contractId(c);if(!id||seen.has(id))continue;const status=txt(c?.contractStatus||c?.status).toUpperCase();if(['REVOKED','ARCHIVED','CANCELLED','EXPIRED'].includes(status))continue;
  const cid=clientId(c),cl=clientByIds(cid,id),st=statusFor(id,c);seen.add(id);rows.push({contract_id:id,client_id:cid||txt(cl?.client_id||cl?.clientId),external:txt(c?.currentExternalContractNumber||c?.externalContractNumber||c?.contractNumber||cl?.current_external_contract_number||cl?.contract_number||id),legal_name:txt(c?.companyName||c?.company_name||c?.clientName||c?.client_name||cl?.legal_name||cl?.company_name||cl?.name||cid||'Компания'),...st})
 }
 for(const cl of clients()){
  const id=txt(cl?.contract_id||cl?.contractId);if(!id||seen.has(id))continue;const st=statusFor(id,cl);seen.add(id);rows.push({contract_id:id,client_id:txt(cl?.client_id||cl?.clientId),external:txt(cl?.current_external_contract_number||cl?.contract_number||id),legal_name:txt(cl?.legal_name||cl?.company_name||cl?.name||cl?.client_id||'Компания'),...st})
 }
 return rows
}

async function backendCreate(payload){
 const b=window.__RONA_PORTAL_BACKEND__;if(b&&typeof b.createAccessUser==='function')return b.createAccessUser(payload);
 return auth('/access/users',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload)})
}
async function attachPdf(row,file){
 if(!row?.client_id||!row?.contract_id){const e=new Error('CONTRACT_CONTEXT_MISSING');e.code='CONTRACT_CONTEXT_MISSING';throw e}
 const attestation={type:'BILATERAL_SIGNED_CONTRACT_ATTESTATION',confirmed:true};
 const b=window.__RONA_PORTAL_BACKEND__;
 if(b&&typeof b.attachSignedContractToExistingContract==='function')return b.attachSignedContractToExistingContract({clientId:row.client_id,contractId:row.contract_id,signedContractFile:file,adminClaimsBilateralSigned:true,adminAttestation:attestation});
 const fd=new FormData();fd.set('clientId',row.client_id);fd.set('adminClaimsBilateralSigned','true');fd.set('adminAttestation',JSON.stringify(attestation));fd.set('file',file);
 return auth('/contracts/'+encodeURIComponent(row.contract_id)+'/signed-document/attach',{method:'POST',body:fd})
}
function errorText(code){const map={
 ADMIN_PASSWORD_CANCELLED:'Создание доступа отменено.',ADMIN_PASSWORD_MISMATCH:'Пароли не совпадают.',PASSWORD_POLICY_FAILED:'Пароль не соответствует требованиям безопасности.',INVALID_INITIAL_PASSWORD:'Пароль не соответствует требованиям безопасности.',LOGIN_ALREADY_EXISTS:'Такой логин уже существует.',SIGNED_CONTRACT_REQUIRED:'Для выбранной компании требуется подтверждённый PDF договора либо режим открытия без договора.',COMPANY_REQUIRED:'Выберите хотя бы одну компанию / контракт.',AGENT_PROFILE_NOT_FOUND:'Профиль агента не найден.',AGENT_PORTAL_USER_ALREADY_EXISTS:'Для этого агента уже существует активный доступ.',INVALID_EMAIL:'Проверьте электронную почту.',EXECUTIVE_SOURCE_CONTRACT_REQUIRED:'Контракт отсутствует в исходном договорном контуре.',SOURCE_CONTRACT_AMBIGUOUS:'Для компании найдено несколько исходных контрактов. Требуется конкретный Contract ID.',SIGNED_PDF_ALREADY_CONFIRMED:'Подписанный PDF уже подтверждён.',SIGNED_PDF_ALREADY_REGISTERED:'Подписанный PDF уже зарегистрирован.',PDF_REQUIRED:'Выберите PDF-файл.',PDF_SIZE_INVALID:'Размер PDF не соответствует требованиям.',PDF_TYPE_INVALID:'Разрешён только PDF-файл.',PDF_SIGNATURE_INVALID:'Файл не является корректным PDF.',BILATERAL_ATTESTATION_REQUIRED:'Не подтверждено двустороннее подписание договора.',STORAGE_UPLOAD_FAILED:'Не удалось сохранить PDF в защищённом хранилище.',CONTRACT_CONTEXT_MISSING:'Не удалось определить Client ID / Contract ID.',ACCESS_BACKEND_UNAVAILABLE:'Серверный контур управления доступом временно недоступен.'
 };return map[code]||('Операция не выполнена: '+code)}
function passwordOk(v){const x=String(v||'');return x.length>=10&&/[A-ZА-ЯЁ]/.test(x)&&/[a-zа-яё]/.test(x)&&/[0-9]/.test(x)&&/[^A-Za-zА-Яа-яЁё0-9\s]/.test(x)}
function removeCompeting(){qa('.ca-modal-backdrop,.rona-canonical-access-mask,.rona-approved-access-mask').forEach(n=>n.remove())}

function openCanonicalAccessModal(){
 ensureStyle();removeCompeting();state.selected.clear();
 const previous=document.activeElement,mask=el('div','rona-approved-access-mask'),modal=el('section','rona-approved-access-modal'),head=el('div','rona-approved-access-head'),copy=el('div'),close=el('button','rona-approved-access-close','×'),body=el('div','rona-approved-access-body');
 mask.dataset.ronaApprovedAccess='true';mask.dataset.ronaPasswordFields='ready';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Создать пользователя');
 copy.append(el('h2','','Создать пользователя'),el('p','','Открытие доступа в личный кабинет клиента или агента с контролем договорной привязки и PDF.'));close.type='button';close.setAttribute('aria-label','Закрыть');head.append(copy,close);modal.append(head,body);mask.append(modal);document.body.append(mask);
 let closed=false;const finish=()=>{if(closed)return;closed=true;mask.remove();document.removeEventListener('keydown',onKey,true);try{previous?.focus?.()}catch(_){}};close.onclick=finish;mask.addEventListener('mousedown',ev=>{if(ev.target===mask)finish()});const onKey=ev=>{if(ev.key==='Escape')finish()};document.addEventListener('keydown',onKey,true);

 const type=el('select'),bindingRole=el('select'),name=el('input'),login=el('input'),email=el('input'),phone=el('input'),password=el('input'),repeat=el('input'),agentSelect=el('select'),openWithout=el('input');
 type.append(new Option('Клиент','Клиент'),new Option('Агент','Агент'));['Уполномоченный представитель','Директор','Бухгалтер','Логистика'].forEach(x=>bindingRole.append(new Option(x,x)));
 name.placeholder='Ф.И.О. пользователя';login.placeholder='Единый логин';email.placeholder='Электронная почта';email.type='email';phone.placeholder='Телефон';phone.type='tel';password.type=repeat.type='password';password.autocomplete=repeat.autocomplete='new-password';password.placeholder='Пароль';repeat.placeholder='Повторите пароль';password.maxLength=repeat.maxLength=128;
 openWithout.type='checkbox';openWithout.id='ronaApprovedOpenWithout';
 const makeField=(caption,node)=>{const l=el('label','rona-approved-access-field');l.append(el('span','',caption),node);return l};
 const top=el('div','rona-approved-access-grid2');top.append(makeField('Тип доступа',type),makeField('Роль пользователя',bindingRole));body.append(top);
 const names=el('div','rona-approved-access-grid2 rona-approved-access-subsection');names.append(makeField('Ф.И.О. пользователя',name),makeField('Единый логин',login));body.append(names);
 const contacts=el('div','rona-approved-access-grid2 rona-approved-access-subsection');contacts.append(makeField('Электронная почта',email),makeField('Телефон',phone));body.append(contacts);
 const pw=el('div','rona-approved-access-grid2 rona-approved-access-subsection');pw.append(makeField('Пароль',password),makeField('Повторите пароль',repeat));body.append(pw,el('div','rona-approved-password-hint','Не менее 10 символов: заглавная и строчная буквы, цифра и специальный символ.'));

 const agentWrap=el('div','rona-approved-access-subsection'),agentNote=el('div','rona-approved-agent-note','Для агента создаётся доступ в кабинет агента. Выберите зарегистрированный профиль агента; договорная привязка клиента не требуется.');agentWrap.append(makeField('Профиль агента',agentSelect),agentNote);body.append(agentWrap);
 const contractSection=el('div','rona-approved-access-subsection'),contractTitle=el('div','rona-approved-access-label'),contractTitleText=el('span','','Разрешённые компании / контракты'),contractCount=el('span','','Загрузка…'),contractToolbar=el('div','rona-approved-contract-toolbar'),contractHint=el('span','','Для активного доступа к компании должен быть закреплён и подтверждён двусторонне подписанный PDF.'),reload=el('button','rona-approved-upload','Обновить договоры'),contractGrid=el('div','rona-approved-contract-grid'),summary=el('div','rona-approved-summary');reload.type='button';contractTitle.append(contractTitleText,contractCount);contractToolbar.append(contractHint,reload);contractSection.append(contractTitle,contractToolbar,contractGrid,summary);body.append(contractSection);
 const openWrap=el('div','rona-approved-note rona-approved-access-subsection'),openLabel=el('label');openLabel.append(openWithout,el('span','','Открыть учётную запись до подтверждения PDF — пользователь будет создан, но доступ к данным выбранной компании останется закрытым до закрепления и подтверждения договора.'));openWrap.append(openLabel);body.append(openWrap);
 const gateNote=el('div','rona-approved-note rona-approved-access-subsection','Доступ клиента активируется по Contract ID только после серверного подтверждения действующего двусторонне подписанного PDF. Пароль задаётся Администратором в этой форме. ИД пользователя создаётся серверным сервисом.');body.append(gateNote);
 const actions=el('div','rona-approved-access-actions'),statusLine=el('div','rona-approved-access-status','Заполните данные пользователя и выберите разрешённый контур.'),create=el('button','rona-approved-access-primary','Создать единую учётную запись');create.type='button';actions.append(statusLine,create);body.append(actions);

 function fillAgents(){agentSelect.replaceChildren(new Option('Выберите агента',''));for(const ag of agents()){const id=txt(ag?.agent_person_id||ag?.id),caption=txt(ag?.agent_name||ag?.display_name||ag?.full_name||id);if(id)agentSelect.append(new Option(caption,id))}}
 function syncSummary(rows){const selected=rows.filter(r=>state.selected.has(r.contract_id)),ready=selected.filter(r=>r.ready).length,pending=selected.length-ready;summary.replaceChildren(el('span','','Выбрано: '+selected.length),el('span','','PDF подтверждён: '+ready),el('span','','Без подтверждённого PDF: '+pending));statusLine.textContent=selected.length?('Выбрано контрактов: '+selected.length+(pending?' · ожидают PDF: '+pending:'')):'Выберите одну или несколько компаний / контрактов.'}
 async function choosePdf(row,button){
  const picker=el('input');picker.type='file';picker.accept='application/pdf,.pdf';picker.hidden=true;document.body.append(picker);
  picker.addEventListener('change',async()=>{const file=picker.files?.[0]||null;picker.remove();if(!file)return;if(file.type&&file.type!=='application/pdf')return notice('Разрешён только PDF-файл.','Проверка PDF');
   const ok=await confirmBox('Подтверждаете, что выбранный PDF является действующим двусторонне подписанным договором для «'+row.legal_name+'» и Contract ID '+row.contract_id+'?','Закрепление PDF');if(!ok)return;
   button.disabled=true;try{await attachPdf(row,file);await loadData();renderContracts();await notice('PDF договора закреплён. Серверный статус договора обновлён.','Договор обновлён')}catch(e){await notice(errorText(txt(e?.code||e?.message||'REQUEST_FAILED')),'Ошибка PDF')}finally{button.disabled=false}
  },{once:true});picker.click()
 }
 function renderContracts(){
  const rows=companyRows();contractGrid.replaceChildren();contractCount.textContent=rows.length+' контракт(ов)';
  for(const row of rows){
   const card=el('div','rona-approved-contract-card'),topLine=el('div','rona-approved-contract-top'),cb=el('input'),ct=el('div'),foot=el('div','rona-approved-contract-foot'),left=el('div'),right=el('div','rona-approved-contract-actions');cb.type='checkbox';cb.dataset.contractId=row.contract_id;cb.checked=state.selected.has(row.contract_id);
   cb.addEventListener('change',()=>{if(cb.checked)state.selected.add(row.contract_id);else state.selected.delete(row.contract_id);card.classList.toggle('is-selected',cb.checked);syncSummary(rows)});
   ct.append(el('div','rona-approved-contract-name',row.legal_name||row.client_id||'Компания'),el('div','rona-approved-contract-id',[row.client_id,row.external,row.contract_id].filter(Boolean).join(' · ')));topLine.append(cb,ct);
   const badge=el('span','rona-approved-state '+(row.ready?'ready':row.attached?'wait':'missing'),row.ready?'PDF подтверждён':row.attached?'PDF загружен · ожидает подтверждения':'PDF не закреплён');left.append(badge);
   if(!row.ready){const up=el('button','rona-approved-upload',row.attached?'Обновить PDF':'Закрепить PDF');up.type='button';up.onclick=ev=>{ev.preventDefault();ev.stopPropagation();void choosePdf(row,up)};right.append(up)}
   foot.append(left,right);card.append(topLine,foot);card.classList.toggle('is-selected',cb.checked);contractGrid.append(card)
  }
  if(!rows.length)contractGrid.append(el('div','rona-approved-note','Доступные компании / контракты не получены. Проверьте договорный контур и обновите список.'));
  syncSummary(rows)
 }
 async function refreshData(showError=true){reload.disabled=true;contractCount.textContent='Загрузка…';try{await loadData();fillAgents();renderContracts()}catch(e){contractGrid.replaceChildren(el('div','rona-approved-note','Не удалось получить договорный контур.'));if(showError)await notice(errorText(txt(e?.code||e?.message||'REQUEST_FAILED')),'Ошибка загрузки')}finally{reload.disabled=false}}
 function syncRole(){const isAgent=type.value==='Агент';agentWrap.hidden=!isAgent;contractSection.hidden=isAgent;openWrap.hidden=isAgent;gateNote.hidden=isAgent;bindingRole.disabled=isAgent;bindingRole.title=isAgent?'Для агента применяется профиль агента.':'';statusLine.textContent=isAgent?'Выберите профиль агента и задайте данные входа.':'Выберите одну или несколько компаний / контрактов.'}
 type.onchange=syncRole;reload.onclick=()=>void refreshData();email.addEventListener('blur',()=>{if(!login.value.trim()&&email.value.trim())login.value=email.value.trim()});syncRole();void refreshData(false);

 create.onclick=async()=>{
  const nm=name.value.trim(),lg=login.value.trim(),mail=email.value.trim(),ph=phone.value.trim(),pw1=password.value,pw2=repeat.value,isAgent=type.value==='Агент',scope=agentSelect.value.trim(),rows=companyRows(),ids=Array.from(state.selected);
  if(!nm||!lg)return notice('Укажите Ф.И.О. пользователя и единый логин.','Проверка');
  if(!mail)return notice('Укажите электронную почту пользователя.','Проверка');
  if(!pw1||!pw2)return notice('Укажите пароль и повторите его.','Проверка');
  if(pw1!==pw2)return notice('Пароли не совпадают.','Проверка');
  if(!passwordOk(pw1))return notice('Пароль должен содержать не менее 10 символов: заглавную и строчную буквы, цифру и специальный символ.','Проверка');
  if(isAgent&&!scope)return notice('Выберите профиль агента.','Проверка');
  if(!isAgent&&!ids.length)return notice('Выберите хотя бы одну компанию / контракт.','Проверка');
  const selectedRows=rows.filter(r=>state.selected.has(r.contract_id)),missing=selectedRows.filter(r=>!r.ready);if(!isAgent&&missing.length&&!openWithout.checked)return notice('У '+missing.length+' выбранных контракт(ов) нет подтверждённого PDF. Закрепите PDF либо включите режим открытия учётной записи до подтверждения договора.','Контроль договора');
  if(state.busy)return;state.busy=true;create.disabled=true;statusLine.textContent='Создание учётной записи…';
  try{
   const payload={name:nm,login:lg,email:mail,phone:ph,initialPassword:pw1,role:isAgent?'Агент':'Клиент',bindingRole:bindingRole.value||'Уполномоченный представитель',contractIds:isAgent?[]:ids,openWithoutContract:!isAgent&&openWithout.checked};if(isAgent)payload.agentScope=scope;
   const out=await backendCreate(payload);finish();const pending=Array.isArray(out?.pendingContractIds)?out.pendingContractIds:[];
   await notice(isAgent?'Доступ агента создан. Пользователь может входить в кабинет агента по заданным учётным данным.':pending.length?'Учётная запись клиента создана. Доступ по '+pending.length+' контракт(ам) останется закрытым до подтверждения PDF.':'Доступ клиента создан. Все выбранные договорные привязки подтверждены сервером.','Доступ создан');
   try{sessionStorage.setItem('rona.admin.currentPage','access')}catch(_){ }location.reload()
  }catch(e){await notice(errorText(txt(e?.code||e?.message||'REQUEST_FAILED')),'Ошибка создания доступа');statusLine.textContent='Учётная запись не создана. Исправьте указанные данные и повторите.'}finally{state.busy=false;create.disabled=false}
 };
 queueMicrotask(()=>name.focus())
}

function enforceOwner(){
 const page=q('#page-access');if(page){page.dataset.ronaAccessUiOwner='clients-agents-current-v4';page.dataset.ronaAccessCreateOwner='approved-canonical-v4.4.1';page.dataset.ronaAccessFunctionalBuild='create-user-contract-pdf-v5-20260828';qa('button',page).forEach(b=>{if(String(b.textContent||'').trim()==='Создать доступ')b.textContent='Создать пользователя'})}
 document.documentElement.dataset.ronaAccessOwner='clients-agents-current-v4';document.documentElement.dataset.ronaAccessCreateOwner='approved-canonical-v4.4.1';document.documentElement.dataset.ronaAccessFunctionalBuild='create-user-contract-pdf-v5-20260828';
 window.__RONA_ACCESS_CANONICAL_FORM__='RONA_Admin_LK_LOCAL_v4_4_1_Clients_Agents_Canonical_CreateAccess_Local.html';window.__RONA_ACCESS_CREATE_OWNER__='approved-canonical-v4.4.1'
}
window.addEventListener('click',ev=>{const button=ev.target?.closest?.('button');if(!button)return;const page=button.closest('#page-access'),marked=button.matches('[data-rona-create-access="primary"],[data-action="create-access"]'),named=page&&['Создать доступ','Создать пользователя'].includes(String(button.textContent||'').trim());if(!marked&&!named)return;ev.preventDefault();ev.stopImmediatePropagation();ev.stopPropagation();openCanonicalAccessModal()},true);
window.addEventListener('rona:admin-pagechange',ev=>{if(String(ev?.detail?.page||'')==='access'){enforceOwner();setTimeout(enforceOwner,80);setTimeout(enforceOwner,220)}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enforceOwner,{once:true});else enforceOwner();
})();`;

export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-access-canonical-source':'RONA_Admin_LK_LOCAL_v4_4_1_Clients_Agents_Canonical_CreateAccess_Local.html','x-rona-access-create-owner':'approved-canonical-v4.4.1','x-rona-access-workspace-owner':'clients-agents-current-v4','x-rona-access-notice-owner':'canonical-ca-modal','x-rona-access-functional-build':'create-user-contract-pdf-v5-20260828','x-rona-access-pdf-control':'attach-and-gate-v1'}})}