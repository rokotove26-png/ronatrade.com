import { onRequest as serveCurrentAdminUi } from '../admin-main-ui-current.js';

const BUCKET_FROM="function application2BBucket(a){const owner=String(a?.owner_status||'').toUpperCase(),app=String(a?.status||'').toUpperCase(),deal=String(a?.deal_status||'').toUpperCase();if(owner==='REJECTED'||owner==='CANCELLED'||owner==='SUPPLIER_APPROVED'||owner==='DEAL'||app==='CANCELLED'||(app==='DEAL_REGISTERED'&&deal!=='SUPPLIER_PENDING'))return'COMPLETED';if(owner==='COUNTER_OFFERED'||owner==='SUPPLIER_PENDING'||deal==='SUPPLIER_PENDING')return'DECISION';if(owner==='NEW'||!owner)return'NEW';return'WORK'}";
const BUCKET_TO="function application2BBucket(a){const owner=String(a?.owner_status||'').toUpperCase(),app=String(a?.status||'').toUpperCase(),deal=String(a?.deal_status||'').toUpperCase();if(owner==='REJECTED'||owner==='CANCELLED'||owner==='DEAL'||app==='CANCELLED'||(app==='DEAL_REGISTERED'&&deal!=='SUPPLIER_PENDING'))return'COMPLETED';if(owner==='COUNTER_OFFERED'||owner==='SUPPLIER_PENDING'||deal==='SUPPLIER_PENDING')return'DECISION';if(owner==='NEW'||!owner)return'NEW';return'WORK'}";
const ACTIONS_FROM="function application2BActions(a){const bucket=application2BBucket(a),owner=String(a?.owner_status||'').toUpperCase(),deal=String(a?.deal_status||'').toUpperCase();if(bucket==='DECISION'&&(owner==='SUPPLIER_PENDING'||deal==='SUPPLIER_PENDING')){const box=e('div',{class:'rona-owner-actions rona-app-actions'});const run=async(action,body={})=>{try{await post('/admin/applications/'+encodeURIComponent(a.application_id)+'/'+action,body);await refreshAdmin()}catch(err){await notify(err.code||err.message,'Ошибка')}};box.append(e('button',{text:'Ресурс одобрен',onclick:()=>run('supplier-approved')}),e('button',{text:'В ресурсе отказано',onclick:()=>run('cancel',{reason:'SUPPLIER_RESOURCE_DENIED'})}));return box}if(bucket==='COMPLETED')return e('span',{class:'rona-owner-muted',text:'—'});return applicationActions(a)}";
const ACTIONS_TO="function application2BActions(a){const bucket=application2BBucket(a),owner=String(a?.owner_status||'').toUpperCase(),deal=String(a?.deal_status||'').toUpperCase();const run=async(action,body={})=>{try{await post('/admin/applications/'+encodeURIComponent(a.application_id)+'/'+action,body);await refreshAdmin()}catch(err){await notify(err.code||err.message,'Ошибка')}};if(owner==='SUPPLIER_APPROVED'&&!a?.deal_id){const box=e('div',{class:'rona-owner-actions rona-app-actions'});box.append(e('button',{text:'Отправить в сделки',onclick:()=>run('accept')}));return box}if(bucket==='DECISION'&&(owner==='SUPPLIER_PENDING'||deal==='SUPPLIER_PENDING')){const box=e('div',{class:'rona-owner-actions rona-app-actions'});box.append(e('button',{text:'Ресурс одобрен',onclick:()=>run('supplier-approved')}),e('button',{text:'В ресурсе отказано',onclick:()=>run('cancel',{reason:'SUPPLIER_RESOURCE_DENIED'})}));return box}if(bucket==='COMPLETED')return e('span',{class:'rona-owner-muted',text:'—'});return applicationActions(a)}";

export async function onRequest(context){
  const response=await serveCurrentAdminUi(context);
  const source=await response.text();
  if(!source.includes(BUCKET_FROM)||!source.includes(ACTIONS_FROM)){
    return new Response('APPLICATION_DEAL_HANDOFF_PATCH_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  const patched=source.replace(BUCKET_FROM,BUCKET_TO).replace(ACTIONS_FROM,ACTIONS_TO);
  const headers=new Headers(response.headers);
  headers.set('content-length',String(new TextEncoder().encode(patched).length));
  headers.set('x-rona-application-deal-handoff','approved-to-deal-v1');
  return new Response(patched,{status:response.status,statusText:response.statusText,headers});
}
