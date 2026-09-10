(()=>{'use strict';
const MARK='20260910-client-counter-offer-hotfix-v1';
if(window.__RONA_CLIENT_COUNTER_OFFER_HOTFIX__===MARK)return;
window.__RONA_CLIENT_COUNTER_OFFER_HOTFIX__=MARK;
if(!/^\/portal\/client\/?$/.test(location.pathname))return;

const norm=value=>String(value??'').trim();
const num=value=>{const n=Number(value);return Number.isFinite(n)?n:null};
const fmt=value=>{const n=num(value);return n===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(n)};
const authority=()=>window.RONA_CLIENT_CONTEXT||null;
let decorateToken=0;

function ensureStyle(){
  if(document.getElementById('rona-client-counter-offer-hotfix-style'))return;
  const style=document.createElement('style');
  style.id='rona-client-counter-offer-hotfix-style';
  style.textContent=`
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-panel{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(93,180,226,.24);border-radius:9px;background:rgba(10,42,63,.54);color:rgba(232,243,250,.96)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-copy{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0;font:680 12.4px/1.35 Inter,system-ui,sans-serif}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-price{color:rgba(225,248,238,.98);font-weight:820;font-size:13.6px;white-space:nowrap}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-state{color:rgba(205,222,234,.82);font-size:11.8px}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-action{min-height:30px;padding:0 12px;border:1px solid rgba(93,180,226,.34);border-radius:8px;background:linear-gradient(180deg,rgba(16,58,86,.86),rgba(7,34,54,.90));color:rgba(241,248,252,.96);font:760 11.8px/1 Inter,system-ui,sans-serif;cursor:pointer}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-action[data-decision="accept"]{border-color:rgba(90,187,161,.34);background:rgba(29,93,77,.34)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-action:disabled{opacity:.55;cursor:wait}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-error{width:100%;color:#f2b7b7;font:650 11.5px/1.35 Inter,system-ui,sans-serif}
`;
  document.head.appendChild(style);
}
function offerPrice(app){const price=num(app?.counter_price),currency=norm(app?.counter_currency).toUpperCase();return price===null||!currency?'':`${fmt(price)} ${currency}/т`}
function responseLabel(app){const response=norm(app?.client_counter_response).toUpperCase();if(response==='ACCEPTED')return'Встречное предложение принято';if(response==='DECLINED')return'Встречное предложение отклонено';return''}
function makePanel(app){
  const price=offerPrice(app),active=app?.counter_offer_active===true,response=responseLabel(app);
  if(!price||(!active&&!response))return null;
  const panel=document.createElement('div');panel.className='rona-counter-offer-panel';panel.dataset.ronaCounterOfferPanel='v1';panel.dataset.ronaCounterOfferActive=String(active);
  const copy=document.createElement('div');copy.className='rona-counter-offer-copy';
  const label=document.createElement('span');label.textContent='Встречное предложение RONA Trade';
  const amount=document.createElement('strong');amount.className='rona-counter-offer-price';amount.textContent=price;
  copy.append(label,amount);
  if(response){const state=document.createElement('span');state.className='rona-counter-offer-state';state.textContent=response;copy.append(state)}
  panel.append(copy);
  if(active){
    const actions=document.createElement('div');actions.className='rona-counter-offer-actions';
    for(const [decision,title] of [['accept','Принять'],['decline','Отклонить']]){const button=document.createElement('button');button.type='button';button.className='rona-counter-offer-action';button.dataset.ronaCounterOfferDecision=decision;button.dataset.applicationId=norm(app?.application_id);button.dataset.decision=decision;button.textContent=title;actions.append(button)}
    panel.append(actions);
  }
  return panel;
}
async function decorate(){
  const token=++decorateToken,a=authority();if(!a?.whenCurrentProjection)return;
  let projection;try{projection=await a.whenCurrentProjection('client-counter-offer-hotfix')}catch{return}
  if(token!==decorateToken)return;
  const apps=Array.isArray(projection?.applications)?projection.applications:[],byId=new Map(apps.map(app=>[norm(app?.application_id),app]).filter(([id])=>id));
  const root=document.querySelector('#page-applications [data-rona-live-applications="canonical-v1"]');if(!root)return;
  ensureStyle();
  for(const row of root.querySelectorAll('[data-rona-live-application-id]')){
    row.querySelector('[data-rona-counter-offer-panel]')?.remove();
    const app=byId.get(norm(row.getAttribute('data-rona-live-application-id')));if(!app)continue;
    const panel=makePanel(app);if(panel){const summary=row.querySelector('.rona-live-app-summary');(summary||row).append(panel)}
  }
}
function queueDecorate(){setTimeout(()=>decorate(),0)}
async function decide(button){
  const id=norm(button?.dataset?.applicationId),decision=norm(button?.dataset?.ronaCounterOfferDecision);if(!id||!['accept','decline'].includes(decision))return;
  const panel=button.closest('[data-rona-counter-offer-panel]'),buttons=[...(panel?.querySelectorAll('button')||[])];buttons.forEach(x=>x.disabled=true);
  panel?.querySelector('.rona-counter-offer-error')?.remove();
  try{
    const backendPath=`/client/applications/${encodeURIComponent(id)}/counter-offer/${decision}`;
    const response=await fetch('/portal/owner-api?path='+encodeURIComponent(backendPath),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','content-type':'application/json'},body:'{}'});
    const payload=await response.json().catch(()=>null);if(!response.ok||payload?.ok===false)throw new Error(String(payload?.code||('HTTP_'+response.status)));
    authority()?.invalidateCurrentProjection?.();
    window.dispatchEvent(new CustomEvent('rona:client-application-submitted',{detail:{source:'COUNTER_OFFER_RESPONSE'}}));
    setTimeout(queueDecorate,180);setTimeout(queueDecorate,980);
  }catch(error){
    buttons.forEach(x=>x.disabled=false);if(panel){const message=document.createElement('div');message.className='rona-counter-offer-error';message.textContent='Не удалось сохранить ответ. Обновите данные и повторите действие.';panel.append(message)}
    console.error('RONA client counter-offer response',error);
  }
}

document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-rona-counter-offer-decision]');if(button)decide(button)},true);
window.addEventListener('rona:client-applications-rendered',queueDecorate);
window.addEventListener('rona:client-application-submitted',queueDecorate);
window.addEventListener('pageshow',queueDecorate,{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queueDecorate,{once:true});else queueDecorate();
})();
