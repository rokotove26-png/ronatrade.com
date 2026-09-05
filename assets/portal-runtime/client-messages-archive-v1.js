(()=>{'use strict';
if(window.__RONA_CLIENT_MESSAGES_ARCHIVE_V1__)return;
window.__RONA_CLIENT_MESSAGES_ARCHIVE_V1__='20260903-client-messages-archive-current-context-v1';

const API='/portal/api';
const state={context:null,messages:[],archive:null,loadingMessages:false,loadingArchive:false,messagesKey:'',archiveKey:'',seq:0,renderQueued:false,observer:null,unsubscribe:null};
const norm=v=>String(v??'').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU').replaceAll('ё','е');
const contextKey=c=>`${c?.client_id||''}|${c?.contract_id||''}`;
const authority=()=>window.RONA_CLIENT_CONTEXT||null;
const dateText=value=>{if(!value)return '—';const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(d):norm(value)};

async function request(path,source,init={}){
  const headers={accept:'application/json','x-rona-client-source':source,...(init.headers||{})};
  const response=await fetch(API+path,{credentials:'same-origin',cache:'no-store',...init,headers});
  const body=await response.json().catch(()=>null);
  if(!response.ok||body?.ok===false)throw new Error(String(body?.code||body?.error?.code||('HTTP_'+response.status)));
  return body;
}
function status(text){const el=document.querySelector('#page-messages .asof');if(el&&el.textContent!==text)el.textContent=text}
function notify(text){if(typeof window.toast==='function')window.toast(text);else console.info('RONA client messages',text)}
function payload(row){return row&&typeof row.payload==='object'&&row.payload?row.payload:{}}
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined&&text!==null)el.textContent=String(text);return el}
function empty(title,text){const box=node('div','empty');box.append(node('strong','',title),node('p','',text));return box}
function row(main,sub,cell){const out=node('div','doc-row'),left=node('div','row-main');left.append(node('strong','',main),node('span','',sub||''));out.append(left,node('div','cell',cell||''));return out}
function messageSignature(){return [contextKey(state.context),...state.messages.map(item=>[item.event_id,item.updated_at,item.processing_state,item.acknowledgement_state,item.client_response_published_at].join(':'))].join('|')}
function archiveSignature(){const deals=Array.isArray(state.archive?.deals)?state.archive.deals:[];return [contextKey(state.context),...deals.map(deal=>[deal.deal_id,deal.contract_id,deal.business_status,deal.lifecycle_state,deal.closed_at,deal.updated_at].join(':'))].join('|')}
function messagesPanel(){return document.querySelector('#page-messages .message-grid > .panel')||document.querySelector('#page-messages .panel')}
function renderMessages(){
  const panel=messagesPanel();if(!panel)return false;const signature=messageSignature();if(panel.dataset.ronaMessagesSignature===signature)return true;
  panel.textContent='';const head=node('div','panel-head');head.append(node('strong','','Переписка'));panel.append(head);
  if(!state.messages.length)panel.append(empty('Сообщений пока нет','Здесь будут отображаться только фактически отправленные и полученные сообщения выбранной компании.'));
  else for(const item of state.messages){
    const p=payload(item),subject=norm(p.subject)||'Сообщение',message=norm(p.message)||'—';
    const processing=norm(item.processing_state),ack=norm(item.acknowledgement_state);
    const stage=item.client_response_published_at?'Ответ опубликован':ack==='REJECTED'?'Отклонено':processing==='APPLIED'?'Обработано':'Передано администратору';
    panel.append(row(subject,message,`${stage} · ${dateText(item.created_at)}`));
    if(norm(item.client_response_text))panel.append(row('Ответ RONA Trade',norm(item.client_response_text),dateText(item.client_response_published_at)));
  }
  panel.dataset.ronaMessagesSignature=signature;return true;
}
function renderArchive(){
  const page=document.getElementById('page-archive');if(!page)return false;const panel=page.querySelector('.panel');if(!panel)return false;
  const deals=Array.isArray(state.archive?.deals)?state.archive.deals:[],signature=archiveSignature();if(panel.dataset.ronaArchiveSignature===signature)return true;
  panel.textContent='';
  if(!deals.length)panel.append(empty('Закрытых сделок пока нет','После полного завершения сделки она появится в архиве.'));
  else for(const deal of deals){
    const statusText=norm(deal.business_status)||norm(deal.lifecycle_state)||'Завершена',contract=norm(deal.contract_id),closed=dateText(deal.closed_at||deal.updated_at);
    panel.append(row(norm(deal.deal_id)||'Сделка',contract?`Контракт ${contract}`:'',`${statusText} · ${closed}`));
  }
  panel.dataset.ronaArchiveSignature=signature;return true;
}
function render(){if(!state.context)return false;const a=renderMessages(),b=renderArchive();if(a&&state.messagesKey===contextKey(state.context))status('Административный канал активен');return a||b}
function scheduleRender(){if(state.renderQueued)return;state.renderQueued=true;requestAnimationFrame(()=>{state.renderQueued=false;render()})}
function query(next){return `?clientId=${encodeURIComponent(next.client_id)}&contractId=${encodeURIComponent(next.contract_id)}`}
async function loadMessages(next,{force=false}={}){
  const key=contextKey(next);if(!key||state.loadingMessages||(!force&&state.messagesKey===key))return;
  const seq=state.seq;state.loadingMessages=true;
  try{const body=await request('/v1/client/messages'+query(next),'client-messages-archive-v1:messages');if(seq!==state.seq||contextKey(state.context)!==key||contextKey(authority()?.getCurrentContext())!==key)return;state.messages=Array.isArray(body?.messages)?body.messages:[];state.messagesKey=key;renderMessages();status('Административный канал активен')}
  catch(error){if(seq===state.seq&&contextKey(state.context)===key){console.error('RONA client messages',error);status('Канал временно недоступен')}}finally{state.loadingMessages=false}
}
async function loadArchive(next,{force=false}={}){
  const key=contextKey(next);if(!key||state.loadingArchive||(!force&&state.archiveKey===key))return;
  const seq=state.seq;state.loadingArchive=true;
  try{const body=await request('/v1/client/archive'+query(next),'client-messages-archive-v1:archive');if(seq!==state.seq||contextKey(state.context)!==key||contextKey(authority()?.getCurrentContext())!==key)return;state.archive=body?.archive||null;state.archiveKey=key;renderArchive()}
  catch(error){if(seq===state.seq&&contextKey(state.context)===key)console.error('RONA client archive',error)}finally{state.loadingArchive=false}
}
function pageActive(id){const page=document.getElementById(id);if(!page)return false;return page.classList.contains('active')||page.getAttribute('aria-hidden')==='false'||(!page.hidden&&getComputedStyle(page).display!=='none')}
function lazyForActive(){const next=state.context||authority()?.getCurrentContext?.();if(!next)return;if(pageActive('page-messages'))loadMessages(next);if(pageActive('page-archive'))loadArchive(next)}
async function submit(){
  const next=state.context||authority()?.getCurrentContext();if(!next)return notify('Сначала выберите компанию и контракт.');
  const subject=norm(document.getElementById('msgSubject')?.value),message=norm(document.getElementById('msgText')?.value);if(!message)return notify('Введите сообщение.');
  const file=document.querySelector('#page-messages input[type="file"]');if(file?.files?.length)return notify('Вложения к сообщениям пока не подключены. Отправьте сообщение без файла.');
  const object=norm(document.getElementById('messageObject')?.value),match=object.match(/DEAL-\d{4}-\d{3,}/i);
  const body={clientId:next.client_id,contractId:next.contract_id,subject,message,idempotencyKey:crypto.randomUUID()};if(match)body.dealId=match[0].toUpperCase();status('Отправка…');
  try{
    await request('/v1/client/messages','client-messages-archive-v1:submit',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':body.idempotencyKey},body:JSON.stringify(body)});
    const subjectEl=document.getElementById('msgSubject'),messageEl=document.getElementById('msgText');if(subjectEl)subjectEl.value='';if(messageEl)messageEl.value='';
    notify('Сообщение передано администратору.');state.messagesKey='';await loadMessages(next,{force:true});
  }catch(error){console.error('RONA client message submit',error);status('Ошибка отправки');notify('Сообщение не отправлено. Повторите попытку.')}
}
function navTarget(event){const el=event.target?.closest?.('a,button,[role="tab"],[role="menuitem"],[data-page]');return low(el?.textContent)}
function click(event){const button=event.target?.closest?.('#sendMessage');if(button){event.preventDefault();event.stopImmediatePropagation();submit();return}const label=navTarget(event);if(label==='сообщения')queueMicrotask(()=>{scheduleRender();const next=state.context||authority()?.getCurrentContext?.();if(next)loadMessages(next)});else if(label==='архив')queueMicrotask(()=>{scheduleRender();const next=state.context||authority()?.getCurrentContext?.();if(next)loadArchive(next)})}
function observe(){if(state.observer||!document.body)return;state.observer=new MutationObserver(()=>scheduleRender());state.observer.observe(document.body,{childList:true,subtree:true})}
function reset(next){state.context=next||null;state.seq++;state.messages=[];state.archive=null;state.messagesKey='';state.archiveKey='';scheduleRender()}
function start(){
  const a=authority();if(!a){console.error('RONA client messages/archive: context authority unavailable');return}
  observe();document.addEventListener('click',click,true);
  state.unsubscribe=a.subscribe(next=>{if(contextKey(state.context)===contextKey(next)){scheduleRender();return}reset(next);queueMicrotask(lazyForActive)});
  const current=a.getCurrentContext?.();if(current)reset(current);else scheduleRender();queueMicrotask(lazyForActive);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else queueMicrotask(start);
window.addEventListener('pageshow',()=>{scheduleRender();queueMicrotask(lazyForActive)},{passive:true});
})();