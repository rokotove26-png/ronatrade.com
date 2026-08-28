(()=>{'use strict';
if(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V2__)return;
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V2__='20260829-admin-authoritative-current-v1';
// Block the legacy loader: v2 owns the contract-download surface.
window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V1__=window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V2__;

const API='/portal/api';
const REFRESH_MS=15000;
const STYLE_ID='ronaClientContractDownloadV2Style';
const state={contexts:[],entries:new Map(),loading:false,lastLoad:0,renderTimer:0};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

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
function currentContractDocument(documents){
  const docs=(Array.isArray(documents)?documents:[]).filter(d=>Boolean(d?.storage_object_id));
  const type=d=>String(d?.document_type||'').trim().toUpperCase();
  return docs.find(d=>type(d)==='SIGNED_CONTRACT')
    ||docs.find(d=>type(d)==='КОНТРАКТ')
    ||docs.find(d=>type(d)==='CONTRACT')
    ||docs.find(d=>type(d).includes('CONTRACT')||type(d).includes('КОНТРАКТ'))
    ||null;
}
async function mapLimit(items,limit,worker){
  const queue=[...items],out=[];
  const runners=Array.from({length:Math.min(limit,queue.length)},async()=>{
    while(queue.length){
      const item=queue.shift();
      if(item===undefined)break;
      out.push(await worker(item));
    }
  });
  await Promise.all(runners);
  return out;
}
async function refresh(force=false){
  if(state.loading)return;
  if(!force&&Date.now()-state.lastLoad<REFRESH_MS)return render();
  state.loading=true;
  try{
    const boot=await request('/v1/client/bootstrap');
    const contexts=Array.isArray(boot?.data?.contexts)?boot.data.contexts:[];
    const rows=await mapLimit(contexts,4,async context=>{
      try{
        const detail=await request('/v1/client/context?clientId='+encodeURIComponent(context.client_id)+'&contractId='+encodeURIComponent(context.contract_id));
        const data=detail?.data||{};
        return{context:{...context,...(data.contract||{})},document:currentContractDocument(data.documents)};
      }catch(error){
        console.error('RONA client contract context',context?.contract_id,error);
        return{context,document:null};
      }
    });
    state.contexts=contexts;
    state.entries=new Map(rows.map(row=>[String(row.context?.contract_id||row.context?.client_id||crypto.randomUUID()),row]));
    state.lastLoad=Date.now();
    window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__={
      version:window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V2__,
      entries:rows.map(row=>({client_id:row.context?.client_id||null,contract_id:row.context?.contract_id||null,document_id:row.document?.document_id||null,storage_object_id:row.document?.storage_object_id||null})),
      loadedAt:new Date().toISOString()
    };
    render();
  }catch(error){console.error('RONA client contract download bootstrap',error)}
  finally{state.loading=false}
}

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
button[data-rona-contract-download-v2]{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-height:26px!important;padding:6px 10px!important;border:1px solid rgba(230,190,82,.34)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(230,190,82,.12),rgba(230,190,82,.065))!important;color:#e8c86f!important;font-family:inherit!important;font-size:10px!important;line-height:1.15!important;font-weight:800!important;letter-spacing:.02em!important;white-space:nowrap!important;cursor:pointer!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;transition:border-color .14s ease,background-color .14s ease,color .14s ease,box-shadow .14s ease,transform .14s ease!important}
button[data-rona-contract-download-v2]::before{content:'↓';font-size:12px;line-height:1;font-weight:900;color:#67d9fb}
@media(hover:hover) and (pointer:fine){button[data-rona-contract-download-v2]:hover{border-color:rgba(101,217,255,.52)!important;background:rgba(101,217,255,.10)!important;color:#d7f7ff!important;box-shadow:0 0 14px rgba(101,217,255,.08)!important;transform:translateY(-1px)!important}}
button[data-rona-contract-download-v2]:focus-visible{outline:2px solid rgba(101,217,255,.42)!important;outline-offset:2px!important}
button[data-rona-contract-download-v2]:active{transform:translateY(0)!important}
button[data-rona-contract-download-v2][disabled]{cursor:wait!important;opacity:.72!important;transform:none!important}
`;
  document.head.appendChild(style);
}
function findCompanyCard(ctx){
  const contractKey=low(ctx?.contract_id),clientKey=low(ctx?.client_id),legalKey=low(ctx?.legal_name);
  if(!contractKey&&!clientKey)return null;
  const candidates=[];
  for(const node of document.querySelectorAll('article,section,li,div')){
    if(!visible(node))continue;
    const text=low(node.textContent);
    if(!text||text.length>9000||!text.includes('подписанный контракт'))continue;
    const hasContract=contractKey&&text.includes(contractKey);
    const hasClient=clientKey&&text.includes(clientKey);
    if(!hasContract&&!hasClient)continue;
    let score=(hasContract?10000:0)+(hasClient?3000:0)+(legalKey&&text.includes(legalKey)?700:0)+500;
    score-=Math.min(text.length,8000)/8;
    const r=node.getBoundingClientRect();
    score-=Math.min(r.width*r.height,2000000)/200000;
    candidates.push({node,score,textLength:text.length});
  }
  candidates.sort((a,b)=>b.score-a.score||a.textLength-b.textLength);
  return candidates[0]?.node||null;
}
function leafByText(root,predicate){
  return Array.from(root.querySelectorAll('button,a,span,small,strong,p,div')).find(el=>el.childElementCount===0&&predicate(low(el.textContent)))||null;
}
function unavailableNode(card){
  return leafByText(card,t=>t.includes('контракт пока недоступен для скачивания')||t==='контракт недоступен для скачивания');
}
function contractAnchor(card){return leafByText(card,t=>t==='подписанный контракт')}
function downloadName(entry,issued){return norm(issued?.object?.filename||entry?.document?.authoritative_filename||'Договор.pdf')||'Договор.pdf'}
function withDownloadDisposition(signedUrl,filename){
  try{const u=new URL(String(signedUrl));u.searchParams.set('download',filename);return u.toString()}catch{return String(signedUrl||'')}
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
    a.target='_blank';a.rel='noopener';a.download=filename;a.style.display='none';
    document.body.appendChild(a);a.click();a.remove();
    button.textContent='Договор открыт';
  }catch(error){
    console.error('RONA contract download',error);
    button.textContent='Не удалось скачать';
    button.title='Не удалось получить защищённую ссылку. Повторите попытку.';
  }finally{setTimeout(()=>{if(button.isConnected){button.disabled=false;button.textContent=idle}},1200)}
}
function makeButton(entry,template){
  ensureStyle();
  const button=document.createElement('button');
  button.type='button';
  if(template&&typeof template.className==='string')button.className=template.className;
  button.dataset.ronaContractDownloadV2=String(entry.context?.contract_id||'');
  button.dataset.storageObjectId=String(entry.document?.storage_object_id||'');
  button.textContent='Скачать договор PDF';
  button.title=norm(entry.document?.authoritative_filename)||'Скачать действующий подписанный договор';
  button.setAttribute('aria-label','Скачать подписанный договор '+norm(entry.context?.current_external_contract_number||entry.context?.contract_id));
  button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();beginDownload(entry,button)},true);
  return button;
}
function renderEntry(entry){
  const card=findCompanyCard(entry.context);if(!card)return false;
  card.dataset.ronaClientContractId=String(entry.context?.contract_id||'');
  card.dataset.ronaClientId=String(entry.context?.client_id||'');
  for(const legacy of card.querySelectorAll('button[data-rona-contract-download]'))legacy.remove();
  const existing=card.querySelector('button[data-rona-contract-download-v2]');
  if(!entry.document?.storage_object_id){if(existing)existing.remove();return false}
  if(existing&&existing.dataset.storageObjectId===String(entry.document.storage_object_id))return true;
  if(existing)existing.remove();
  const unavailable=unavailableNode(card);
  const button=makeButton(entry,unavailable);
  if(unavailable){unavailable.replaceWith(button);return true}
  const anchor=contractAnchor(card),host=anchor?.parentElement||card;
  host.appendChild(button);return true;
}
function render(){
  let count=0;
  for(const entry of state.entries.values())if(renderEntry(entry))count++;
  document.documentElement.dataset.ronaClientContractDownloads=String(count);
  document.documentElement.dataset.ronaClientContractRuntime='v2';
  return count>0;
}
function scheduleRender(){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(render,120)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>refresh(true),{once:true});else queueMicrotask(()=>refresh(true));
new MutationObserver(scheduleRender).observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('click',event=>{if(!event.target?.closest?.('[data-rona-contract-download-v2]'))scheduleRender()},true);
document.addEventListener('change',scheduleRender,true);
setInterval(()=>{if(document.visibilityState==='visible')refresh(true)},REFRESH_MS);
})();
