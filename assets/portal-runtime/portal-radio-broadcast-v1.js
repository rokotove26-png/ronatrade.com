(()=>{'use strict';
const MARK='20260925-stage2c1-v1';
if(window.__RONA_PORTAL_RADIO_BROADCAST_V1__===MARK)return;
const role=location.pathname==='/portal/agent'?'AGENT':(location.pathname==='/portal/client'?'CLIENT':'');
if(!role)return;
window.__RONA_PORTAL_RADIO_BROADCAST_V1__=MARK;
const OWNER='/portal/owner-api?path='+encodeURIComponent(role==='CLIENT'?'/client/bootstrap':'/agent/bootstrap');
const POLL_MS=30000;
const dismissed=new Set();
const state={role,loading:false,radio:[],lastLoadedAt:0,error:null,timer:0,requestSeq:0};
window.__RONA_PORTAL_RADIO_BROADCAST_STATE__=state;
const norm=v=>String(v??'').trim();
const upper=v=>norm(v).toUpperCase();
const byTime=(a,b)=>new Date(b?.active_from||b?.created_at||0)-new Date(a?.active_from||a?.created_at||0);
function active(row){
  const now=Date.now(),from=Date.parse(String(row?.active_from||'')),until=row?.active_until?Date.parse(String(row.active_until)):NaN;
  if(Number.isFinite(from)&&from>now)return false;
  if(Number.isFinite(until)&&until<=now)return false;
  return true;
}
function currentRows(){
  return (Array.isArray(state.radio)?state.radio:[]).filter(active);
}
function ensureStyle(){
  if(document.getElementById('ronaRadioBroadcastStage2c1Style'))return;
  const s=document.createElement('style');
  s.id='ronaRadioBroadcastStage2c1Style';
  s.textContent=`
#ronaRadioAnnouncementTicker{position:fixed;left:0;right:0;top:0;z-index:2147482500;height:36px;display:flex;align-items:center;overflow:hidden;pointer-events:none;background:linear-gradient(90deg,rgba(5,15,25,.985),rgba(8,28,42,.985),rgba(5,15,25,.985));border-bottom:1px solid rgba(84,205,244,.28);box-shadow:0 8px 28px rgba(0,0,0,.30);font-family:Inter,Arial,sans-serif;color:#eaf7fb}
#ronaRadioAnnouncementTicker .rona-radio-ticker-label{height:100%;display:flex;align-items:center;flex:0 0 auto;padding:0 13px;font-size:10px;font-weight:900;letter-spacing:.10em;text-transform:uppercase;color:#7ee4ff;background:rgba(26,119,154,.20);border-right:1px solid rgba(84,205,244,.20);z-index:2}
#ronaRadioAnnouncementTicker .rona-radio-ticker-window{position:relative;min-width:0;flex:1;height:100%;display:flex;align-items:center;overflow:hidden}
#ronaRadioAnnouncementTicker .rona-radio-ticker-track{display:flex;align-items:center;width:max-content;min-width:max-content;white-space:nowrap;will-change:transform;animation:ronaRadioTickerRun 28s linear infinite}
#ronaRadioAnnouncementTicker .rona-radio-ticker-copy{display:inline-block;padding-left:72px;padding-right:72px;font-size:12px;font-weight:760;letter-spacing:.01em;color:#e5f3f8}
#ronaRadioAnnouncementTicker .rona-radio-ticker-sep{display:inline-block;padding:0 18px;color:#55d8ff;font-weight:900}
@keyframes ronaRadioTickerRun{from{transform:translateX(0)}to{transform:translateX(-50%)}}
#ronaRadioNotificationOverlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,8,14,.60);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);font-family:Inter,Arial,sans-serif}
#ronaRadioNotificationOverlay .rona-radio-modal-card{width:min(560px,calc(100vw - 32px));max-height:min(72vh,620px);overflow:auto;border:1px solid rgba(89,211,255,.30);border-radius:22px;background:radial-gradient(520px 200px at 92% 0,rgba(76,205,247,.15),transparent 66%),linear-gradient(145deg,rgba(9,28,43,.99),rgba(4,14,24,.99));box-shadow:0 32px 100px rgba(0,0,0,.60),inset 0 1px rgba(255,255,255,.04);color:#edf8fb}
#ronaRadioNotificationOverlay .rona-radio-modal-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 20px 14px;border-bottom:1px solid rgba(98,194,232,.15)}
#ronaRadioNotificationOverlay .rona-radio-modal-title{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:900;letter-spacing:-.01em}
#ronaRadioNotificationOverlay .rona-radio-modal-title:before{content:"";width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:#55d8ff;box-shadow:0 0 16px rgba(85,216,255,.65)}
#ronaRadioNotificationOverlay .rona-radio-modal-close{appearance:none;border:1px solid rgba(116,190,220,.24);border-radius:10px;background:rgba(255,255,255,.035);color:#d8e9f0;padding:8px 11px;font:800 11px Inter,Arial,sans-serif;cursor:pointer}
#ronaRadioNotificationOverlay .rona-radio-modal-body{padding:21px 22px 22px;font-size:14px;line-height:1.65;color:#d9e8ee;white-space:pre-wrap;overflow-wrap:anywhere}
#ronaRadioNotificationOverlay .rona-radio-modal-meta{padding:0 22px 20px;font-size:10px;color:#708d9d}
@media(max-width:640px){#ronaRadioAnnouncementTicker{height:34px}#ronaRadioAnnouncementTicker .rona-radio-ticker-label{padding:0 9px;font-size:9px}#ronaRadioAnnouncementTicker .rona-radio-ticker-copy{font-size:11px;padding-left:46px;padding-right:46px}#ronaRadioNotificationOverlay{padding:14px}#ronaRadioNotificationOverlay .rona-radio-modal-card{width:100%}}
@media(prefers-reduced-motion:reduce){#ronaRadioAnnouncementTicker .rona-radio-ticker-track{animation-duration:70s}}
`;
  document.head.appendChild(s);
}
function removeTicker(){document.getElementById('ronaRadioAnnouncementTicker')?.remove()}
function renderTicker(){
  const rows=currentRows().filter(x=>upper(x?.item_kind)==='ANNOUNCEMENT').sort(byTime);
  if(!rows.length){removeTicker();return}
  ensureStyle();
  const signature=rows.map(x=>[x?.id,x?.body_text,x?.active_from,x?.active_until].join(':')).join('|');
  let root=document.getElementById('ronaRadioAnnouncementTicker');
  if(root?.dataset.signature===signature)return;
  if(!root){
    root=document.createElement('div');
    root.id='ronaRadioAnnouncementTicker';
    root.dataset.ronaRadioAnnouncementTicker='true';
    root.setAttribute('role','status');
    root.setAttribute('aria-live','polite');
    const label=document.createElement('div');label.className='rona-radio-ticker-label';label.textContent='RONA Trade';
    const win=document.createElement('div');win.className='rona-radio-ticker-window';
    root.append(label,win);
    document.body.prepend(root);
  }
  root.dataset.signature=signature;
  const win=root.querySelector('.rona-radio-ticker-window');win.replaceChildren();
  const text=rows.map(x=>norm(x?.body_text)).filter(Boolean).join('   •   ');
  const track=document.createElement('div');track.className='rona-radio-ticker-track';
  for(let i=0;i<2;i++){const copy=document.createElement('span');copy.className='rona-radio-ticker-copy';copy.textContent=text;track.appendChild(copy)}
  win.appendChild(track);
}
function closeModal(id){
  if(id)dismissed.add(String(id));
  document.getElementById('ronaRadioNotificationOverlay')?.remove();
  queueMicrotask(renderModal);
}
function renderModal(){
  if(role!=='CLIENT'){document.getElementById('ronaRadioNotificationOverlay')?.remove();return}
  const rows=currentRows().filter(x=>upper(x?.item_kind)==='NOTIFICATION'&&!dismissed.has(String(x?.id||''))).sort(byTime);
  const item=rows[0];
  if(!item){document.getElementById('ronaRadioNotificationOverlay')?.remove();return}
  ensureStyle();
  const id=String(item.id||'');
  let root=document.getElementById('ronaRadioNotificationOverlay');
  if(root?.dataset.itemId===id)return;
  root?.remove();
  root=document.createElement('div');
  root.id='ronaRadioNotificationOverlay';
  root.dataset.ronaRadioNotificationModal='true';
  root.dataset.itemId=id;
  root.setAttribute('role','presentation');
  const card=document.createElement('section');card.className='rona-radio-modal-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby','ronaRadioNotificationTitle');
  const head=document.createElement('div');head.className='rona-radio-modal-head';
  const title=document.createElement('div');title.className='rona-radio-modal-title';title.id='ronaRadioNotificationTitle';title.textContent='Уведомление RONA Trade';
  const close=document.createElement('button');close.className='rona-radio-modal-close';close.type='button';close.textContent='Закрыть';close.addEventListener('click',()=>closeModal(id));
  head.append(title,close);
  const body=document.createElement('div');body.className='rona-radio-modal-body';body.textContent=norm(item.body_text)||'—';
  const meta=document.createElement('div');meta.className='rona-radio-modal-meta';meta.textContent=item.active_from?'Опубликовано: '+new Date(item.active_from).toLocaleString('ru-RU'):'';
  card.append(head,body,meta);root.append(card);document.body.append(root);queueMicrotask(()=>close.focus({preventScroll:true}));
}
function render(){renderTicker();renderModal();state.lastRenderedAt=Date.now()}
async function refresh(reason='poll'){
  if(state.loading)return;
  state.loading=true;const seq=++state.requestSeq;
  try{
    const response=await fetch(OWNER,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-source':'RADIO_STAGE2C1_'+role+'_'+String(reason).toUpperCase()}});
    const body=await response.json().catch(()=>null);
    if(!response.ok||body?.ok===false)throw new Error(String(body?.code||('HTTP_'+response.status)));
    if(seq!==state.requestSeq)return;
    state.radio=Array.isArray(body?.data?.radio)?body.data.radio:[];
    state.lastLoadedAt=Date.now();state.error=null;render();
  }catch(error){state.error=String(error?.message||error||'RADIO_BROADCAST_LOAD_FAILED')}
  finally{state.loading=false}
}
function start(){
  ensureStyle();void refresh('start');
  if(!state.timer)state.timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh('poll')},POLL_MS);
  window.addEventListener('focus',()=>void refresh('focus'),{passive:true});
  window.addEventListener('pageshow',()=>void refresh('pageshow'),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh('visible')},{passive:true});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const root=document.getElementById('ronaRadioNotificationOverlay');if(root)closeModal(root.dataset.itemId||'')}})
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();