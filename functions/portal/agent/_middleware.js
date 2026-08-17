// Final production activation: Agent runtime fixes are isolated from frozen canonical HTML.
const AGENT_LOGOUT_OWNERSHIP = `<script id="rona-agent-logout-ownership">window.__RONA_PORTAL_ROOT_LOGOUT__=true;<\/script>`;
const AGENT_RUNTIME = `<script id="rona-agent-production-actions">(()=>{'use strict';
if(window.__RONA_AGENT_PRODUCTION_ACTIONS__)return;
window.__RONA_AGENT_PRODUCTION_ACTIONS__=true;
let sending=false;
const notify=t=>{try{window.toast?.(t)}catch(_e){}};
function activateNav(raw){
  const p=String(raw||'');
  if(!p)return;
  try{window.RONA_SHOW_PAGE?.(p)}catch(_e){}
  const page=document.getElementById('page-'+p);
  if(page&&!page.classList.contains('active')){
    document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x===page));
    document.querySelectorAll('.nav button[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===p));
  }
}
function restoreHomeLabel(home){
  if(String(home.textContent||'').trim()!=='Выйти')return;
  const text=[...home.childNodes].find(n=>n.nodeType===3);
  if(text)text.nodeValue='⌂ На главную';
}
function prepare(){
  let logout=document.querySelector('#ronaLogout[data-rona-agent-logout="true"]');
  if(!logout){
    logout=document.createElement('button');
    logout.type='button';
    logout.id='ronaLogout';
    logout.className='rona-ux-navbtn rona-agent-logout';
    logout.dataset.ronaAgentLogout='true';
    logout.textContent='Выйти';
    logout.dataset.ronaControlStatus='FUNCTIONAL';
    document.body.appendChild(logout);
  }
  for(const home of document.querySelectorAll('.rona-go-home#ronaLogout')){
    if(home===logout)continue;
    home.removeAttribute('id');
    restoreHomeLabel(home);
  }
  if(logout.parentElement!==document.body)document.body.appendChild(logout);
  logout.textContent='Выйти';
  logout.dataset.ronaControlStatus='FUNCTIONAL';
  Object.assign(logout.style,{position:'fixed',top:'18px',right:'20px',zIndex:'2147483000',display:'block',visibility:'visible',opacity:'1',width:'auto',height:'auto',pointerEvents:'auto',margin:'0'});
  for(const b of document.querySelectorAll('#page-messages button')){
    if(String(b.textContent||'').trim()!=='Отправить')continue;
    b.removeAttribute('onclick');
    try{b.onclick=null}catch(_e){}
    b.dataset.ronaControlStatus='FUNCTIONAL';
  }
}
async function doLogout(){
  try{await fetch('/portal/auth/logout',{method:'POST',credentials:'same-origin',headers:{accept:'text/html'}})}catch(_e){}
  location.replace('/');
}
async function sendMessage(b){
  if(sending)return;
  const box=b.closest('#page-messages');
  const deal=String(box?.querySelector('select')?.value||'').trim();
  const subject=String(box?.querySelector('input')?.value||'').trim();
  const message=String(box?.querySelector('textarea')?.value||'').trim();
  if(!/^DEAL-\\d{4}-\\d{3,}$/.test(deal)||!subject||!message){notify('Заполните сделку, тему и сообщение.');return;}
  sending=true;
  b.disabled=true;
  try{
    const r=await fetch('/portal/api/v1/events',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','accept':'application/json','x-idempotency-key':'agent-message-'+deal+'-'+crypto.randomUUID()},body:JSON.stringify({role:'AGENT',event_type:'AGENT_MESSAGE_SUBMIT',authority_domain:'COMMUNICATION',authority_target_type:'DEAL',authority_target_id:deal,deal_id:deal,payload:{subject,message}})});
    let j={};
    try{j=await r.json()}catch(_e){}
    if(!r.ok||!j.ok)throw new Error(j.code||('HTTP_'+r.status));
    const input=box?.querySelector('input');
    const area=box?.querySelector('textarea');
    if(input)input.value='';
    if(area)area.value='';
    notify('Сообщение зарегистрировано сервером.');
  }catch(err){
    notify('Ошибка сервера: '+String(err?.message||err));
  }finally{
    sending=false;
    b.disabled=false;
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',prepare,{once:true});else queueMicrotask(prepare);
setTimeout(prepare,0);
setTimeout(prepare,50);
document.addEventListener('click',e=>{
  const nav=e.target?.closest?.('.nav button[data-page]');
  if(nav){e.preventDefault();e.stopImmediatePropagation();activateNav(nav.dataset.page);return;}
  const logout=e.target?.closest?.('#ronaLogout[data-rona-agent-logout="true"]');
  if(logout){e.preventDefault();e.stopImmediatePropagation();void doLogout();return;}
  const b=e.target?.closest?.('#page-messages button');
  if(!b||String(b.textContent||'').trim()!=='Отправить')return;
  e.preventDefault();
  e.stopImmediatePropagation();
  void sendMessage(b);
},true);
})();<\/script>`;

export async function onRequest(context){
  const response=await context.next();
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('text/html'))return response;
  let html=await response.text();
  if(!html.includes('rona-agent-logout-ownership')){
    const headClose=html.toLowerCase().lastIndexOf('</head>');
    html=headClose>=0?html.slice(0,headClose)+AGENT_LOGOUT_OWNERSHIP+html.slice(headClose):AGENT_LOGOUT_OWNERSHIP+html;
  }
  if(!html.includes('rona-agent-production-actions')){
    const bodyClose=html.toLowerCase().lastIndexOf('</body>');
    html=bodyClose>=0?html.slice(0,bodyClose)+AGENT_RUNTIME+html.slice(bodyClose):html+AGENT_RUNTIME;
  }
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}