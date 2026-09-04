import { onRequest as serveCurrentAdminUi } from '../admin-main-ui-current.js';

const BUCKET_FROM="function application2BBucket(a){const owner=String(a?.owner_status||'').toUpperCase(),app=String(a?.status||'').toUpperCase(),deal=String(a?.deal_status||'').toUpperCase();if(owner==='REJECTED'||owner==='CANCELLED'||owner==='SUPPLIER_APPROVED'||owner==='DEAL'||app==='CANCELLED'||(app==='DEAL_REGISTERED'&&deal!=='SUPPLIER_PENDING'))return'COMPLETED';if(owner==='COUNTER_OFFERED'||owner==='SUPPLIER_PENDING'||deal==='SUPPLIER_PENDING')return'DECISION';if(owner==='NEW'||!owner)return'NEW';return'WORK'}";
const BUCKET_TO="function application2BBucket(a){const owner=String(a?.owner_status||'').toUpperCase(),app=String(a?.status||'').toUpperCase(),deal=String(a?.deal_status||'').toUpperCase();if(owner==='REJECTED'||owner==='CANCELLED'||owner==='DEAL'||app==='CANCELLED'||(app==='DEAL_REGISTERED'&&deal!=='SUPPLIER_PENDING'))return'COMPLETED';if(owner==='COUNTER_OFFERED'||owner==='SUPPLIER_PENDING'||deal==='SUPPLIER_PENDING')return'DECISION';if(owner==='NEW'||!owner)return'NEW';return'WORK'}";
const ACTIONS_FROM="function application2BActions(a){const bucket=application2BBucket(a),owner=String(a?.owner_status||'').toUpperCase(),deal=String(a?.deal_status||'').toUpperCase();if(bucket==='DECISION'&&(owner==='SUPPLIER_PENDING'||deal==='SUPPLIER_PENDING')){const box=e('div',{class:'rona-owner-actions rona-app-actions'});const run=async(action,body={})=>{try{await post('/admin/applications/'+encodeURIComponent(a.application_id)+'/'+action,body);await refreshAdmin()}catch(err){await notify(err.code||err.message,'Ошибка')}};box.append(e('button',{text:'Ресурс одобрен',onclick:()=>run('supplier-approved')}),e('button',{text:'В ресурсе отказано',onclick:()=>run('cancel',{reason:'SUPPLIER_RESOURCE_DENIED'})}));return box}if(bucket==='COMPLETED')return e('span',{class:'rona-owner-muted',text:'—'});return applicationActions(a)}";
const ACTIONS_TO="function application2BActions(a){const bucket=application2BBucket(a),owner=String(a?.owner_status||'').toUpperCase(),deal=String(a?.deal_status||'').toUpperCase();const run=async(action,body={})=>{try{await post('/admin/applications/'+encodeURIComponent(a.application_id)+'/'+action,body);await refreshAdmin()}catch(err){await notify(err.code||err.message,'Ошибка')}};if(owner==='SUPPLIER_APPROVED'&&!a?.deal_id){const box=e('div',{class:'rona-owner-actions rona-app-actions'});box.append(e('button',{text:'Отправить в сделки',onclick:()=>run('accept')}));return box}if(bucket==='DECISION'&&(owner==='SUPPLIER_PENDING'||deal==='SUPPLIER_PENDING')){const box=e('div',{class:'rona-owner-actions rona-app-actions'});box.append(e('button',{text:'Ресурс одобрен',onclick:()=>run('supplier-approved')}),e('button',{text:'В ресурсе отказано',onclick:()=>run('cancel',{reason:'SUPPLIER_RESOURCE_DENIED'})}));return box}if(bucket==='COMPLETED')return e('span',{class:'rona-owner-muted',text:'—'});return applicationActions(a)}";

const DEAL_STYLE_MARKER=".rona-deal-open{font:inherit;color:inherit;background:transparent;border:1px solid var(--line,rgba(255,255,255,.22));border-radius:9px;padding:7px 10px;cursor:pointer;font-weight:850}";
const DEAL_STYLE_PATCH=`
.rona-deal-drawer-backdrop{position:fixed;inset:0;z-index:2147483200;background:rgba(2,7,12,.52);backdrop-filter:blur(3px);display:flex;justify-content:flex-end;align-items:stretch;padding:72px 14px 14px 0}
.rona-deal-drawer{width:min(720px,calc(100vw - 118px));height:calc(100vh - 86px);border:1px solid rgba(139,186,214,.25);border-radius:18px;background:linear-gradient(180deg,rgba(9,22,34,.99),rgba(5,13,21,.99));box-shadow:-26px 0 90px rgba(0,0,0,.48);display:flex;flex-direction:column;overflow:hidden;animation:ronaDealDrawerIn .18s ease-out;outline:none}
@keyframes ronaDealDrawerIn{from{transform:translateX(28px);opacity:.62}to{transform:translateX(0);opacity:1}}
.rona-deal-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 18px 15px;border-bottom:1px solid var(--line-soft,rgba(255,255,255,.1));background:rgba(11,27,40,.9)}
.rona-deal-drawer-heading{min-width:0;flex:1}.rona-deal-drawer-eyebrow{font-size:10px;font-weight:850;letter-spacing:.09em;text-transform:uppercase;opacity:.58}.rona-deal-drawer-title{font-size:22px;font-weight:900;line-height:1.15;margin-top:4px}.rona-deal-drawer-client{font-size:12px;line-height:1.45;opacity:.72;margin-top:5px;max-width:510px}
.rona-deal-drawer-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.rona-deal-drawer-chip{display:inline-flex;align-items:center;min-height:25px;padding:4px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:rgba(148,163,184,.08);font-size:11px;font-weight:800;line-height:1.2}
.rona-deal-drawer-head-actions{display:flex;align-items:center;gap:9px;flex-shrink:0}.rona-deal-drawer-close{width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--line,rgba(255,255,255,.2));border-radius:10px;background:rgba(255,255,255,.035);color:inherit;font:inherit;font-size:22px;line-height:1;cursor:pointer}.rona-deal-drawer-close:hover{background:rgba(255,255,255,.08)}
.rona-deal-drawer-body{overflow:auto;overscroll-behavior:contain;padding:14px}.rona-deal-drawer-detail>.rona-deal-detail-grid{grid-template-columns:1fr;gap:10px}.rona-deal-drawer .rona-owner-card{margin:0;padding:14px 15px;border-radius:14px;background:rgba(255,255,255,.025)}.rona-deal-drawer .rona-owner-card h2{font-size:15px;margin-bottom:10px}.rona-deal-drawer .rona-deal-detail-row{grid-template-columns:minmax(130px,.78fr) minmax(0,1.45fr);gap:12px;padding:8px 0}.rona-deal-drawer .rona-deal-detail-label{font-size:10px}.rona-deal-drawer .rona-deal-doc-item{align-items:flex-start}.rona-deal-drawer .rona-deal-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.rona-deal-drawer .rona-deal-actions button{width:100%;min-height:38px}.rona-deal-drawer-detail>.rona-deal-source-note{margin:10px 0 0}
@media(max-width:900px){.rona-deal-drawer-backdrop{padding:66px 8px 8px 0}.rona-deal-drawer{width:min(680px,calc(100vw - 32px));height:calc(100vh - 74px)}}
@media(max-width:760px){.rona-deal-drawer-backdrop{padding:0}.rona-deal-drawer{width:100vw;height:100vh;border-radius:0;border-left:0;border-right:0}.rona-deal-drawer-head{padding:15px}.rona-deal-drawer-body{padding:10px}.rona-deal-drawer .rona-deal-actions{grid-template-columns:1fr}.rona-deal-drawer .rona-deal-detail-row{grid-template-columns:1fr;gap:4px}}
@media(prefers-reduced-motion:reduce){.rona-deal-drawer{animation:none}}
`;
const DEAL_RENDER_MARKER="renderDeals=function(){";
const DEAL_SELECTED_FROM="selected?deal2VDetail(selected):null";
const DEAL_SELECTED_TO="selected?deal2VSidePanel(selected):null";
const DEAL_BUTTON_FROM="text:ownerDeals2VSelected===d.deal_id?'Свернуть':'Открыть'";
const DEAL_BUTTON_TO="text:ownerDeals2VSelected===d.deal_id?'Закрыть':'Открыть'";
const DEAL_DRAWER_RUNTIME=`
function deal2VClosePanel(){if(!ownerDeals2VSelected)return;ownerDeals2VSelected=null;renderDeals()}
function deal2VSidePanel(d){
  if(!window.__RONA_DEAL_SIDE_PANEL_ESCAPE__){window.__RONA_DEAL_SIDE_PANEL_ESCAPE__=true;window.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&ownerDeals2VSelected&&q('#page-deals.active'))deal2VClosePanel()})}
  const app=deal2VSourceApplication(d),product=d?.product||app?.product||'Продукт требует подтверждения',volume=d?.quantity_tonnes??app?.quantity_tonnes;
  const detail=deal2VDetail(d),oldTitle=q('h2',detail);if(oldTitle)oldTitle.remove();detail.classList.add('rona-deal-drawer-detail');
  const overlay=e('div',{class:'rona-deal-drawer-backdrop'}),panel=e('aside',{class:'rona-deal-drawer',role:'dialog','aria-modal':'true','aria-label':'Карточка сделки '+String(d?.deal_id||''),tabindex:'-1'});
  overlay.addEventListener('click',ev=>{if(ev.target===overlay)deal2VClosePanel()});
  const meta=e('div',{class:'rona-deal-drawer-meta'},e('span',{class:'rona-deal-drawer-chip',text:String(product)}),e('span',{class:'rona-deal-drawer-chip',text:volume!==null&&volume!==undefined&&volume!==''?money(volume,'т'):'Объём требует подтверждения'}));
  const head=e('div',{class:'rona-deal-drawer-head'},e('div',{class:'rona-deal-drawer-heading'},e('div',{class:'rona-deal-drawer-eyebrow',text:'Карточка сделки'}),e('div',{class:'rona-deal-drawer-title',text:d?.deal_id||'—'}),e('div',{class:'rona-deal-drawer-client',text:d?.legal_name||'—'}),meta),e('div',{class:'rona-deal-drawer-head-actions'},deal2VOverallCell(d),e('button',{class:'rona-deal-drawer-close',type:'button','aria-label':'Закрыть карточку сделки',text:'×',onclick:deal2VClosePanel})));
  panel.append(head,e('div',{class:'rona-deal-drawer-body'},detail));overlay.append(panel);setTimeout(()=>panel.focus({preventScroll:true}),0);return overlay
}
`;

function patchDealSidePanel(source){
  if(!source.includes(DEAL_STYLE_MARKER)||!source.includes(DEAL_RENDER_MARKER)||!source.includes(DEAL_SELECTED_FROM)||!source.includes(DEAL_BUTTON_FROM))throw new Error('DEAL_SIDE_PANEL_PATCH_SOURCE_MISMATCH');
  return source
    .replace(DEAL_STYLE_MARKER,DEAL_STYLE_MARKER+DEAL_STYLE_PATCH)
    .replace(DEAL_RENDER_MARKER,DEAL_DRAWER_RUNTIME+DEAL_RENDER_MARKER)
    .replace(DEAL_SELECTED_FROM,DEAL_SELECTED_TO)
    .replace(DEAL_BUTTON_FROM,DEAL_BUTTON_TO);
}

export async function onRequest(context){
  const response=await serveCurrentAdminUi(context);
  const source=await response.text();
  if(!source.includes(BUCKET_FROM)||!source.includes(ACTIONS_FROM)){
    return new Response('APPLICATION_DEAL_HANDOFF_PATCH_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  let patched=source.replace(BUCKET_FROM,BUCKET_TO).replace(ACTIONS_FROM,ACTIONS_TO);
  try{patched=patchDealSidePanel(patched)}catch(error){
    return new Response(String(error?.message||'DEAL_SIDE_PANEL_PATCH_FAILED'),{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  const headers=new Headers(response.headers);
  headers.set('content-length',String(new TextEncoder().encode(patched).length));
  headers.set('x-rona-application-deal-handoff','approved-to-deal-v1');
  headers.set('x-rona-deals-owner','current-only-v1.6-side-panel');
  return new Response(patched,{status:response.status,statusText:response.statusText,headers});
}
