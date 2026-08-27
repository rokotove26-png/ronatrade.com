const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_ADMIN_APPROVED_POLISH__)return;
window.__RONA_ADMIN_APPROVED_POLISH__='20260828-polish-no-access-owner-v5';
if(location.pathname!=='/portal/admin')return;

const q=(s,r=document)=>r.querySelector(s);
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
    const make=title=>{const l=el('label','rona-admin-dialog-field'),s=el('span','',title),i=el('input');i.type='password';i.autocomplete='new-password';l.append(s,i);fields.append(l);return i},p1=make('Пароль'),p2=make('Повторите пароль');
    cancel.type=ok.type='button';ok.dataset.primary='true';const fail=t=>{err.textContent=t;p1.focus()};const submit=()=>{const x=String(p1.value||''),y=String(p2.value||'');if(x!==y)return fail('Пароли не совпадают.');if(x.length<10||!/[A-ZА-ЯЁ]/.test(x)||!/[a-zа-яё]/.test(x)||!/[0-9]/.test(x)||!(/[^A-Za-zА-Яа-яЁё0-9]/.test(x)))return fail('Пароль не соответствует требованиям безопасности.');f.close();resolve(x)};cancel.onclick=()=>{f.close();reject(dialogError('ADMIN_PASSWORD_CANCELLED'))};ok.onclick=submit;for(const i of [p1,p2])i.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();submit()}});f.card.append(fields,hint,err,a);a.append(cancel,ok);queueMicrotask(()=>p1.focus())}))}
  window.RONA_ADMIN_DIALOGS=Object.freeze({message,notify:message,confirm,password});
  window.__RONA_ADMIN_DIALOGS_OWNER__='approved-polish-dialog-service-v1';
}

window.addEventListener('rona:admin-pagechange',ev=>{const page=String(ev?.detail?.page||'');if(page==='claims')ensureStyle();if(page==='messages')enforceRadioSingleOwner()});
ensureStyle();installDialogs();installRadioSingleOwner();
window.__RONA_ADMIN_APPROVED_POLISH_READY__=true;
})();`;

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-admin-polish':'no-access-owner-v5',
    'x-rona-access-create-owner':'none',
    'x-rona-shell-mutation':'claims-layout-radio-dialog-service'
  }});
}
