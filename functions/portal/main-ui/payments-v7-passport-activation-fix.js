export const paymentsV7PassportActivationPrelude = String.raw`
const PAYMENTS_V7_PASSPORT_SCOPE_BRIDGE='PAYMENTS_V7_PASSPORT_SCOPE_BRIDGE_V1';
if(typeof globalThis.q!=='function')globalThis.q=(selector,root=document)=>root?.querySelector?.(selector)||null;
if(typeof globalThis.e!=='function')globalThis.e=(tag,attrs={},...children)=>{
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attrs||{})){
    if(key==='class')node.className=value;
    else if(key==='text')node.textContent=String(value);
    else if(key==='html')node.innerHTML=String(value);
    else if(key.startsWith('on')&&typeof value==='function')node.addEventListener(key.slice(2).toLowerCase(),value);
    else if(value!==false&&value!==null&&value!==undefined)node.setAttribute(key,value===true?'':String(value));
  }
  for(const child of children.flat(Infinity)){
    if(child===null||child===undefined)continue;
    node.append(child?.nodeType?child:document.createTextNode(String(child)));
  }
  return node;
};
if(typeof globalThis.paymentsV7Array!=='function')globalThis.paymentsV7Array=value=>Array.isArray(value)?value:[];
if(typeof globalThis.paymentsV7Text!=='function')globalThis.paymentsV7Text=value=>String(value??'').trim();
if(typeof globalThis.paymentsV7Upper!=='function')globalThis.paymentsV7Upper=value=>globalThis.paymentsV7Text(value).toUpperCase();
if(typeof globalThis.paymentsV7Num!=='function')globalThis.paymentsV7Num=value=>{if(value===null||value===undefined||globalThis.paymentsV7Text(value)==='')return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null};
if(typeof globalThis.paymentsV7Fmt!=='function')globalThis.paymentsV7Fmt=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:8}).format(Number(value));
// The active Payments board is scoped inside the current Admin runtime IIFE. Keep appended aggregate renderers inert here.
if(typeof globalThis.paymentsV7Projection!=='function')globalThis.paymentsV7Projection=()=>null;
`;

export const paymentsV7PassportActivationRuntime = String.raw`
const PAYMENTS_V7_PASSPORT_RENDERER_ACTIVATION='PAYMENTS_V7_PASSPORT_DESIGNER_MODAL_V1';
const PAYMENTS_V7_PASSPORT_MODAL_ID='ronaPaymentsV7PassportDesignerModal';

function paymentsV7PassportDealFromTrigger(trigger){
  const article=trigger?.closest?.('.rona-payments-v7-deal');
  if(!article)return null;
  const projection=window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection;
  if(!projection||paymentsV7Text(projection?.contract)!=='ADMIN_PAYMENTS_V7')return null;
  const dealKey=paymentsV7Text(article?.dataset?.dealKey),dealId=paymentsV7Text(article?.dataset?.dealId);
  const deals=paymentsV7Array(projection?.deals);
  return deals.find(deal=>dealKey&&paymentsV7Text(deal?.deal_key)===dealKey)
    ||deals.find(deal=>dealId&&paymentsV7Text(deal?.deal_id)===dealId)
    ||null;
}

function paymentsV7PassportInstallDesignerModalStyle(){
  if(q('#ronaPaymentsV7PassportDesignerModalStyle'))return;
  const s=e('style',{id:'ronaPaymentsV7PassportDesignerModalStyle'});
  s.textContent='.rona-payments-v7-passport[open]>:not(summary){display:none!important}.rona-payments-v7-passport>summary{cursor:pointer}.rona-payments-v7-designer-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:rgba(1,7,12,.78);backdrop-filter:blur(8px)}.rona-payments-v7-designer-modal{width:min(1180px,calc(100vw - 48px));max-height:92vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(126,170,203,.22);border-radius:20px;background:linear-gradient(180deg,rgba(10,24,36,.99),rgba(4,13,21,.99));box-shadow:0 28px 90px rgba(0,0,0,.55)}.rona-payments-v7-designer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:24px 26px 20px;border-bottom:1px solid rgba(121,157,187,.14)}.rona-payments-v7-designer-eyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#7fa2bb}.rona-payments-v7-designer-deal-label{margin-top:11px;font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#718da3}.rona-payments-v7-designer-title{margin:4px 0 0;font-size:30px;line-height:1.05;color:#f2f7fb}.rona-payments-v7-designer-meta{display:flex;gap:10px 20px;flex-wrap:wrap;margin-top:10px;color:#9fb3c2;font-size:12px}.rona-payments-v7-designer-meta strong{color:#dce9f3}.rona-payments-v7-designer-close{appearance:none;border:1px solid rgba(126,170,203,.22);border-radius:10px;padding:9px 13px;background:rgba(13,31,45,.92);color:#dce9f3;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.rona-payments-v7-designer-close:hover{background:rgba(19,43,60,.98)}.rona-payments-v7-designer-scroll{min-height:0;overflow:auto;padding:20px 22px 26px;overscroll-behavior:contain}.rona-payments-v7-designer-unavailable{padding:20px;border:1px dashed rgba(242,187,103,.28);border-radius:12px;color:#e8cb99;background:rgba(43,30,13,.28)}html.rona-payments-v7-modal-open{overflow:hidden}@media(max-width:760px){.rona-payments-v7-designer-overlay{padding:10px}.rona-payments-v7-designer-modal{width:calc(100vw - 20px);max-height:96vh;border-radius:15px}.rona-payments-v7-designer-head{padding:18px;gap:14px}.rona-payments-v7-designer-title{font-size:22px}.rona-payments-v7-designer-meta{display:grid;gap:5px}.rona-payments-v7-designer-scroll{padding:14px}}';
  document.head?.appendChild?.(s)||document.head?.append?.(s);
}

function paymentsV7PassportCloseDesignerModal({restoreFocus=true}={}){
  const modal=q('#'+PAYMENTS_V7_PASSPORT_MODAL_ID);
  if(modal?.remove)modal.remove();
  document.documentElement?.classList?.remove?.('rona-payments-v7-modal-open');
  if(restoreFocus&&window.__ronaPaymentsV7PassportLastTrigger?.focus)window.__ronaPaymentsV7PassportLastTrigger.focus();
  window.__ronaPaymentsV7PassportLastTrigger=null;
}

function paymentsV7PassportStripInlineBody(trigger){
  const summary=trigger?.matches?.('.rona-payments-v7-passport > summary')?trigger:trigger?.closest?.('.rona-payments-v7-passport > summary');
  const details=summary?.parentElement;
  if(!details)return;
  details.open=false;
  for(const child of Array.from(details.children||[]))if(child!==summary&&child?.remove)child.remove();
  details.dataset.passportPresentation='MODAL_ONLY';
}

function paymentsV7OpenDesignerPassport(trigger){
  const deal=paymentsV7PassportDealFromTrigger(trigger);
  const passport=deal&&typeof paymentsV7OwnerPassport==='function'?paymentsV7OwnerPassport(deal):null;
  const renderer=typeof paymentsV7OwnerPassportBody==='function'?paymentsV7OwnerPassportBody:null;
  paymentsV7PassportCloseDesignerModal({restoreFocus:false});
  paymentsV7PassportInstallDesignerModalStyle();
  window.__ronaPaymentsV7PassportLastTrigger=trigger||null;

  const overlay=e('div',{id:PAYMENTS_V7_PASSPORT_MODAL_ID,class:'rona-payments-v7-designer-overlay','data-passport-renderer-contract':PAYMENTS_V7_PASSPORT_RENDERER_ACTIVATION});
  const panel=e('section',{class:'rona-payments-v7-designer-modal',role:'dialog','aria-modal':'true','aria-labelledby':'ronaPaymentsV7PassportDesignerTitle'});
  const head=e('header',{class:'rona-payments-v7-designer-head'});
  const titleBlock=e('div',{},
    e('div',{class:'rona-payments-v7-designer-eyebrow',text:'ПАСПОРТ ПЛАТЕЖА'}),
    e('div',{class:'rona-payments-v7-designer-deal-label',text:'Deal ID'}),
    e('h2',{id:'ronaPaymentsV7PassportDesignerTitle',class:'rona-payments-v7-designer-title',text:paymentsV7Text(deal?.deal_id)||'Сделка'}),
    e('div',{class:'rona-payments-v7-designer-meta'},
      e('span',{},'Клиент: ',e('strong',{text:paymentsV7Text(deal?.client_display)||'—'}))
    )
  );
  const close=e('button',{type:'button',class:'rona-payments-v7-designer-close','data-passport-modal-close':'true',text:'Закрыть'});
  head.append(titleBlock,close);
  const scroll=e('div',{class:'rona-payments-v7-designer-scroll'});

  if(!deal||!passport||!renderer||renderer.name!=='paymentsV7OwnerPassportBodyRecovered'){
    scroll.append(e('div',{class:'rona-payments-v7-designer-unavailable',text:'Платёжный паспорт временно недоступен: owner renderer не активирован.'}));
    overlay.dataset.passportRenderer='TO_VERIFY';
  }else{
    scroll.append(renderer(deal,passport));
    overlay.dataset.passportRenderer=renderer.name;
  }
  panel.append(head,scroll);
  overlay.append(panel);
  (document.body?.appendChild?document.body:document.documentElement)?.appendChild?.(overlay);
  document.documentElement?.classList?.add?.('rona-payments-v7-modal-open');
  close.focus?.();
  return overlay;
}

if(!document.__ronaPaymentsV7PassportActivationBound){
  document.__ronaPaymentsV7PassportActivationBound=true;
  document.addEventListener('click',event=>{
    const target=event.target;
    const trigger=target?.closest?.('.rona-payments-v7-passport-trigger')||target?.closest?.('.rona-payments-v7-passport > summary');
    if(trigger){
      event.preventDefault?.();
      event.stopPropagation?.();
      paymentsV7PassportStripInlineBody(trigger);
      paymentsV7OpenDesignerPassport(trigger);
      return;
    }
    if(target?.closest?.('[data-passport-modal-close="true"]')){
      event.preventDefault?.();
      paymentsV7PassportCloseDesignerModal();
      return;
    }
    const overlay=q('#'+PAYMENTS_V7_PASSPORT_MODAL_ID);
    if(overlay&&target===overlay)paymentsV7PassportCloseDesignerModal();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&q('#'+PAYMENTS_V7_PASSPORT_MODAL_ID)){
      event.preventDefault?.();
      paymentsV7PassportCloseDesignerModal();
    }
  },true);
}
`;