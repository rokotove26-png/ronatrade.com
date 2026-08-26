(()=>{'use strict';
if(window.__RONA_ADMIN_FOUR_SECTIONS_RECOVERY__)return;
window.__RONA_ADMIN_FOUR_SECTIONS_RECOVERY__='20260826-v1';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* The former Agent CP owner-gate RPC was deliberately retired when the standard
   Agent price-list flow became canonical. Prices must not fail because that
   optional historical projection is absent. */
if(!window.__RONA_PRICE_CP_RETIRED_FETCH_BRIDGE__){
  window.__RONA_PRICE_CP_RETIRED_FETCH_BRIDGE__='standard-agent-price-list-v1';
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const response=await nativeFetch(input,init);
    try{
      const raw=typeof input==='string'?input:(input instanceof URL?input.href:(input&&typeof input.url==='string'?input.url:''));
      const url=new URL(raw||'',location.href);
      if(url.pathname==='/portal/price-updates-api'&&url.searchParams.get('op')==='cp-bootstrap'&&!response.ok){
        const probe=await response.clone().text().catch(()=>'');
        if(/owner_agent_cp_owner_gate_bootstrap|PGRST202|schema cache|ROUTE_NOT_ALLOWED/i.test(probe)){
          window.__RONA_AGENT_CP_OWNER_GATE_RETIRED__=true;
          return new Response(JSON.stringify({ok:true,data:{generatedAt:new Date().toISOString(),flowState:'RETIRED_STANDARD_AGENT_PRICE_LIST',currentPublicationId:null,ownerReviewProposals:[],commercialProposals:[]}}),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-rona-agent-cp-flow':'retired-standard-agent-price-list'}});
        }
      }
    }catch(_){ }
    return response;
  };
}

function loadScript(src,id,ready){
  if(ready?.())return Promise.resolve(true);
  const prior=document.getElementById(id);if(prior){if(prior.dataset.loaded==='1')return Promise.resolve(true);prior.remove()}
  return new Promise((resolve,reject)=>{const s=document.createElement('script');s.id=id;s.src=src+(src.includes('?')?'&':'?')+'recovery=20260826v1';s.async=false;s.onload=()=>{s.dataset.loaded='1';resolve(true)};s.onerror=()=>{s.remove();reject(new Error('SCRIPT_LOAD_FAILED:'+id))};document.body.append(s)});
}
function loadStableRail(){return loadScript('/portal/rail-current-stable-ui','rona-rail-current-stable-recovery',()=>!!window.__RONA_RAIL_CURRENT_STATE__).catch(e=>{window.__RONA_RAIL_STABLE_ERROR__=String(e.message||e);return false})}
function loadCanonicalAnalytics(){return loadScript('/portal/analytics-v2-ui','rona-analytics-approved-recovery',()=>window.__RONA_ANALYTICS_V2_READY__===true).catch(e=>{window.__RONA_ANALYTICS_APPROVED_ERROR__=String(e.message||e);return false})}

function ensureStyle(){if(q('#ronaAccessFullCurrentStyle'))return;const s=el('style');s.id='ronaAccessFullCurrentStyle';s.textContent=[
'.rona-access-full-mask{position:fixed;inset:0;z-index:2147483300;display:grid;place-items:center;padding:24px;background:rgba(1,6,11,.82);backdrop-filter:blur(10px)}',
'.rona-access-full{width:min(920px,100%);max-height:calc(100vh - 48px);overflow:auto;padding:24px;border:1px solid rgba(123,191,225,.24);border-radius:18px;background:linear-gradient(180deg,rgba(7,18,30,.995),rgba(5,13,23,.995));box-shadow:0 30px 100px rgba(0,0,0,.58);color:#eef7fc}',
'.rona-access-full-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px}.rona-access-full-head h2{margin:0;font-size:24px}.rona-access-full-head p{margin:6px 0 0;color:#9cb2c1;font-size:13px;line-height:1.5}',
'.rona-access-full-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rona-access-full label{display:grid;gap:6px;font-size:12px;font-weight:750;color:#b9cad5}.rona-access-full input,.rona-access-full select{width:100%;min-height:44px;border:1px solid rgba(145,190,214,.22);border-radius:11px;background:rgba(4,11,19,.76);color:#f1f8fc;padding:9px 11px;outline:none}.rona-access-full select option{background:#0b1723;color:#fff}',
'.rona-access-full-section{margin-top:16px;padding:15px;border:1px solid rgba(145,190,214,.14);border-radius:14px;background:rgba(255,255,255,.025)}.rona-access-full-section h3{margin:0 0 10px;font-size:14px}.rona-access-contracts{display:grid;gap:8px}.rona-access-contract{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 11px;border:1px solid rgba(145,190,214,.13);border-radius:11px;background:rgba(4,11,18,.55)}.rona-access-contract-main{display:flex;gap:10px;align-items:flex-start}.rona-access-contract-main input{width:18px;min-height:18px;margin-top:2px}.rona-access-contract-name{font-size:13px;font-weight:800}.rona-access-contract-meta{margin-top:3px;color:#8fa6b7;font-size:11px;line-height:1.4}',
'.rona-access-status{display:inline-flex;margin-left:7px;padding:3px 7px;border-radius:999px;border:1px solid rgba(145,190,214,.18);font-size:10px}.rona-access-status.ok{color:#5ee2b6;border-color:rgba(94,226,182,.3)}.rona-access-status.warn{color:#ffc870;border-color:rgba(255,200,112,.3)}',
'.rona-access-full-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.rona-access-full button{min-height:40px;padding:0 14px;border:1px solid rgba(145,190,214,.22);border-radius:10px;background:rgba(7,20,32,.82);color:#f5fbff;font:inherit;font-weight:800;cursor:pointer}.rona-access-full button.primary{border-color:rgba(89,215,255,.46);background:linear-gradient(135deg,rgba(36,112,158,.82),rgba(25,70,117,.86))}.rona-access-full button:disabled{opacity:.5;cursor:wait}.rona-access-open-without{display:flex!important;grid-template-columns:auto 1fr!important;gap:9px!important;align-items:flex-start!important;margin-top:12px;padding:10px;border:1px solid rgba(245,158,11,.23);border-radius:10px;background:rgba(245,158,11,.055);font-weight:600!important;line-height:1.45}.rona-access-open-without input{width:18px;min-height:18px;margin-top:1px}.rona-access-full-error{margin-top:12px;padding:10px 12px;border:1px solid rgba(239,68,68,.3);border-radius:10px;background:rgba(239,68,68,.07);color:#ffd1d5;font-size:12px;line-height:1.45}.rona-access-full-note{color:#91a9b9;font-size:11px;line-height:1.5}',
'@media(max-width:760px){.rona-access-full-mask{padding:10px}.rona-access-full{padding:16px}.rona-access-full-grid{grid-template-columns:1fr}.rona-access-contract{grid-template-columns:1fr}.rona-access-full-actions{display:grid}.rona-access-full-actions button{width:100%}}'
].join('');document.head.append(s)}
function authority(){return window.__RONA_ADMIN_LIVE_SNAPSHOT__?.authority||{}}
function owner(){return window.__RONA_OWNER_ADMIN_SNAPSHOT__||{}}
function readiness(){return window.__RONA_ADMIN_LIVE_SNAPSHOT__?.agentAccessReadiness||{}}
function activeContracts(){return (Array.isArray(authority().contracts)?authority().contracts:[]).filter(x=>!['REVOKED','ARCHIVED','CANCELLED','EXPIRED'].includes(String(x.contractStatus||x.status||'').toUpperCase()))}
function gateProfiles(){return Array.isArray(authority()?.signedContractGate?.contracts)?authority().signedContractGate.contracts:[]}
function contractId(c){return String(c.contractId||c.id||'')}
function clientId(c){return String(c.clientId||c.client_id||'')}
function contractLabel(c){return String(c.legalName||c.company||c.clientName||c.client_name||clientId(c)||'Компания')+' · '+String(c.currentExternalContractNumber||c.externalContractNumber||c.contractNumber||contractId(c)||'Договор')}
function contractReady(c){const id=contractId(c),g=gateProfiles().find(x=>String(x.contractId||'')===id);if(g)return g.bilateralSignedConfirmed===true&&g.serverConfirmed!==false;return c.bilateralSignedConfirmed===true||!!c.signedContractDocumentId||!!c.signed_document_id}
function agentProfiles(){const p=Array.isArray(readiness().profiles)?readiness().profiles:[];if(p.length)return p;return (Array.isArray(owner().agents)?owner().agents:[]).map(a=>({agentPersonId:a.agent_person_id||a.id,displayAlias:a.agent_name||a.display_name||a.full_name}))}
function message(text,title='Управление доступом'){if(window.RONA_ADMIN_DIALOGS?.message)return window.RONA_ADMIN_DIALOGS.message(String(text),{title});return Promise.resolve(window.alert(String(text)))}
async function confirmAction(text,title='Подтверждение'){if(window.RONA_ADMIN_DIALOGS?.confirm)return window.RONA_ADMIN_DIALOGS.confirm(String(text),{title,confirmLabel:'Подтвердить',cancelLabel:'Отмена'});return window.confirm(String(text))}
async function refreshAuthority(){if(typeof window.__RONA_ADMIN_REFRESH_AUTHORITY__==='function')await window.__RONA_ADMIN_REFRESH_AUTHORITY__();}
function refreshAccessView(){setTimeout(()=>{const b=qa('#page-access button').find(x=>norm(x.textContent)==='обновить');if(b)b.click()},80)}

function openFullAccessModal(){
  if(q('.rona-access-full-mask'))return;ensureStyle();
  const mask=el('div','rona-access-full-mask'),box=el('section','rona-access-full'),head=el('div','rona-access-full-head'),copy=el('div');
  copy.append(el('h2','','Создать доступ'),el('p','','Полный текущий workflow: клиент или агент, отдельный логин и e-mail, договорная привязка, проверка подписанного договора и режим открытия без контракта.'));
  const closeTop=el('button','','Закрыть');closeTop.type='button';head.append(copy,closeTop);box.append(head);
  const form=el('div','rona-access-full-grid'),type=el('select'),name=el('input'),login=el('input'),email=el('input'),phone=el('input'),binding=el('input');
  type.append(new Option('Клиент','Клиент'),new Option('Агент','Агент'));name.placeholder='Ф.И.О.';login.placeholder='Единый логин';email.type='email';email.placeholder='name@company.com';phone.type='tel';phone.placeholder='+...';binding.value='Уполномоченный представитель';
  const field=(title,input)=>{const l=el('label');l.append(el('span','',title),input);return l};
  form.append(field('Тип доступа',type),field('Ф.И.О.',name),field('Единый логин',login),field('Электронная почта',email),field('Телефон',phone),field('Роль привязки',binding));box.append(form);
  const clientSection=el('section','rona-access-full-section'),clientTitle=el('h3','','Компании и договоры клиента'),contractsBox=el('div','rona-access-contracts'),openWithout=el('input');openWithout.type='checkbox';const withoutLabel=el('label','rona-access-open-without');withoutLabel.append(openWithout,el('span','','Открыть без контракта — учётная запись создаётся, но доступ к данным выбранной компании остаётся закрытым до загрузки и подтверждения действующего двусторонне подписанного договора.'));clientSection.append(clientTitle,contractsBox,withoutLabel,el('div','rona-access-full-note','Неподтверждённый договор можно загрузить непосредственно здесь. После серверного подтверждения его можно сразу использовать для создания доступа.'));
  const agentSection=el('section','rona-access-full-section'),agentTitle=el('h3','','Профиль агента'),agentSelect=el('select');agentSelect.append(new Option('Выберите профиль агента',''));agentSection.append(agentTitle,field('Агент',agentSelect));agentSection.hidden=true;box.append(clientSection,agentSection);
  const error=el('div','rona-access-full-error');error.hidden=true;box.append(error);
  const actions=el('div','rona-access-full-actions'),cancel=el('button','','Отмена'),save=el('button','primary','Создать доступ');cancel.type=save.type='button';actions.append(cancel,save);box.append(actions);mask.append(box);document.body.append(mask);
  const close=()=>mask.remove();closeTop.onclick=cancel.onclick=close;mask.addEventListener('click',e=>{if(e.target===mask)close()});
  const showError=t=>{error.textContent=String(t);error.hidden=false};
  function populateAgents(){const cur=agentSelect.value;agentSelect.replaceChildren(new Option('Выберите профиль агента',''));for(const a of agentProfiles()){const id=String(a.agentPersonId||a.agent_person_id||a.id||'');if(id)agentSelect.append(new Option(a.displayAlias||a.fullName||a.agentName||a.agent_name||id,id))}if(cur)agentSelect.value=cur}
  function renderContracts(){const selected=new Set(qa('input[type=checkbox][data-contract-id]',contractsBox).filter(x=>x.checked).map(x=>x.dataset.contractId));contractsBox.replaceChildren();const cs=activeContracts();if(!cs.length){contractsBox.append(el('div','rona-access-full-note','Действующие договоры в серверном контуре не найдены.'));return}for(const c of cs){const id=contractId(c),row=el('div','rona-access-contract'),main=el('div','rona-access-contract-main'),check=el('input');check.type='checkbox';check.dataset.contractId=id;check.checked=selected.has(id);const text=el('div'),title=el('div','rona-access-contract-name',contractLabel(c)),meta=el('div','rona-access-contract-meta','Client ID: '+(clientId(c)||'—')+' · Contract ID: '+(id||'—')),status=el('span','rona-access-status '+(contractReady(c)?'ok':'warn'),contractReady(c)?'Договор подтверждён':'Требуется договор');title.append(status);text.append(title,meta);main.append(check,text);row.append(main);if(!contractReady(c)){const upload=el('button','','Загрузить договор');upload.type='button';upload.dataset.ronaUploadContract=id;upload.onclick=async()=>{const picker=document.createElement('input');picker.type='file';picker.accept='application/pdf,.pdf';picker.hidden=true;document.body.append(picker);picker.onchange=async()=>{const file=picker.files?.[0];picker.remove();if(!file)return;const ok=await confirmAction('Подтверждаете, что выбранный PDF является действующим двусторонне подписанным договором для этой компании?','Подтверждение договора');if(!ok)return;const backend=window.__RONA_PORTAL_BACKEND__;if(!backend?.attachSignedContractToExistingContract){showError('Серверный контур загрузки договора не подключён.');return}upload.disabled=true;try{await backend.attachSignedContractToExistingContract({clientId:clientId(c),contractId:id,signedContractFile:file,adminClaimsBilateralSigned:true,adminAttestation:{type:'BILATERAL_SIGNED_CONTRACT_ATTESTATION',confirmed:true}});await refreshAuthority();renderContracts();await message('Подписанный договор загружен и подтверждён сервером.','Договор подтверждён')}catch(e){showError(String(e?.code||e?.message||'CONTRACT_UPLOAD_FAILED'))}finally{upload.disabled=false}};picker.click()};row.append(upload)}contractsBox.append(row)}}
  populateAgents();renderContracts();
  type.onchange=()=>{const isAgent=type.value==='Агент';clientSection.hidden=isAgent;agentSection.hidden=!isAgent;error.hidden=true};
  save.onclick=async()=>{error.hidden=true;const nm=name.value.trim(),lg=login.value.trim(),mail=email.value.trim(),role=type.value,br=binding.value.trim()||'Уполномоченный представитель';if(!nm||!lg||!mail){showError('Укажите Ф.И.О., единый логин и электронную почту.');return}const backend=window.__RONA_PORTAL_BACKEND__;if(!backend?.createAccessUser){showError('Серверный контур управления доступом не подключён.');return}const isAgent=role==='Агент';let payload={name:nm,login:lg,email:mail,phone:phone.value.trim(),role,bindingRole:br,contractIds:[]};if(isAgent){const agentScope=agentSelect.value.trim();if(!agentScope){showError('Выберите профиль агента.');return}payload.agentScope=agentScope}else{const checked=qa('input[type=checkbox][data-contract-id]:checked',contractsBox),ids=checked.map(x=>x.dataset.contractId).filter(Boolean);if(!ids.length){showError('Выберите хотя бы одну компанию / договор.');return}const map=new Map(activeContracts().map(c=>[contractId(c),c])),missing=ids.filter(id=>!contractReady(map.get(id)||{}));if(missing.length&&!openWithout.checked){showError('Для выбранной компании нет подтверждённого договора. Загрузите договор либо включите «Открыть без контракта».');return}payload.contractIds=ids;payload.openWithoutContract=openWithout.checked===true}
    save.disabled=true;try{const out=await backend.createAccessUser(payload);close();await refreshAuthority();refreshAccessView();const pending=Array.isArray(out?.pendingContractIds)?out.pendingContractIds:[];await message(isAgent?'Доступ агента создан и подтверждён сервером.':pending.length?'Учётная запись создана. Доступ к части компаний ожидает подтверждения договора.':'Доступ клиента создан и подтверждён сервером.','Доступ создан')}catch(e){const code=String(e?.code||e?.message||'REQUEST_FAILED'),map={PASSWORD_POLICY_FAILED:'Пароль не соответствует требованиям безопасности.',INVALID_INITIAL_PASSWORD:'Пароль не соответствует требованиям безопасности.',LOGIN_ALREADY_EXISTS:'Такой логин уже существует.',SIGNED_CONTRACT_REQUIRED:'Сначала загрузите договор либо выберите «Открыть без контракта».',EXECUTIVE_SOURCE_CONTRACT_REQUIRED:'Контракт ещё не зарегистрирован Исполнительным директором.',AGENT_PROFILE_NOT_FOUND:'Профиль агента не найден.',AGENT_PORTAL_USER_ALREADY_EXISTS:'Для этого агента уже существует активный доступ.',INVALID_EMAIL:'Проверьте электронную почту.',ADMIN_PASSWORD_CANCELLED:'Создание доступа отменено.'};showError(map[code]||('Операция не выполнена: '+code))}finally{save.disabled=false}}
  name.focus();
}
window.__RONA_OPEN_FULL_ACCESS_MODAL__=openFullAccessModal;

document.addEventListener('click',event=>{
  const b=event.target?.closest?.('#page-access button');if(!b)return;const text=norm(b.textContent),isCreate=b.matches('[data-rona-create-access="primary"],[data-action="create-access"]')||text==='создать доступ'||text==='создать пользователя';if(!isCreate)return;event.preventDefault();event.stopImmediatePropagation();openFullAccessModal();
},true);

document.addEventListener('click',event=>{const b=event.target?.closest?.('#nav button[data-page]');if(!b)return;if(b.dataset.page==='monitoring'){loadStableRail();setTimeout(loadStableRail,500)}if(b.dataset.page==='analytics'){loadCanonicalAnalytics();setTimeout(loadCanonicalAnalytics,500)}},true);
window.addEventListener('rona:admin-pagechange',event=>{const p=String(event?.detail?.page||'');if(p==='monitoring')loadStableRail();if(p==='analytics')loadCanonicalAnalytics()});

/* Load the canonical owners early so late optional runtimes cannot become the visible owner. */
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{loadStableRail();loadCanonicalAnalytics()},{once:true});else{loadStableRail();loadCanonicalAnalytics()}
})();