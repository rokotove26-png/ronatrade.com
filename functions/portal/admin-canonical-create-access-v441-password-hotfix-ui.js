const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_CANONICAL_CREATE_ACCESS_V441_PASSWORD_HOTFIX__)return;
window.__RONA_CANONICAL_CREATE_ACCESS_V441_PASSWORD_HOTFIX__='admin-entered-password-v1';
if(location.pathname!=='/portal/admin')return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};

function ensureStyle(){
  if(q('#ronaCanonicalCreateAccessPasswordHotfixStyle'))return;
  const s=el('style');s.id='ronaCanonicalCreateAccessPasswordHotfixStyle';s.textContent=[
    '.rona-approved-access-password-hint{margin-top:8px;font-size:12px;line-height:1.45;color:#9fb4c0}',
    '.rona-approved-access-password-hint strong{color:#dce9f1}',
    '.rona-approved-access-field input[type=password]{letter-spacing:.03em}'
  ].join('');document.head.append(s)
}

function notice(message,title='Проверка'){
  const back=el('div','ca-modal-backdrop'),box=el('section','rona-owner-card ca-modal'),copy=el('div','ca-copy',message),actions=el('div','ca-modal-actions'),ok=el('button','ca-primary','Закрыть');
  box.append(el('h2','',title),copy);ok.type='button';actions.append(ok);box.append(actions);back.append(box);document.body.append(back);
  return new Promise(resolve=>{let closed=false;const close=()=>{if(closed)return;closed=true;back.remove();resolve()};ok.onclick=close;back.addEventListener('click',e=>{if(e.target===back)close()});queueMicrotask(()=>ok.focus())})
}

function passwordPolicy(value){
  const v=String(value||'');
  return v.length>=10&&/[A-ZА-ЯЁ]/.test(v)&&/[a-zа-яё]/.test(v)&&/[0-9]/.test(v)&&/[^A-Za-zА-Яа-яЁё0-9\s]/.test(v)
}

function field(caption,input){const l=el('label','rona-approved-access-field');l.append(el('span','',caption),input);return l}

function injectPasswordFields(mask){
  if(!mask||mask.dataset.ronaPasswordFields==='ready')return;
  const modal=q('.rona-approved-access-modal',mask);if(!modal)return;
  ensureStyle();
  const body=q('.rona-approved-access-body',modal);if(!body)return;
  const allFields=qa('.rona-approved-access-field',body),emailField=allFields.find(x=>String(q('span',x)?.textContent||'').trim()==='Электронная почта');
  const contacts=emailField?.parentElement;if(!contacts)return;

  const password=el('input'),repeat=el('input');
  password.type=repeat.type='password';password.autocomplete=repeat.autocomplete='new-password';password.maxLength=repeat.maxLength=128;
  password.id='ronaApprovedInitialPassword';repeat.id='ronaApprovedInitialPasswordRepeat';
  password.placeholder='Пароль';repeat.placeholder='Повторите пароль';
  const grid=el('div','rona-approved-access-grid2 rona-approved-access-subsection');grid.dataset.ronaPasswordGrid='true';grid.append(field('Пароль',password),field('Повторите пароль',repeat));
  const hint=el('div','rona-approved-access-password-hint','Не менее 10 символов: заглавная и строчная буквы, цифра и специальный символ.');hint.dataset.ronaPasswordHint='true';
  contacts.insertAdjacentElement('afterend',grid);grid.insertAdjacentElement('afterend',hint);

  const gate=qa('.rona-approved-note',body).find(x=>String(x.textContent||'').includes('Пароль и ИД пользователя создаются серверным сервисом.'));
  if(gate)gate.textContent='Новая пользовательская связь активируется по Contract ID только после серверного подтверждения действующего двусторонне подписанного PDF. Пароль устанавливается Администратором в этой форме; ИД пользователя создаётся серверным сервисом.';

  const create=qa('button',body).find(x=>String(x.textContent||'').trim()==='Создать единую учётную запись');
  if(create&&typeof create.onclick==='function'&&!create.__ronaPasswordSubmitWrapped){
    const original=create.onclick;
    Object.defineProperty(create,'__ronaPasswordSubmitWrapped',{value:true});
    create.onclick=async function(event){
      const pw=String(password.value||''),pw2=String(repeat.value||'');
      if(!pw||!pw2)return notice('Укажите пароль и повторите его.','Проверка');
      if(pw!==pw2)return notice('Пароли не совпадают.','Проверка');
      if(!passwordPolicy(pw))return notice('Пароль должен содержать не менее 10 символов: заглавную и строчную буквы, цифру и специальный символ.','Проверка');
      const backend=window.__RONA_PORTAL_BACKEND__;
      if(!backend||typeof backend.createAccessUser!=='function')return original.call(this,event);
      const wrapper=Object.freeze({...backend,createAccessUser:req=>backend.createAccessUser({...req,initialPassword:pw})});
      window.__RONA_PORTAL_BACKEND__=wrapper;
      try{return await original.call(this,event)}finally{if(window.__RONA_PORTAL_BACKEND__===wrapper)window.__RONA_PORTAL_BACKEND__=backend}
    }
  }
  mask.dataset.ronaPasswordFields='ready';
  document.documentElement.dataset.ronaAccessPasswordOwner='admin-entered-v1';
  window.__RONA_ACCESS_PASSWORD_OWNER__='admin-entered-v1'
}

function scan(){qa('.rona-approved-access-mask').forEach(injectPasswordFields)}
const observer=new MutationObserver(scan);observer.observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='access')queueMicrotask(scan)});
})();`;

export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-access-password-owner':'admin-entered-v1','x-rona-access-password-fields':'password-repeat-password','x-rona-access-password-submit':'initialPassword'}})}