import postgres from "npm:postgres@3.4.7";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"https://sxawrwzeobaqwwmlkzws.supabase.co";
const DB=Deno.env.get("SUPABASE_DB_URL");
if(!DB)throw new Error("SUPABASE_DB_URL missing");
const sql=postgres(DB,{prepare:false,max:2,idle_timeout:1,connect_timeout:3,max_lifetime:15});
const PROD=`${SUPABASE_URL}/functions/v1/rona-portal-api`;
const SLUG='rona-portal-api-candidate-20260817';
const BACKEND='PR431_UAT_CANDIDATE_AUTHORIZED_DIRECTORY_V1';
const DIRECTORY_SOURCE='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB';
const METRIC_SOURCE='AUTHORITATIVE_CURRENT_CONTEXT_DB';
const DOCUMENTS_PREDICATE='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY';

function routeOf(pathname:string){const marker=`/${SLUG}`;const i=pathname.indexOf(marker);return i>=0?(pathname.slice(i+marker.length)||'/'):pathname}
function send(status:number,body:unknown,headersIn?:Headers){const headers=new Headers(headersIn||undefined);headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store, no-cache, must-revalidate');headers.set('pragma','no-cache');headers.set('x-rona-portal-backend-slot','candidate');headers.set('x-rona-portal-backend-function',SLUG);headers.set('x-rona-portal-backend-version',BACKEND);headers.delete('content-length');headers.delete('etag');return new Response(JSON.stringify(body,(_k,v)=>typeof v==='bigint'?v.toString():v),{status,headers})}
async function proxy(req:Request,route:string,search:string){const headers=new Headers();for(const name of ['authorization','content-type','accept','x-request-id','x-correlation-id','x-idempotency-key','x-current-document-id','x-rona-client-source']){const value=req.headers.get(name);if(value)headers.set(name,value)}if(!headers.has('accept'))headers.set('accept','application/json');const init:RequestInit={method:req.method,headers};if(!['GET','HEAD'].includes(req.method))init.body=await req.clone().arrayBuffer();return fetch(`${PROD}${route}${search}`,init)}
const norm=(v:unknown)=>String(v??'').trim();

async function directoryRow(ctx:any){
  const clientId=norm(ctx?.client_id),contractId=norm(ctx?.contract_id);if(!clientId||!contractId)return null;
  const metricRows=await sql`
    select
      (select count(*)::int from portal_private.client_applications a join portal_private.clients cl on cl.id=a.client_key join portal_private.contracts ct on ct.id=a.contract_key where cl.client_id=${clientId} and ct.contract_id=${contractId}) as applications_total,
      (select count(*)::int from portal_private.deals d join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key where cl.client_id=${clientId} and ct.contract_id=${contractId} and d.lifecycle_state::text='ACTIVE') as deals_total,
      (select count(*)::int from portal_private.documents d join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key join portal_private.document_versions dv on dv.id=d.current_version_id where cl.client_id=${clientId} and ct.contract_id=${contractId} and d.lifecycle_state::text='ACTIVE' and d.authority_state::text in ('VERIFIED','CONFIRMED') and dv.lifecycle_state::text='ACTIVE' and dv.authority_state::text in ('VERIFIED','CONFIRMED') and dv.is_current is true and dv.is_effective is true and (upper(d.document_type) like '%CONTRACT%' or upper(d.document_type) like '%КОНТРАКТ%' or upper(d.document_type) like '%ДОГОВОР%' or upper(d.document_type) like '%ADDENDUM%' or upper(d.document_type) like '%ADDITIONAL AGREEMENT%' or upper(d.document_type) like '%ДОПОЛНИТЕЛЬН%' or upper(d.document_type) like '%INVOICE%' or upper(d.document_type) like '%ИНВОЙС%')) as documents_total
  `;
  const contractRows=await sql`
    select d.document_id,so.storage_object_id,coalesce(nullif(trim(dv.authoritative_filename),''),nullif(trim(d.authoritative_filename),''),'Договор.pdf') as authoritative_filename
      from portal_private.contracts ct
      join portal_private.clients cl on cl.id=ct.client_key
      join portal_private.documents d on d.id=ct.current_signed_document_id and d.client_key=cl.id and d.contract_key=ct.id
      join portal_private.document_versions dv on dv.id=d.current_version_id
      join lateral (select s.storage_object_id from portal_private.storage_objects s where s.document_version_key=dv.id and s.client_key=cl.id and s.contract_key=ct.id and s.storage_state::text='VERIFIED' order by s.created_at desc limit 1) so on true
     where cl.client_id=${clientId} and ct.contract_id=${contractId}
       and ct.signed_contract_confirmed_at is not null
       and d.lifecycle_state::text='ACTIVE' and d.authority_state::text in ('VERIFIED','CONFIRMED')
       and dv.lifecycle_state::text='ACTIVE' and dv.authority_state::text in ('VERIFIED','CONFIRMED')
       and dv.is_current is true and dv.is_effective is true
     limit 1
  `;
  const m:any=metricRows[0]||{},c:any=contractRows[0]||null;
  return {
    client_id:clientId,legal_name:norm(ctx?.legal_name),registration_country:norm(ctx?.registration_country),
    contract_id:contractId,current_external_contract_number:norm(ctx?.current_external_contract_number),contract_status:norm(ctx?.contract_status),effective_from:ctx?.effective_from||null,effective_to:ctx?.effective_to||null,
    applications_total:Number(m.applications_total||0),deals_total:Number(m.deals_total||0),documents_total:Number(m.documents_total||0),documents_predicate:DOCUMENTS_PREDICATE,source:DIRECTORY_SOURCE,
    current_signed_contract:c?{document_id:norm(c.document_id),storage_object_id:norm(c.storage_object_id),authoritative_filename:norm(c.authoritative_filename)}:null
  };
}

async function enrichBootstrap(payload:any){const contexts=Array.isArray(payload?.data?.contexts)?payload.data.contexts:[];const rows=[];for(const ctx of contexts){const row=await directoryRow(ctx);if(row)rows.push(row)}payload.data.company_directory=rows;payload.data.company_directory_source=DIRECTORY_SOURCE;return payload}

async function enrichContext(payload:any,clientId:string,contractId:string){
  const responseClientId=norm(payload?.data?.contract?.client_id||payload?.data?.context?.client_id||payload?.data?.client?.client_id);
  const responseContractId=norm(payload?.data?.contract?.contract_id||payload?.data?.context?.contract_id);
  if(responseClientId!==clientId||responseContractId!==contractId)throw new Error('CONTEXT_SCOPE_MISMATCH');
  const applications=Array.isArray(payload?.data?.applications)?payload.data.applications:[];
  const ids=[...new Set(applications.map((a:any)=>norm(a?.application_id)).filter(Boolean))];
  if(ids.length){
    const rows=await sql`
      select a.application_id,line.application_price,line.application_currency,
             case when coalesce(resource.resource_status,'')='RESOURCE_CONFIRMED' then 'RESOURCE_CONFIRMED' when w.supplier_approved_at is not null then 'RESOURCE_CONFIRMED' else 'RESOURCE_NOT_CONFIRMED' end as resource_status,
             case when coalesce(resource.resource_status,'')='RESOURCE_CONFIRMED' then 'Ресурс подтвержден' when w.supplier_approved_at is not null then 'Ресурс подтвержден' else 'Ресурс не подтвержден' end as resource_label,
             coalesce(resource.resource_confirmed_at,w.supplier_approved_at) as resource_confirmed_at,
             case when coalesce(resource.resource_status,'')<>'' then resource.resource_source when w.supplier_approved_at is not null then 'OWNER_APPLICATION_WORKFLOW' else 'NO_AUTHORITATIVE_RESOURCE_FACT' end as resource_source
        from portal_private.client_applications a
        left join lateral (select coalesce(al.proposed_price,al.published_price) as application_price,trim(al.currency::text) as application_currency from portal_private.application_lines al where al.application_key=a.id order by al.line_no limit 1) line on true
        left join portal_private.owner_application_workflow w on w.application_key=a.id
        left join lateral portal_private.resolve_deal_resource_state(a.linked_deal_key) resource on a.linked_deal_key is not null
       where a.application_id in (select value from jsonb_array_elements_text(${sql.json(ids)}::jsonb))
    `;
    const byId=new Map(rows.map((r:any)=>[norm(r.application_id),r]));
    for(const app of applications){const r:any=byId.get(norm(app.application_id));if(!r)continue;app.application_price=r.application_price;app.application_currency=norm(r.application_currency).toUpperCase();app.resource_status=r.resource_status;app.resource_label=r.resource_label;app.resource_confirmed_at=r.resource_confirmed_at;app.resource_source=r.resource_source}
  }
  const deals=Array.isArray(payload?.data?.deals)?payload.data.deals:[];
  const passportRows=await sql`
    select a.application_id,d.deal_id,
           case when a.status::text='DEAL_REGISTERED' and w.business_status='DEAL' and coalesce(w.counter_offer_used,false)=false and a.quantity_tonnes is not null and a.quantity_tonnes>0 and a.proposed_price is not null and a.proposed_price>0 and nullif(trim(a.proposed_currency::text),'') is not null then (a.quantity_tonnes::numeric*a.proposed_price::numeric) else null end as passport_amount,
           case when a.status::text='DEAL_REGISTERED' and w.business_status='DEAL' and coalesce(w.counter_offer_used,false)=false and a.quantity_tonnes is not null and a.quantity_tonnes>0 and a.proposed_price is not null and a.proposed_price>0 and nullif(trim(a.proposed_currency::text),'') is not null then trim(a.proposed_currency::text) else null end as passport_currency,
           case when a.status::text='DEAL_REGISTERED' and w.business_status='DEAL' and coalesce(w.counter_offer_used,false)=false and a.quantity_tonnes is not null and a.quantity_tonnes>0 and a.proposed_price is not null and a.proposed_price>0 and nullif(trim(a.proposed_currency::text),'') is not null then case when w.finalized_at is not null then 'FINALIZED_APPLICATION_COMMERCIAL_TERMS' else 'LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS' end else null end as passport_amount_source
      from portal_private.client_applications a join portal_private.clients cl on cl.id=a.client_key join portal_private.contracts ct on ct.id=a.contract_key left join portal_private.deals d on d.id=a.linked_deal_key left join portal_private.owner_application_workflow w on w.application_key=a.id
     where cl.client_id=${clientId} and ct.contract_id=${contractId}
  `;
  const byDeal=new Map(passportRows.filter((r:any)=>r.deal_id).map((r:any)=>[norm(r.deal_id),r]));
  for(const deal of deals){const r:any=byDeal.get(norm(deal?.deal_id));if(!r||r.passport_amount==null||!norm(r.passport_currency))continue;if(deal.passport_amount==null||!norm(deal.passport_currency)){deal.passport_amount=Number(r.passport_amount);deal.passport_currency=norm(r.passport_currency).toUpperCase();deal.passport_amount_source=norm(r.passport_amount_source||'LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS');deal.passport_application_id=norm(r.application_id)}}
  const directory=await directoryRow({client_id:clientId,contract_id:contractId});
  payload.data.company_metrics=directory?{applications_total:directory.applications_total,deals_total:directory.deals_total,documents_total:directory.documents_total,documents_predicate:DOCUMENTS_PREDICATE,source:METRIC_SOURCE}:null;
  return payload;
}

Deno.serve(async(req:Request)=>{
  try{
    const incoming=new URL(req.url),route=routeOf(incoming.pathname);
    if(!route.startsWith('/v1/client/'))return send(404,{ok:false,code:'ROUTE_NOT_FOUND'});
    const upstream=await proxy(req,route,incoming.search);
    const ct=upstream.headers.get('content-type')||'';
    if(!ct.includes('application/json')){const headers=new Headers(upstream.headers);headers.set('x-rona-portal-backend-slot','candidate');headers.set('x-rona-portal-backend-function',SLUG);headers.set('x-rona-portal-backend-version',BACKEND);return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers})}
    const payload:any=await upstream.json().catch(()=>null);
    if(!upstream.ok||!payload||payload.ok===false)return send(upstream.status,payload||{ok:false,code:`UPSTREAM_${upstream.status}`},upstream.headers);
    if(req.method==='GET'&&route==='/v1/client/bootstrap')await enrichBootstrap(payload);
    if(req.method==='GET'&&route==='/v1/client/context'){
      const clientId=norm(incoming.searchParams.get('clientId')),contractId=norm(incoming.searchParams.get('contractId'));
      if(!clientId||!contractId)return send(400,{ok:false,code:'CLIENT_CONTRACT_CONTEXT_REQUIRED'});
      await enrichContext(payload,clientId,contractId);
    }
    return send(upstream.status,payload,upstream.headers);
  }catch(error){const code=String((error as any)?.message||'SERVER_ERROR');console.error('pr431 candidate error',code);return send(code==='CONTEXT_SCOPE_MISMATCH'?409:500,{ok:false,code:code==='CONTEXT_SCOPE_MISMATCH'?code:'SERVER_ERROR'})}
});
