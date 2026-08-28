(()=>{'use strict';
if(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V1__)return;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V1__='20260828-secure-current-contract-v1';

const API='/portal/api';
const STYLE_ID='ronaClientContractDownloadV1Style';
const state={entries:[],loading:false,loadedAt:0,renderTimer:0};
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU');

async function request(path){
  const response=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const body=await response.json().catch(()=>null);
  if(!response.ok||body?.ok===false)throw new Error(String(body?.code||body?.error?.code||('HTTP_'+response.status)));
  return body;
}

function visible(el){
  if(!el||!el.isConnected)return false;
  const s=getComputedStyle(el);
  if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;
  const r=el.getBoundingClientRect();
  return r.width>0&&r.height>0;
}

function signedContract(documents){
  const docs=Array.isArray(documents)?documents:[];
  return docs.find(d=>String(d?.document_type||'').toUpperCase()==='SIGNED_CONTRACT'&&d?.storage_object_id)
    ||docs.find(d=>String(d?.document_type||'').toUpperCase().includes('CONTRACT')&&d?.storage_object_id)
    ||null;
}

async function load(force=false){
  if(state.loading)return;
  if(!force&&state.entries.length&&Date.now()-state.loadedAt<60000){render();return}
  state.loading=true;
  try{
    const boot=await request('/v1/client/bootstrap');
    const contexts=Array.isArray(boot?.data?.contexts)?boot.data.contexts:[];
    const entries=await Promise.all(contexts.map(async context=>{
      try{
        const detail=await request('/v1/client/context?clientId='+encodeURIComponent(context.client_id)+'&contractId='+encodeURIComponent(context.contract_id));
        const data=detail?.data||{};
        return{context:{...context,...(data.contract||{})},document:signedContract(data.documents)};
      }catch(error){
        console.error('RONA client contract context',context?.contract_id,error);
        return{context,document:null};
      }
    }));
    state.entries=entries;
    state.loadedAt=Date.now();
    window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__={entries:entries.map(x=>({context:x.context,document:x.document?{document_id:x.document.document_id,document_type:x.document.document_type,authoritative_filename:x.document.authoritative_filename,storage_object_id:x.document.storage_object_id}:null})),loadedAt:new Date().toISOString()};
    render();
  }catch(error){console.error('RONA client contract download',error)}
  finally{state.loading=false}
}

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
button[data-rona-contract-download]{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-height:26px!important;padding:6px 10px!important;border:1px solid rgba(230,190,82,.34)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(230,190,82,.12),rgba(230,190,82,.065))!important;color:#e8c86f!important;font:800 10px/1.15 inherit!important;letter-spacing:.02em!important;white-space:nowrap!important;cursor:pointer!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;transition:border-color .14s ease,background-color .14s ease,color .14s ease,box-shadow .14s ease,transform .14s ease!important}
button[data-rona-contract-download]::before{content:'↓';font-size:12px;line-height:1;font-weight:900;color:#67d9fb}
@media(hover:hover) and (pointer:fine){button[data-rona-contract-download]:hover{border-color:rgba(101,217,255,.52)!important;background:rgba(101,217,255,.10)!important;color:#d7f7ff!important;box-shadow:0 0 14px rgba(101,217,255,.08)!important;transform:translateY(-1px)!important}}
button[data-rona-contract-download]:focus-visible{outline:2px solid rgba(101,217,255,.42)!important;outline-offset:2px!important}
button[data-rona-contract-download]:active{transform:translateY(0)!important}
button[data-rona-contract-download][disabled]{cursor:wait!important;opacity:.72!important;transform:none!important}
`;
  document.head.appendChild(style);
}

function contextScore(text,ctx){
  const t=low(text);let score=0;
  const client=low(ctx?.client_id),contract=low(ctx?.contract_id),external=low(ctx?.current_external_contract_number),legal=low(ctx?.legal_name);
  if(client&&t.includes(client))score+=70;
  if(contract&&t.includes(contract))score+=100;
  if(external&&t.includes(external))score+=90;
  if(legal&&t.includes(legal))score+=55;
  if(t.includes('подписанный контракт'))score+=40;
  if(t.includes('контракт пока недоступен для скачивания'))score+=25;
  return score;
}

function cardFor(ctx){
  const markers=[ctx?.contract_id,ctx?.current_external_contract_number,ctx?.client_id].map(low).filter(Boolean);
  const leaves=Array.from(document.querySelectorAll('span,small,strong,p,div')).filter(el=>{
    if(!visible(el)||el.childElementCount>2)return false;
    const text=low(el.textContent);
    return markers.some(key=>key&&text.includes(key));
  });
  let best=null,bestScore=-Infinity;
  for(const seed of leaves){
    let node=seed;
    for(let depth=0;node&&depth<9;depth++,node=node.parentElement){
      if(node===document.body)break;
      const text=norm(node.textContent);
      if(!low(text).includes('подписанный контракт'))continue;
      const score=contextScore(text,ctx)-Math.min(text.length/80,45)-depth;
      if(score>bestScore){best=node;bestScore=score}
    }
  }
  if(best)return best;
  const containers=Array.from(document.querySelectorAll('article,section,div')).filter(visible);
  for(const node of containers){
    const text=norm(node.textContent);
    const score=contextScore(text,ctx)-Math.min(text.length/80,60);
    if(low(text).includes('подписанный контракт')&&score>bestScore){best=node;bestScore=score}
  }
  return bestScore>=100?best:null;
}

function unavailableNode(card){
  return Array.from(card.querySelectorAll('span,small,strong,div,p,button')).find(el=>{
    if(el.childElementCount>0)return false;
    const t=low(el.textContent);
    return t.includes('контракт пока недоступен для скачивания')||t==='контракт недоступен для скачивания';
  })||null;
}

function contractAnchor(card){
  return Array.from(card.querySelectorAll('span,small,strong,div,p')).find(el=>el.childElementCount===0&&low(el.textContent)==='подписанный контракт')||null;
}

function downloadName(entry,issued){
  return norm(issued?.object?.filename||entry?.document?.authoritative_filename||'Договор.pdf')||'Договор.pdf';
}

function withDownloadDisposition(signedUrl,filename){
  try{
    const u=new URL(String(signedUrl));
    u.searchParams.set('download',filename);
    return u.toString();
  }catch{return String(signedUrl||'')}
}

async function beginDownload(entry,button){
  if(button.disabled||!entry?.document?.storage_object_id)return;
  const idle='Скачать договор PDF';
  button.disabled=true;button.textContent='Подготовка PDF…';
  try{
    const issued=await request('/v1/client/storage/'+encodeURIComponent(entry.document.storage_object_id)+'/signed-url');
    const signedUrl=issued?.signed_url||issued?.data?.signed_url;
    if(!signedUrl)throw new Error('SIGNED_URL_MISSING');
    const filename=downloadName(entry,issued);
    const a=document.createElement('a');
    a.href=withDownloadDisposition(signedUrl,filename);
    a.target='_blank';
    a.rel='noopener';
    a.download=filename;
    a.style.display='none';
    document.body.appendChild(a);a.click();a.remove();
    button.textContent='Договор открыт';
    setTimeout(()=>{if(button.isConnected&&!button.disabled===false)button.textContent=idle},1200);
  }catch(error){
    console.error('RONA contract download',error);
    button.textContent='Не удалось скачать';
    button.title='Не удалось получить защищённую ссылку. Повторите попытку.';
  }finally{
    setTimeout(()=>{if(button.isConnected){button.disabled=false;if(button.textContent!=='Не удалось скачать')button.textContent=idle}},900);
  }
}

function makeButton(entry,template){
  const button=document.createElement('button');
  button.type='button';
  if(template&&typeof template.className==='string')button.className=template.className;
  button.dataset.ronaContractDownload=String(entry.context?.contract_id||'');
  button.dataset.storageObjectId=String(entry.document?.storage_object_id||'');
  button.textContent='Скачать договор PDF';
  button.title=norm(entry.document?.authoritative_filename)||'Скачать действующий подписанный договор';
  button.setAttribute('aria-label','Скачать подписанный договор '+norm(entry.context?.current_external_contract_number||entry.context?.contract_id));
  button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();beginDownload(entry,button)},true);
  return button;
}

function renderEntry(entry){
  if(!entry?.document?.storage_object_id)return false;
  const card=cardFor(entry.context);if(!card)return false;
  ensureStyle();
  const existing=card.querySelector('button[data-rona-contract-download]');
  if(existing&&existing.dataset.storageObjectId===String(entry.document.storage_object_id))return true;
  if(existing)existing.remove();
  const unavailable=unavailableNode(card);
  const button=makeButton(entry,unavailable);
  if(unavailable){unavailable.replaceWith(button);return true}
  const anchor=contractAnchor(card);
  const host=anchor?.parentElement||card;
  host.appendChild(button);
  return true;
}

function render(){
  if(!state.entries.length)return false;
  let count=0;
  for(const entry of state.entries)if(renderEntry(entry))count++;
  document.documentElement.dataset.ronaClientContractDownloads=String(count);
  return count>0;
}

function schedule(force=false){
  clearTimeout(state.renderTimer);
  state.renderTimer=setTimeout(()=>{render();if(force)load(false)},220);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>load(true),{once:true});else queueMicrotask(()=>load(true));
document.addEventListener('click',event=>{if(event.target?.closest?.('[data-rona-contract-download]'))return;schedule(false)},true);
document.addEventListener('change',()=>schedule(false),true);
setInterval(()=>{if(document.visibilityState==='visible'){render();load(false)}},12000);
})();
