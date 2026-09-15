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
// The active Payments board is scoped inside the current Admin runtime IIFE. Keep the appended aggregate renderer inert here.
if(typeof globalThis.paymentsV7Projection!=='function')globalThis.paymentsV7Projection=()=>null;
`;

export const paymentsV7PassportActivationRuntime = String.raw`
const PAYMENTS_V7_PASSPORT_RENDERER_ACTIVATION='PAYMENTS_V7_PASSPORT_RENDERER_ACTIVATION_V1';
function paymentsV7PassportDealFromDetails(details){
  const article=details?.closest?.('.rona-payments-v7-deal');
  if(!article)return null;
  const projection=window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection;
  if(!projection||paymentsV7Text(projection?.contract)!=='ADMIN_PAYMENTS_V7')return null;
  const dealKey=paymentsV7Text(article?.dataset?.dealKey),dealId=paymentsV7Text(article?.dataset?.dealId);
  const deals=paymentsV7Array(projection?.deals);
  return deals.find(deal=>dealKey&&paymentsV7Text(deal?.deal_key)===dealKey)
    ||deals.find(deal=>dealId&&paymentsV7Text(deal?.deal_id)===dealId)
    ||null;
}
function paymentsV7ActivateRecoveredPassport(details){
  if(!details?.open)return;
  const summary=details.querySelector?.(':scope > summary')||details.querySelector?.('summary');
  if(!summary)return;
  for(const child of Array.from(details.children||[]))if(child!==summary)child.remove();
  const deal=paymentsV7PassportDealFromDetails(details);
  const passport=deal&&typeof paymentsV7OwnerPassport==='function'?paymentsV7OwnerPassport(deal):null;
  const renderer=typeof paymentsV7OwnerPassportBody==='function'?paymentsV7OwnerPassportBody:null;
  if(!deal||!passport||!renderer||renderer.name!=='paymentsV7OwnerPassportBodyRecovered'){
    details.append(e('div',{class:'rona-payments-v7-passport-body rona-payments-v7-owner-empty is-verify',text:'Платёжный паспорт временно недоступен: owner renderer не активирован.'}));
    details.dataset.passportRenderer='TO_VERIFY';
    return;
  }
  details.append(renderer(deal,passport));
  details.dataset.passportRenderer=renderer.name;
  details.dataset.passportRendererContract=PAYMENTS_V7_PASSPORT_RENDERER_ACTIVATION;
}
if(!document.__ronaPaymentsV7PassportActivationBound){
  document.__ronaPaymentsV7PassportActivationBound=true;
  document.addEventListener('click',event=>{
    const summary=event.target?.closest?.('.rona-payments-v7-passport > summary');
    if(!summary)return;
    const details=summary.parentElement;
    setTimeout(()=>paymentsV7ActivateRecoveredPassport(details),0);
  },true);
}
`;
