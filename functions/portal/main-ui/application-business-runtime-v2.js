import {validateApplicationProjection} from '../application-business-contract-v2.js';
function replaceLine(source,prefix,replacement){const start=source.indexOf(prefix);if(start<0||source.indexOf(prefix,start+prefix.length)>=0)throw new Error('APPLICATION_RUNTIME_ANCHOR_INVALID:'+prefix);const end=source.indexOf('\n',start);if(end<0)throw new Error('APPLICATION_RUNTIME_LINE_END_MISSING');return source.slice(0,start)+replacement+source.slice(end)}
export function patchApplicationBusinessRuntime(source){
 if(source.includes('RONA_ADMIN_APPLICATION_BUSINESS_V2'))return source;
 let s=source;
 s=replaceLine(s,'function application2BBucket(a){',String.raw`function application2BBucket(a){if(a?.business_contract!=='RONA_APPLICATION_BUSINESS_V2'||!['NEW','WORK','DECISION','COMPLETED'].includes(a.business_bucket))throw new Error('APPLICATION_CANONICAL_BUCKET_REQUIRED');return a.business_bucket}`);
 s=replaceLine(s,'function application2BPrice(a){',String.raw`function application2BPrice(a){const box=e('div',{class:'rona-app-price'});if(a.application_price===null){box.append(e('span',{text:'\u2014'}));return box}const number=e('span',{text:new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(Number(a.application_price))});if(a.price_is_owner_agreed===true){number.style.color='#2563eb';number.dataset.applicationAgreedPrice='true'}box.append(number,e('span',{text:' '+a.application_currency+'/\u0442'}));return box}`);
 const actionStart=s.indexOf('function application2BActions(a){'),actionEnd=s.indexOf('\n',actionStart);
 if(actionStart<0||actionEnd<0)throw new Error('APPLICATION_ACTIONS_SOURCE_MISSING');
 const original=s.slice(actionStart,actionEnd).replace('function application2BActions(a){','function application2BLegacyBusinessActions(a){');
 s=s.slice(0,actionStart)+original+'\n'+String.raw`function application2BActions(a){const legacy=application2BLegacyBusinessActions(a);if(legacy?.getAttribute?.('data-rona-app-passport-open')||legacy?.querySelector?.('[data-rona-app-passport-open]'))return legacy;const box=e('div',{class:'rona-owner-actions rona-app-actions'});box.append(e('button',{type:'button','data-rona-app-passport-open':a.application_id,text:'\u041e\u0442\u043a\u0440\u044b\u0442\u044c'}));if(legacy)box.append(legacy);return box}`+s.slice(actionEnd);
 // The existing renderer still owns the table, layout and business actions. Replace only its source of counts.
 const prefix='renderApplications=function(){ensureApplications2BStyle();',start=s.indexOf(prefix),end=s.indexOf('\n',start);
 if(start<0||end<0)throw new Error('APPLICATION_TABLE_RENDERER_MISSING');
 let render=s.slice(start,end);
 const old="const buckets={NEW:0,WORK:0,DECISION:0,COMPLETED:0};for(const a of rows)buckets[application2BBucket(a)]++;const dealCount=rows.filter(application2BHasDeal).length;";
 if(!render.includes(old))throw new Error('APPLICATION_KPI_SOURCE_ANCHOR_MISSING');
 render=render.replace(old,"if(adminData?.application_business_contract!=='RONA_APPLICATION_BUSINESS_V2'||adminData?.application_kpi?.source!=='RONA_APPLICATION_BUSINESS_V2'){replacePage('applications',e('div',{role:'alert',text:'APPLICATION_CANONICAL_PROJECTION_UNAVAILABLE'}));return}const kpi=adminData.application_kpi,buckets={NEW:kpi.new,WORK:kpi.in_work,DECISION:kpi.decision,COMPLETED:kpi.completed};const dealCount=kpi.deal_registered;");
 render=render.replace("a.legal_name||'\u2014'","a.client_name");
 s=s.slice(0,start)+render+s.slice(end);
 s=replaceLine(s,'async function canonicalPassportResolver(id){',String.raw`async function canonicalPassportResolver(id){const applicationId=String(id||'').trim();if(!/^.+-IN-[0-9]{4}-[0-9]{3,}$/.test(applicationId))throw new Error('CANONICAL_APPLICATION_ID_REQUIRED');const data=await authoritativeJson('/portal/api/v1/admin/applications/'+encodeURIComponent(applicationId)+'/passport','APPLICATION_PASSPORT_UNAVAILABLE');const owner=data.application;if(data.business_contract!=='RONA_APPLICATION_BUSINESS_V2'||owner?.application_id!==applicationId||owner?.business_contract!=='RONA_APPLICATION_BUSINESS_V2')throw new Error('APPLICATION_PASSPORT_IDENTITY_MISMATCH');return{applicationId,owner,coreApplication:owner,intake:{payload:owner.source_form_payload}}}`);
 const fieldsAt=s.indexOf('function storedFields(owner,coreApp,payload){'),fieldsEnd=s.indexOf('\n',fieldsAt);
 if(fieldsAt<0||fieldsEnd<0)throw new Error('APPLICATION_PASSPORT_FIELDS_MISSING');
 let fields=s.slice(fieldsAt,fieldsEnd);
 fields=fields.replaceAll('coreApp?.proposed_price??owner?.proposed_price','owner?.application_price').replaceAll('coreApp?.proposed_currency??owner?.proposed_currency','owner?.application_currency');
 s=s.slice(0,fieldsAt)+fields+s.slice(fieldsEnd);
 // Marker is evidence of generated integration; no monkey-patched secondary Applications renderer.
 return s+'\n/* RONA_ADMIN_APPLICATION_BUSINESS_V2 */\n';
}
export {validateApplicationProjection};
