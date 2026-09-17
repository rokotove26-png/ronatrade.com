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
if(typeof globalThis.paymentsV7Fmt!=='function')globalThis.paymentsV7Fmt=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(Number(value));
// The active Payments board is scoped inside the current Admin runtime IIFE. Keep appended aggregate renderers inert here.
if(typeof globalThis.paymentsV7Projection!=='function')globalThis.paymentsV7Projection=()=>null;
`;

export const paymentsV7PassportActivationRuntime = String.raw`
const PAYMENTS_V7_PASSPORT_RENDERER_ACTIVATION='PAYMENTS_V7_PASSPORT_OWNER_TABLE_MODAL_V2';
const PAYMENTS_V7_PASSPORT_OWNER_TABLE_VERSION='OWNER_TABLE_V2';
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

function paymentsV7PassportOwnerTableRenderer(){
  const renderer=globalThis.paymentsV7OwnerPassportTableRenderer;
  if(typeof renderer!=='function')return null;
  if(renderer.__ronaOwnerTableVersion!==PAYMENTS_V7_PASSPORT_OWNER_TABLE_VERSION)return null;
  return renderer;
}

function paymentsV7PassportInstallDesignerModalStyle(){
  if(q('#ronaPaymentsV7PassportDesignerModalStyle'))return;
  const s=e('style',{id:'ronaPaymentsV7PassportDesignerModalStyle'});
  s.textContent='.rona-payments-v7-passport[open]>:not(summary){display:none!important}.rona-payments-v7-passport>summary{cursor:pointer}.rona-payments-v7-designer-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:rgba(1,7,12,.74);backdrop-filter:blur(10px)}.rona-payments-v7-designer-modal{width:min(1120px,calc(100vw - 40px));max-height:90vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(126,170,203,.20);border-radius:18px;background:linear-gradient(180deg,rgba(9,23,34,.995),rgba(4,13,21,.995));box-shadow:0 30px 90px rgba(0,0,0,.58)}.rona-payments-v7-designer-head{flex:0 0 auto;display:flex;align-items:flex-start;justify-content:space-between;gap:22px;padding:17px 20px 16px;border-bottom:1px solid rgba(121,157,187,.12);background:rgba(8,21,32,.92)}.rona-payments-v7-designer-title-block{min-width:0}.rona-payments-v7-designer-eyebrow{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#7fa2bb}.rona-payments-v7-designer-title{margin:5px 0 0;font-size:23px;line-height:1.08;letter-spacing:-.015em;color:#f2f7fb;overflow-wrap:anywhere}.rona-payments-v7-designer-meta{display:flex;gap:8px 18px;flex-wrap:wrap;margin-top:7px;color:#8fa8ba;font-size:11px}.rona-payments-v7-designer-meta strong{color:#dce9f3;font-weight:750}.rona-payments-v7-designer-close{appearance:none;min-height:36px;border:1px solid rgba(126,170,203,.20);border-radius:9px;padding:8px 12px;background:rgba(13,31,45,.88);color:#dce9f3;font:inherit;font-size:11px;font-weight:850;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease}.rona-payments-v7-designer-close:hover{background:rgba(19,43,60,.98);border-color:rgba(126,170,203,.34)}.rona-payments-v7-designer-close:focus-visible{outline:2px solid rgba(106,178,229,.62);outline-offset:2px}.rona-payments-v7-designer-scroll{min-height:0;overflow:auto;padding:16px 18px 20px;overscroll-behavior:contain;scrollbar-gutter:stable}.rona-payments-v7-designer-unavailable{padding:18px;border:1px dashed rgba(242,187,103,.28);border-radius:11px;color:#e8cb99;background:rgba(43,30,13,.28)}html.rona-payments-v7-modal-open{overflow:hidden}@media(max-width:1180px){.rona-payments-v7-designer-overlay{padding:14px}.rona-payments-v7-designer-modal{width:min(1060px,calc(100vw - 28px));max-height:92vh}.rona-payments-v7-designer-head{padding:15px 17px}.rona-payments-v7-designer-scroll{padding:14px 16px 18px}}@media(max-width:820px){.rona-payments-v7-designer-overlay{padding:8px}.rona-payments-v7-designer-modal{width:calc(100vw - 16px);max-height:96vh;border-radius:14px}.rona-payments-v7-designer-head{padding:14px;gap:12px}.rona-payments-v7-designer-title{font-size:20px}.rona-payments-v7-designer-meta{display:grid;gap:4px}.rona-payments-v7-designer-scroll{padding:12px}}';
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
  const renderer=paymentsV7PassportOwnerTableRenderer();
  paymentsV7PassportCloseDesignerModal({restoreFocus:false});
  paymentsV7PassportInstallDesignerModalStyle();
  window.__ronaPaymentsV7PassportLastTrigger=trigger||null;

  const overlay=e('div',{id:PAYMENTS_V7_PASSPORT_MODAL_ID,class:'rona-payments-v7-designer-overlay','data-passport-renderer-contract':PAYMENTS_V7_PASSPORT_RENDERER_ACTIVATION,'data-owner-table-version':PAYMENTS_V7_PASSPORT_OWNER_TABLE_VERSION});
  const panel=e('section',{class:'rona-payments-v7-designer-modal',role:'dialog','aria-modal':'true','aria-labelledby':'ronaPaymentsV7PassportDesignerTitle'});
  const head=e('header',{class:'rona-payments-v7-designer-head'});
  const titleBlock=e('div',{class:'rona-payments-v7-designer-title-block'},
    e('div',{class:'rona-payments-v7-designer-eyebrow',text:'ПАСПОРТ ПЛАТЕЖА'}),
    e('h2',{id:'ronaPaymentsV7PassportDesignerTitle',class:'rona-payments-v7-designer-title',text:paymentsV7Text(deal?.deal_id)||'Сделка'}),
    e('div',{class:'rona-payments-v7-designer-meta'},e('span',{},'Клиент: ',e('strong',{text:paymentsV7Text(deal?.client_display)||'—'})))
  );
  const close=e('button',{type:'button',class:'rona-payments-v7-designer-close','data-passport-modal-close':'true',text:'Закрыть'});
  head.append(titleBlock,close);
  const scroll=e('div',{class:'rona-payments-v7-designer-scroll'});

  if(!deal||!passport||!renderer){
    scroll.append(e('div',{class:'rona-payments-v7-designer-unavailable',text:'Платёжный паспорт временно недоступен: актуальное представление не активировано.'}));
    overlay.dataset.passportRenderer='TO_VERIFY';
  }else{
    scroll.append(renderer(deal,passport));
    overlay.dataset.passportRenderer=renderer.name;
    overlay.dataset.passportRendererVersion=renderer.__ronaOwnerTableVersion;
  }
  panel.append(head,scroll);
  overlay.append(panel);
  (document.body?.appendChild?document.body:document.documentElement)?.appendChild?.(overlay);
  document.documentElement?.classList?.add?.('rona-payments-v7-modal-open');
  close.focus?.();
  return overlay;
}

if(!document.__ronaPaymentsV7PassportOwnerTableV2Bound){
  document.__ronaPaymentsV7PassportOwnerTableV2Bound=true;
  document.__ronaPaymentsV7PassportActivationBound=true;
  const ownerTableClickHandler=event=>{
    const target=event.target;
    const trigger=target?.closest?.('.rona-payments-v7-passport-trigger')||target?.closest?.('.rona-payments-v7-passport > summary');
    if(trigger){
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      event.stopPropagation?.();
      paymentsV7PassportStripInlineBody(trigger);
      paymentsV7OpenDesignerPassport(trigger);
      return;
    }
    if(target?.closest?.('[data-passport-modal-close="true"]')){
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      paymentsV7PassportCloseDesignerModal();
      return;
    }
    const overlay=q('#'+PAYMENTS_V7_PASSPORT_MODAL_ID);
    if(overlay&&target===overlay){
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      paymentsV7PassportCloseDesignerModal();
    }
  };
  document.__ronaPaymentsV7PassportOwnerTableV2Handler=ownerTableClickHandler;
  document.addEventListener('click',ownerTableClickHandler,true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&q('#'+PAYMENTS_V7_PASSPORT_MODAL_ID)){
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      paymentsV7PassportCloseDesignerModal();
    }
  },true);
}
`;