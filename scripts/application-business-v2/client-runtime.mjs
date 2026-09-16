function line(source,prefix,next){const start=source.indexOf(prefix);if(start<0||source.indexOf(prefix,start+prefix.length)>=0)throw new Error('CLIENT_APPLICATION_ANCHOR_INVALID:'+prefix);const end=source.indexOf('\n',start);if(end<0)throw new Error('CLIENT_APPLICATION_LINE_END_MISSING');return source.slice(0,start)+next+source.slice(end)}
export function wireClientBusinessRuntime(source,validator){
 if(source.includes('RONA_CLIENT_APPLICATION_BUSINESS_CONSUMER_V2'))return source;
 let s=source.replace("const state={apps:[]","const state={kpi:null,bucket:'ACTIVE',reloadRequested:false,error:null,apps:[]");
 s=s.replace("(()=>{'use strict';","(()=>{'use strict';\nconst BUSINESS_CONSUMER='RONA_CLIENT_APPLICATION_BUSINESS_CONSUMER_V2';\nconst validateBusinessProjection=(()=>{\n"+validator.replace(/export /g,'')+"\nreturn validateApplicationProjection;})();\n");
 s=s.replace("c=norm(a?.application_currency||'USD')","c=norm(a?.application_currency)");
 s=s.replace('${esc(priceText(app))}</div><button', '${applicationPriceMarkup(app)}</div><button');
 s=s.replace('${esc(terms)}</div>','${esc(terms)}<br>${esc(app.client_name)} / ${esc(app.contract_id)}</div>');
 s=line(s,'function render(){',String.raw`function render(){
 const r=root();if(!r)return false;ensureStyle();retireLegacyApplicationsPresentation(r);const list=ensureList(r);
 if(!state.kpi){list.innerHTML='<div class="rona-live-app-empty" role="status">'+(state.error?'\u0414\u0430\u043d\u043d\u044b\u0435 \u0437\u0430\u044f\u0432\u043e\u043a \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b.':'\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026')+'</div>';return false}
 const f=currentFilter(r),rows=state.apps.filter(a=>state.bucket==='COMPLETED'?a.business_bucket==='COMPLETED':a.business_bucket!=='COMPLETED').filter(a=>matches(a,f));
 const tabs='<div class="rona-live-app-state-strip" data-rona-application-business-controls><button type="button" class="rona-live-app-open" data-application-bucket="ACTIVE" aria-pressed="'+String(state.bucket==='ACTIVE')+'">\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u00b7 '+esc(state.kpi.active)+'</button><button type="button" class="rona-live-app-open" data-application-bucket="COMPLETED" aria-pressed="'+String(state.bucket==='COMPLETED')+'">\u0417\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435 \u00b7 '+esc(state.kpi.completed)+'</button><span data-application-tonnage>'+esc(fmtNumber(state.kpi.tonnage))+' \u0442</span></div>';
 list.innerHTML=tabs+(rows.length?rows.map(rowHtml).join(''):'<div class="rona-live-app-empty">\u041f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c\u0443 \u0444\u0438\u043b\u044c\u0442\u0440\u0443 \u0437\u0430\u044f\u0432\u043e\u043a \u043d\u0435\u0442.</div>');
 updateCounter(r,state.kpi.total);r.dataset.ronaApplicationsLiveRender='ready';scheduleAlign();window.dispatchEvent(new CustomEvent('rona:client-applications-rendered'));return true;
}`);
 s=line(s,'async function load(force=false){',String.raw`async function load(force=false){
 if(state.loading){state.reloadRequested=true;return}
 const ctx=await currentContext().catch(()=>null);if(!ctx){state.apps=[];state.kpi=null;state.error='CONTEXT_UNAVAILABLE';render();return}
 const key=contextKey(ctx);if(!key||key==='|')return;
 if(!force&&state.contextKey===key&&Date.now()-state.lastLoad<REFRESH_MS){render();return}
 state.loading=true;
 try{
  const a=authority();if(!a?.whenCurrentProjection)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');
  if(force)a.invalidateCurrentProjection?.();
  const detail=await a.whenCurrentProjection('applications-canonical');
  if(contextKey(authority()?.getCurrentContext?.())!==key){state.reloadRequested=true;return}
  validateBusinessProjection({contract:detail?.application_business_contract,applications:detail?.applications,application_kpi:detail?.application_kpi},{clientId:norm(ctx.client_id),contractId:norm(ctx.contract_id)});
  state.apps=detail.applications;state.kpi=detail.application_kpi;state.error=null;state.contextKey=key;state.lastLoad=Date.now();render();
 }catch(error){state.apps=[];state.kpi=null;state.error=String(error?.message||'APPLICATION_PROJECTION_UNAVAILABLE');render();const r=root();if(r)r.dataset.ronaApplicationsLiveRender='error'}
 finally{state.loading=false;if(state.reloadRequested){state.reloadRequested=false;queueMicrotask(()=>load(true))}}
}`);
 // The previous Open handler only disclosed a cached row; resolve fresh, scoped canonical data instead.
 const start=s.indexOf("const id=button.getAttribute('data-rona-open-application'),r=root(),detail="),end=s.indexOf('},true);window.addEventListener',start);
 if(start<0||end<0)throw new Error('CLIENT_PASSPORT_HANDLER_MISSING');
 s=s.slice(0,start)+'openCanonicalApplicationPassport(button)'+s.slice(end);
 s=s.replace("state.apps=[];state.contextKey='';state.lastLoad=0;load(true)","state.apps=[];state.kpi=null;state.contextKey='';state.lastLoad=0;render();load(true)");
 const helpers=String.raw`
function applicationPriceMarkup(app){if(app.application_price===null)return '\u2014';return '<span'+(app.price_is_owner_agreed===true?' style="color:#2563eb" data-application-agreed-price="true"':'')+'>'+esc(fmtNumber(app.application_price))+'</span> '+esc(app.application_currency)+'/\u0442'}
async function openCanonicalApplicationPassport(button){
 if(button.disabled)return;
 const id=norm(button.getAttribute('data-rona-open-application')),ctx=authority()?.getCurrentContext?.(),key=contextKey(ctx);
 if(!/^.+-IN-[0-9]{4}-[0-9]{3,}$/.test(id)||!ctx)return;
 button.disabled=true;
 try{
  const result=await request('/v1/client/applications/'+encodeURIComponent(id)+'/passport?clientId='+encodeURIComponent(ctx.client_id)+'&contractId='+encodeURIComponent(ctx.contract_id));
  if(contextKey(authority()?.getCurrentContext?.())!==key)return;
  const app=result?.data?.application;
  if(result?.data?.business_contract!=='RONA_APPLICATION_BUSINESS_V2'||app?.application_id!==id||app?.client_id!==ctx.client_id||app?.contract_id!==ctx.contract_id)throw new Error('APPLICATION_PASSPORT_SCOPE_INVALID');
  const row=button.closest('[data-rona-live-application-id]');if(!row)return;row.outerHTML=rowHtml(app);
  const current=root()?.querySelector('[data-rona-live-application-id="'+CSS.escape(id)+'"]');
  const detail=current?.querySelector('[data-rona-application-details]');if(detail)detail.hidden=false;
  current?.querySelector('[data-rona-open-application]')?.setAttribute('aria-expanded','true');scheduleAlign();
 }catch(error){state.error=String(error?.message||'APPLICATION_PASSPORT_UNAVAILABLE');await load(true)}
 finally{button.disabled=false}
}
document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-application-bucket]');if(button&&root()?.contains(button)){state.bucket=button.dataset.applicationBucket;render()}},true);
`;
 return s.replace('function observeLayout()',helpers+'\nfunction observeLayout()');
}
