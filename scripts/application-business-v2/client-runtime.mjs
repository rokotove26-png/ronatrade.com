function line(source,prefix,next){const start=source.indexOf(prefix);if(start<0||source.indexOf(prefix,start+prefix.length)>=0)throw new Error('CLIENT_APPLICATION_ANCHOR_INVALID:'+prefix);const end=source.indexOf('\n',start);if(end<0)throw new Error('CLIENT_APPLICATION_LINE_END_MISSING');return source.slice(0,start)+next+source.slice(end)}
export function wireClientBusinessRuntime(source,validator){
 if(source.includes('RONA_CLIENT_APPLICATION_BUSINESS_CONSUMER_V2'))return source;
 let s=source.replace("const state={apps:[],contextKey:'',loading:false,reloadRequested:false,reloadForce:false","const state={kpi:null,bucket:'ACTIVE',openPassportId:null,reloadRequested:0,reloadForce:false,error:null,apps:[],contextKey:'',loading:false");
 s=s.replace("(()=>{'use strict';","(()=>{'use strict';\nconst BUSINESS_CONSUMER='RONA_CLIENT_APPLICATION_BUSINESS_CONSUMER_V2';\nconst validateBusinessProjection=(()=>{\n"+validator.replace(/export /g,'')+"\nreturn validateApplicationProjection;})();\n");
 s=s.replace("c=norm(a?.application_currency||'USD')","c=norm(a?.application_currency)");
 s=s.replace('${esc(priceText(app))}</div><button', '${applicationPriceMarkup(app)}</div><button');
 s=s.replace('${esc(terms)}</div>','${esc(terms)}<br>${esc(app.client_name)} / ${esc(app.contract_id)}</div>');
 // Preserve the open passport across canonical refreshes; context changes clear it explicitly.
 s=s.replace('aria-expanded="false">Открыть</button>','aria-expanded="${String(state.openPassportId===id)}">${state.openPassportId===id?"Скрыть":"Открыть"}</button>');
 s=s.replace('data-rona-application-details="${esc(id)}" hidden','data-rona-application-details="${esc(id)}" ${state.openPassportId===id?"":"hidden"}');
 // The business bucket navigation is a separate workspace above the rows, aligned to the same canonical frame.
 s=s.replace("list.dataset.ronaCanonicalFrame='applications-title-frame';\n  return true;","list.dataset.ronaCanonicalFrame='applications-title-frame';\n  const sections=r.querySelector('[data-rona-application-business-sections]');\n  if(sections){sections.style.boxSizing='border-box';sections.style.marginLeft=`${offset}px`;sections.style.marginRight='0';sections.style.width=`${width}px`;sections.style.minWidth='0';sections.style.maxWidth=`calc(100% - ${offset}px)`;sections.dataset.ronaCanonicalFrame='applications-title-frame'}\n  return true;");
 s=line(s,'function render(){',String.raw`function render(){
 const r=root();if(!r)return false;ensureStyle();retireLegacyApplicationsPresentation(r);const list=ensureList(r),sections=ensureBusinessSections(r,list);
 if(!state.kpi){sections.innerHTML='';list.innerHTML='<div class="rona-live-app-empty" role="status">'+(state.error?'\u0414\u0430\u043d\u043d\u044b\u0435 \u0437\u0430\u044f\u0432\u043e\u043a \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b.':'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026')+'</div>';scheduleAlign();return false}
 const f=currentFilter(r),rows=state.apps.filter(a=>state.bucket==='COMPLETED'?a.business_bucket==='COMPLETED':a.business_bucket!=='COMPLETED').filter(a=>matches(a,f));
 sections.innerHTML=businessSectionsMarkup();
 const previous=new Map([...list.querySelectorAll(':scope > [data-rona-live-application-id]')].map(node=>[norm(node.getAttribute('data-rona-live-application-id')),node]));
 const nodes=[];
 if(rows.length){for(const app of rows){const id=norm(app.application_id),template=document.createElement('template');template.innerHTML=rowHtml(app).trim();const fresh=template.content.firstElementChild,existing=previous.get(id);if(!fresh)continue;const summary=fresh.querySelector('.rona-live-app-summary'),offer=counterOfferMarkup(app);if(summary&&offer)summary.insertAdjacentHTML('beforeend',offer);if(existing){for(const attr of [...existing.attributes])if(!fresh.hasAttribute(attr.name))existing.removeAttribute(attr.name);for(const attr of [...fresh.attributes])existing.setAttribute(attr.name,attr.value);existing.innerHTML=fresh.innerHTML;nodes.push(existing)}else nodes.push(fresh)}}else{const empty=document.createElement('div');empty.className='rona-live-app-empty';empty.textContent=state.bucket==='COMPLETED'?'\u0417\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0445 \u0437\u0430\u044f\u0432\u043e\u043a \u043f\u043e \u0442\u0435\u043a\u0443\u0449\u0435\u043c\u0443 \u0444\u0438\u043b\u044c\u0442\u0440\u0443 \u043d\u0435\u0442.':'\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0437\u0430\u044f\u0432\u043e\u043a \u043f\u043e \u0442\u0435\u043a\u0443\u0449\u0435\u043c\u0443 \u0444\u0438\u043b\u044c\u0442\u0440\u0443 \u043d\u0435\u0442.';nodes.push(empty)}
 list.replaceChildren(...nodes);retireLegacyApplicationsPresentation(r);updateCounter(r,state.kpi.total);r.dataset.ronaApplicationsLiveRender='ready';scheduleAlign();window.dispatchEvent(new CustomEvent('rona:client-applications-rendered'));return true;
}`);
 s=line(s,'async function load(force=false){',String.raw`async function load(force=false){
 if(state.loading){state.reloadRequested=Math.max(state.reloadRequested,force?2:1);state.reloadForce=state.reloadForce||force;return}
 const ctx=await currentContext().catch(()=>null);if(!ctx){state.apps=[];state.kpi=null;state.error='CONTEXT_UNAVAILABLE';render();return}
 const key=contextKey(ctx);if(!key||key==='|')return;
 state.loading=true;
 try{
  const a=authority();if(!a?.whenCurrentProjection)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');
  const detail=force&&a.refreshCurrentProjection?await a.refreshCurrentProjection('applications-canonical'):await a.whenCurrentProjection('applications-canonical');
  if(contextKey(authority()?.getCurrentContext?.())!==key){state.reloadRequested=Math.max(state.reloadRequested,2);state.reloadForce=true;return}
  validateBusinessProjection({contract:detail?.application_business_contract,applications:detail?.applications,application_kpi:detail?.application_kpi},{clientId:norm(ctx.client_id),contractId:norm(ctx.contract_id)});
  state.apps=detail.applications;state.kpi=detail.application_kpi;state.error=null;state.contextKey=key;state.lastLoad=Date.now();render();
 }catch(error){const message=String(error?.message||'APPLICATION_PROJECTION_UNAVAILABLE');if(contextKey(authority()?.getCurrentContext?.())===key&&/CLIENT_CONTEXT_(?:PROJECTION_STALE_RESPONSE|CHANGED_DURING_PROJECTION|PROJECTION_UNAVAILABLE)/.test(message)){state.reloadRequested=Math.max(state.reloadRequested,1);return}state.apps=[];state.kpi=null;state.error=message;render();const r=root();if(r)r.dataset.ronaApplicationsLiveRender='error'}
 finally{state.loading=false;const retry=state.reloadRequested,forceRetry=state.reloadForce;state.reloadRequested=0;state.reloadForce=false;if(retry)queueMicrotask(()=>load(forceRetry||retry===2))}
}`);
 // The previous Open handler only disclosed a cached row; resolve fresh, scoped canonical data instead.
 const start=s.indexOf("const id=button.getAttribute('data-rona-open-application'),r=root(),detail="),end=s.indexOf('},true);window.addEventListener',start);
 if(start<0||end<0)throw new Error('CLIENT_PASSPORT_HANDLER_MISSING');
 s=s.slice(0,start)+'openCanonicalApplicationPassport(button)'+s.slice(end);
 s=s.replace("state.apps=[];state.contextKey='';state.lastLoad=0;load(false)","const next=a.getCurrentContext?.(),nextKey=contextKey(next),changed=!!nextKey&&nextKey!=='|'&&nextKey!==state.contextKey;if(changed){state.apps=[];state.kpi=null;state.openPassportId=null;state.contextKey='';state.lastLoad=0;render()}load(false)");
 // RONA_CLIENT_CONTEXT is the only projection authority. Pageshow and counter-offer presentation never launch a second collection fetch.
 s=s.replace("window.addEventListener('pageshow',()=>{load(false);scheduleAlign();setTimeout(observeLayout,0)},{passive:true})","window.addEventListener('pageshow',()=>{render();scheduleAlign();setTimeout(observeLayout,0)},{passive:true})");
 s=s.replace("setTimeout(queueDecorate,180);setTimeout(queueDecorate,980)","");
 s=s.replace("window.addEventListener('rona:client-applications-rendered',queueDecorate);","window.addEventListener('rona:client-applications-rendered',ensureCounterStyle);");
 s=s.replace("window.addEventListener('rona:client-application-submitted',queueDecorate);","window.addEventListener('rona:client-application-submitted',ensureCounterStyle);");
 s=s.replace("window.addEventListener('pageshow',queueDecorate,{passive:true});",'');
 s=s.replace("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queueDecorate,{once:true});else queueDecorate();","if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureCounterStyle,{once:true});else ensureCounterStyle();");
 const decorateStart=s.indexOf('async function decorate(){'),decorateEnd=s.indexOf('async function decide(button)',decorateStart);
 if(decorateStart<0||decorateEnd<0)throw new Error('CLIENT_COUNTER_OFFER_DECORATOR_BOUNDARY_MISSING');
 s=s.slice(0,decorateStart)+s.slice(decorateEnd);
 const helpers=String.raw`
function applicationPriceMarkup(app){if(app.application_price===null)return '\u2014';const value=esc(fmtNumber(app.application_price))+' '+esc(app.application_currency)+'/\u0442';return '<span'+(app.price_is_owner_agreed===true?' style="color:#2563eb;white-space:nowrap" data-application-agreed-price="true"':'')+'>'+value+'</span>'}
function ensureBusinessSections(r,list){
 let nav=r.querySelector('[data-rona-application-business-sections]');
 if(!nav){nav=document.createElement('nav');nav.setAttribute('data-rona-application-business-sections','v1');nav.setAttribute('aria-label','\u0420\u0430\u0437\u0434\u0435\u043b\u044b \u0437\u0430\u044f\u0432\u043e\u043a');nav.setAttribute('role','tablist');list.before(nav)}
 ensureBusinessSectionsStyle();return nav;
}
function ensureBusinessSectionsStyle(){if(document.getElementById('rona-client-application-sections-v1-style'))return;const style=document.createElement('style');style.id='rona-client-application-sections-v1-style';style.textContent='#page-applications [data-rona-application-business-sections]{position:relative;z-index:3;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0 8px;padding:0;box-sizing:border-box}#page-applications [data-rona-application-business-sections] .rona-application-section{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:48px;padding:0 16px;border:1px solid rgba(93,180,226,.24);border-radius:10px;background:linear-gradient(180deg,rgba(8,32,51,.82),rgba(5,22,37,.78));color:rgba(219,232,241,.88);font:760 13px/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.025);transition:border-color .14s ease,background .14s ease,transform .14s ease}#page-applications [data-rona-application-business-sections] .rona-application-section:hover{transform:translateY(-1px);border-color:rgba(112,205,241,.45)}#page-applications [data-rona-application-business-sections] .rona-application-section[aria-pressed="true"]{border-color:rgba(91,194,235,.55);background:linear-gradient(180deg,rgba(16,59,88,.90),rgba(8,35,56,.92));color:rgba(247,251,255,.98);box-shadow:0 5px 16px rgba(1,8,16,.14),inset 0 1px 0 rgba(255,255,255,.05)}#page-applications [data-rona-application-business-sections] .rona-application-section-count{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:26px;padding:0 9px;border-radius:999px;background:rgba(86,178,220,.12);font-weight:820;font-variant-numeric:tabular-nums}#page-applications [data-rona-live-applications="canonical-v1"]{margin-top:0!important}@media(max-width:650px){#page-applications [data-rona-application-business-sections]{grid-template-columns:1fr}}';document.head.appendChild(style)}
function businessSectionsMarkup(){return '<button type="button" role="tab" class="rona-application-section" data-application-bucket="ACTIVE" aria-selected="'+String(state.bucket==='ACTIVE')+'" aria-pressed="'+String(state.bucket==='ACTIVE')+'"><span>\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435</span><strong class="rona-application-section-count">'+esc(state.kpi?.active??0)+'</strong></button><button type="button" role="tab" class="rona-application-section" data-application-bucket="COMPLETED" aria-selected="'+String(state.bucket==='COMPLETED')+'" aria-pressed="'+String(state.bucket==='COMPLETED')+'"><span>\u0417\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435</span><strong class="rona-application-section-count">'+esc(state.kpi?.completed??0)+'</strong></button>'}
function counterOfferMarkup(app){
 const price=num(app?.counter_price),currency=norm(app?.counter_currency).toUpperCase(),response=norm(app?.client_counter_response).toUpperCase(),active=app?.counter_offer_active===true;
 const responseText=response==='ACCEPTED'?'\u0412\u0441\u0442\u0440\u0435\u0447\u043d\u043e\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u043f\u0440\u0438\u043d\u044f\u0442\u043e':response==='DECLINED'?'\u0412\u0441\u0442\u0440\u0435\u0447\u043d\u043e\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u043e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u043e':'';
 if(price===null||!currency||(!active&&!responseText))return '';
 const amount=esc(fmtNumber(price))+' '+esc(currency)+'/\u0442',separator='<span class="rona-counter-offer-separator" aria-hidden="true">\u00b7</span>';
 const actions=active?'<div class="rona-counter-offer-actions"><button type="button" class="rona-counter-offer-action" data-rona-counter-offer-decision="accept" data-application-id="'+esc(app.application_id)+'" data-decision="accept">\u041f\u0440\u0438\u043d\u044f\u0442\u044c</button><button type="button" class="rona-counter-offer-action" data-rona-counter-offer-decision="decline" data-application-id="'+esc(app.application_id)+'" data-decision="decline">\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c</button></div>':'';
 return '<div class="rona-counter-offer-panel" data-rona-counter-offer-panel="v2" data-rona-counter-offer-active="'+String(active)+'"><div class="rona-counter-offer-copy"><span>\u0412\u0441\u0442\u0440\u0435\u0447\u043d\u043e\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 RONA Trade</span>'+separator+'<strong class="rona-counter-offer-price" data-rona-counter-offer-price="true">'+amount+'</strong>'+(responseText?separator+'<span class="rona-counter-offer-state">'+responseText+'</span>':'')+'</div>'+actions+'</div>';
}
async function openCanonicalApplicationPassport(button){
 if(button.disabled)return;
 const id=norm(button.getAttribute('data-rona-open-application')),ctx=authority()?.getCurrentContext?.(),key=contextKey(ctx);
 if(!id||!ctx)return;
 if(state.openPassportId===id){state.openPassportId=null;render();return}
 button.disabled=true;
 try{
  const result=await request('/v1/client/applications/'+encodeURIComponent(id)+'/passport?clientId='+encodeURIComponent(ctx.client_id)+'&contractId='+encodeURIComponent(ctx.contract_id));
  if(contextKey(authority()?.getCurrentContext?.())!==key)return;
  const app=result?.data?.application;
  if(result?.data?.business_contract!=='RONA_APPLICATION_BUSINESS_V2'||app?.application_id!==id||app?.client_id!==ctx.client_id||app?.contract_id!==ctx.contract_id)throw new Error('APPLICATION_PASSPORT_SCOPE_INVALID');
  if(!state.apps.some(row=>row.application_id===id))return;
  state.apps=state.apps.map(row=>row.application_id===id?app:row);
  state.openPassportId=id;render();
 }catch(error){state.error=String(error?.message||'APPLICATION_PASSPORT_UNAVAILABLE');await load(true)}
 finally{button.disabled=false}
}
document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-application-bucket]');if(button&&root()?.contains(button)){const next=button.dataset.applicationBucket;if(next==='ACTIVE'||next==='COMPLETED'){state.bucket=next;state.openPassportId=null;render()}}},true);
`;
 s=s.replace('function observeLayout()',helpers+'\nfunction observeLayout()');
 if(s.includes("if(force)a.invalidateCurrentProjection?.()"))throw new Error('CLIENT_APPLICATION_RUNTIME_FORCE_INVALIDATION_NOT_RETIRED');
 if(s.includes('REFRESH_MS')||s.includes('setInterval('))throw new Error('CLIENT_APPLICATION_RUNTIME_RECURRING_REFRESH_NOT_RETIRED');
 if(s.includes("window.addEventListener('pageshow',()=>{load(true)"))throw new Error('CLIENT_APPLICATION_RUNTIME_PAGESHOW_FETCH_NOT_RETIRED');
 if(s.includes("window.addEventListener('pageshow',queueDecorate"))throw new Error('CLIENT_COUNTER_OFFER_PAGESHOW_FETCH_NOT_RETIRED');
 if(s.includes("window.addEventListener('rona:client-applications-rendered',queueDecorate)"))throw new Error('CLIENT_COUNTER_OFFER_ASYNC_DECORATOR_NOT_RETIRED');
 if(s.includes("whenCurrentProjection('client-counter-offer-canonical')"))throw new Error('CLIENT_COUNTER_OFFER_SECOND_PROJECTION_NOT_RETIRED');
 return s;
}
