(()=>{'use strict';
if(window.__RONA_CLIENT_MESSAGES_ARCHIVE_V1__)return;
window.__RONA_CLIENT_MESSAGES_ARCHIVE_V1__='20260903-client-messages-archive-current-context-v1';

const API='/portal/api';
const state={context:null,messages:[],archive:null,loading:false,seq:0,renderQueued:false,observer:null,unsubscribe:null};
const norm=v=>String(v??'').trim();
const contextKey=c=>`${c?.client_id||''}|${c?.contract_id||''}`;
const authority=()=>window.RONA_CLIENT_CONTEXT||null;
const dateText=value=>{if(!value)return '—';const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(d):norm(value)};

async function request(path,init={}){
  const headers={accept:'application/json',...(init.headers||{})};
  const response=await fetch(API+path,{credentials:'same-origin',cache:'no-store',...init,headers});
  const body=await response.json().catch(()=>null);
  if(!response.ok||body?.ok===false)throw new Error(String(body?.code||body?.error?.code||('HTTP_'+response.status)));
  return body;
}
function status(text){const el=document.querySelector('#page-messages .asof');if(el)el.textContent=text}
function notify(text){if(typeof window.toast==='function')window.toast(text);else console.info('RONA client messages',text)}
function payload(row){return row&&typeof row.payload==='object'&&row.payload?row.payload:{}}
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined&&text!==null)el.textContent=String(text);return el}
function empty(title,text){const box=node('div','empty');box.append(node('strong','',title),node('p','',text));return box}
function row(main,sub,cell){const out=node('div','doc-row'),left=node('div','row-main');left.append(node('strong','',main),node('span','',sub||''));out.append(left,node('div','cell',cell||''));return out}

function messagesPanel(){return document.querySelector('#page-messages .message-grid > .panel')||document.querySelector('#page-messages .panel')}
function renderMessages(){
  const panel=messagesPanel();if(!panel)return false;
  panel.textContent='';const head=node('div','panel-head');head.append(node('strong','','Переписка'));panel.append(head);
  if(!state.messages.length){panel.append(empty('Сообщений пока нет','Здесь будут отображаться только фактически отправленные и полученные сообщения выбранной компании.'));return true}
  for(const item of state.messages){
    const p=payload(item),subject=norm(p.subject)||'Сообщение',message=norm(p.message)||'—';
    const processing=norm(item.processing_state),ack=norm(item.acknowledgement_state);
    const stage=item.client_response_published_at?'Ответ опубликован':ack==='REJECTED'?'Отклонено':processing==='APPLIED'?'Обработано':'Передано администратору';
    panel.append(row(subject,message,`${stage} · ${dateText(item.created_at)}`));
    if(norm(item.client_response_text))panel.append(row('Ответ RONA Trade',norm(item.client_response_text),dateText(item.client_response_published_at)));
  }
  return true;
}
function renderArchive(){
  const page=document.getElementById('page-archive');if(!page)return false;
  const panel=page.querySelector('.panel');if(!panel)return false;
  const deals=Array.isArray(state.archive?.deals)?state.archive.deals:[];
  panel.textContent='';
  if(!deals.length){panel.append(empty('Закрытых сделок пока нет','После полного завершения сделки она появится в архиве.'));return true}
  for(const deal of deals){
    const statusText=norm(deal.business_status)||norm(deal.lifecycle_state)||'Завершена';
    const contract=norm(deal.contract_id);const closed=dateText(deal.closed_at||deal.updated_at);
    panel.append(row(norm(deal.deal_id)||'Сделка',contract?`Контракт ${contract}`:'',`${statusText} · ${closed}`));
  }
  return true;
}
function render(){if(!state.context)return false;const a=renderMessages(),b=renderArchive();if(a)status('Административный канал активен');return a||b}
function scheduleRender(){if(state.renderQueued)return;state.renderQueued=true;requestAnimationFrame(()=>{state.renderQueued=false;render()})}

async function load(next){
  const key=contextKey(next),seq=++state.seq;state.loading=true;
  try{
    const query=`?clientId=${encodeURIComponent(next.client_id)}&contractId=${encodeURIComponent(next.contract_id)}`;
    const [messages,archive]=await Promise.all([request('/v1/client/messages'+query),request('/v1/client/archive'+query)]);
    if(seq!==state.seq||contextKey(state.context)!==key||contextKey(authority()?.getCurrentContext())!==key)return;
    state.messages=Array.isArray(messages?.messages)?messages.messages:[];state.archive=archive?.archive||null;render();
  }catch(error){if(seq===state.seq&&contextKey(state.context)===key){console.error('RONA client messages/archive',error);status('Канал временно недоступен')}}finally{if(seq===state.seq)state.loading=false}
}
async function refresh(){
  const a=authority();if(!a)return;
  const next=a.getCurrentContext()||await a.whenReady();if(!next)return;
  const changed=contextKey(state.context)!==contextKey(next);state.context=next;
  if(changed){state.seq++;state.messages=[];state.archive=null;scheduleRender()}
  await load(next);
}
async function submit(){
  const next=state.context||authority()?.getCurrentContext();if(!next)return notify('Сначала выберите компанию и контракт.');
  const subject=norm(document.getElementById('msgSubject')?.value),message=norm(document.getElementById('msgText')?.value);
  if(!message)return notify('Введите сообщение.');
  const file=document.querySelector('#page-messages input[type="file"]');if(file?.files?.length)return notify('Вложения к сообщениям пока не подключены. Отправьте сообщение без файла.');
  const object=norm(document.getElementById('messageObject')?.value),match=object.match(/DEAL-\d{4}-\d{3,}/i);
  const body={clientId:next.client_id,contractId:next.contract_id,subject,message,idempotencyKey:crypto.randomUUID()};if(match)body.dealId=match[0].toUpperCase();
  status('Отправка…');
  try{
    await request('/v1/client/messages',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':body.idempotencyKey},body:JSON.stringify(body)});
    const subjectEl=document.getElementById('msgSubject'),messageEl=document.getElementById('msgText');if(subjectEl)subjectEl.value='';if(messageEl)messageEl.value='';
    notify('Сообщение передано администратору.');await load(next);
  }catch(error){console.error('RONA client message submit',error);status('Ошибка отправки');notify('Сообщение не отправлено. Повторите попытку.')}
}
function click(event){const button=event.target?.closest?.('#sendMessage');if(!button)return;event.preventDefault();event.stopImmediatePropagation();submit()}
function observe(){if(state.observer||!document.body)return;state.observer=new MutationObserver(()=>scheduleRender());state.observer.observe(document.body,{childList:true,subtree:true})}
function start(){
  const a=authority();if(!a){console.error('RONA client messages/archive: context authority unavailable');return}
  observe();document.addEventListener('click',click,true);
  state.unsubscribe=a.subscribe(next=>{if(contextKey(state.context)===contextKey(next)){scheduleRender();return}state.context=next||null;state.seq++;state.messages=[];state.archive=null;scheduleRender();if(next)load(next)});
  refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else queueMicrotask(start);
window.addEventListener('pageshow',()=>{scheduleRender();refresh()});
})();
