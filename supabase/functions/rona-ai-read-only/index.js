import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import {
  AI_ROLES, ROLE_DOMAINS, bearerToken, isAiRole, requestIds, roleAllowsHistory,
  sha256Hex, signAiToken, timingSafeHex, verifyAiToken,
} from "./core.js";

const DB = Deno.env.get('SUPABASE_DB_URL');
if (!DB) throw new Error('SUPABASE_DB_URL missing');
const sql = postgres(DB,{prepare:false,max:2});
const vaultSigning = await sql`select decrypted_secret from vault.decrypted_secrets where name='rona_ai_token_signing_key_v1' limit 1`;
const SIGNING_KEY = Deno.env.get('RONA_AI_TOKEN_SIGNING_KEY') || String(vaultSigning[0]?.decrypted_secret || '');
const BOOTSTRAP_PEPPER = Deno.env.get('RONA_AI_BOOTSTRAP_PEPPER');

const NO_QA_SOURCE = `coalesce(lower(source_system),'') !~ '(^|[_/\\-])(qa|test|debug|temp)($|[_/\\-])'`;
const FIN_DOC_TYPES = ['ИНВОЙС','СПЕЦИФИКАЦИЯ / СЧЁТ-ФАКТУРА','КЛИЕНТСКИЙ ПАСПОРТ СДЕЛКИ','КОНТРАКТ','ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ'];

function json(body,status=200,extra={}) {
  return new Response(JSON.stringify(body,(_k,v)=>typeof v==='bigint'?v.toString():v),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store, no-cache, must-revalidate',
      'pragma':'no-cache',
      'referrer-policy':'no-referrer',
      'x-content-type-options':'nosniff',
      ...extra,
    },
  });
}
function functionPath(req){
  const p=new URL(req.url).pathname;
  const marker='/rona-ai-read-only';
  const i=p.indexOf(marker);
  return i>=0?(p.slice(i+marker.length)||'/'):p;
}
function methodDenied(){return json({ok:false,code:'AI_READ_ONLY_METHOD_DENIED'},405,{allow:'GET'});}
function sourceClause(alias){ return `${NO_QA_SOURCE.replaceAll('source_system',`${alias}.source_system`)}`; }

async function audit({identity=null,role=null,req,ids,domain,result,httpStatus,tokenJti=null,metadata={}}){
  try{
    await sql`
      insert into portal_private.ai_read_access_events
        (ai_identity_key,ai_identity_id,functional_role,domain,request_path,request_id,correlation_id,token_jti,result,http_status,metadata)
      values(
        ${identity?.id??null}::uuid,
        ${identity?.identity_id??'UNKNOWN'},
        ${role??null}::portal_private.ai_business_role_enum,
        ${domain},
        ${new URL(req.url).pathname},
        ${ids.requestId}::uuid,
        ${ids.correlationId}::uuid,
        ${tokenJti}::uuid,
        ${result},${httpStatus},${sql.json(metadata)}::jsonb
      )`;
  }catch(e){ console.error('ai read audit write failed',String(e?.message||e)); }
}

async function identityById(identityId){
  const rows=await sql`
    select id,identity_id,business_role::text,display_name,status::text,bootstrap_secret_hash,
           credential_version,token_ttl_seconds,not_before,revoked_at
    from portal_private.ai_service_identities where identity_id=${identityId} limit 1`;
  return rows[0]||null;
}

async function issueToken(req){
  const ids=requestIds(req);
  if (!SIGNING_KEY || !BOOTSTRAP_PEPPER) return json({ok:false,code:'AI_IDENTITY_RUNTIME_NOT_CONFIGURED'},503);
  const identityId=(req.headers.get('x-rona-ai-identity-id')||'').trim();
  const bootstrap=(req.headers.get('x-rona-ai-bootstrap-key')||'').trim();
  if(!/^AI-[A-Z0-9_-]{3,80}$/.test(identityId)||bootstrap.length<32) return json({ok:false,code:'AI_BOOTSTRAP_DENIED',request_id:ids.requestId},403);
  const identity=await identityById(identityId);
  if(!identity||identity.status!=='ACTIVE'||identity.revoked_at||!identity.bootstrap_secret_hash||!isAiRole(identity.business_role)){
    await audit({identity,role:identity?.business_role??null,req,ids,domain:'IDENTITY',result:'DENIED',httpStatus:403});
    return json({ok:false,code:'AI_IDENTITY_DISABLED',request_id:ids.requestId},403);
  }
  if(identity.business_role==='OWNER_ADMIN') return json({ok:false,code:'AI_OWNER_ADMIN_FORBIDDEN',request_id:ids.requestId},403);
  if(identity.not_before&&new Date(identity.not_before).getTime()>Date.now()) return json({ok:false,code:'AI_IDENTITY_NOT_YET_VALID',request_id:ids.requestId},403);
  const actual=await sha256Hex(`${BOOTSTRAP_PEPPER}:${bootstrap}`);
  if(!timingSafeHex(actual,String(identity.bootstrap_secret_hash))){
    await audit({identity,role:identity.business_role,req,ids,domain:'IDENTITY',result:'DENIED',httpStatus:403});
    return json({ok:false,code:'AI_BOOTSTRAP_DENIED',request_id:ids.requestId},403);
  }
  const signed=await signAiToken({
    signingKey:SIGNING_KEY,
    identityId:identity.identity_id,
    role:identity.business_role,
    credentialVersion:Number(identity.credential_version),
    ttlSeconds:Number(identity.token_ttl_seconds||300),
  });
  return json({
    ok:true,
    token_type:'Bearer',
    access_token:signed.token,
    expires_in:signed.payload.exp-signed.payload.iat,
    ai_identity_id:identity.identity_id,
    functional_role:identity.business_role,
    scope:'READ_ONLY',
    request_id:ids.requestId,
  });
}

async function authenticateAi(req){
  const ids=requestIds(req);
  if(!SIGNING_KEY) return {ok:false,status:503,code:'AI_IDENTITY_RUNTIME_NOT_CONFIGURED',ids};
  const raw=bearerToken(req);
  const verified=await verifyAiToken(raw,SIGNING_KEY);
  if(!verified.ok) return {ok:false,status:401,code:verified.code,ids};
  const identity=await identityById(verified.payload.sub);
  if(!identity||identity.status!=='ACTIVE'||identity.revoked_at) return {ok:false,status:403,code:'AI_IDENTITY_DISABLED',ids,identity,role:verified.payload.role,jti:verified.payload.jti};
  if(identity.business_role!==verified.payload.role||Number(identity.credential_version)!==Number(verified.payload.ver)) return {ok:false,status:403,code:'AI_TOKEN_REVOKED_OR_ROLE_CHANGED',ids,identity,role:verified.payload.role,jti:verified.payload.jti};
  if(!AI_ROLES.includes(identity.business_role)||identity.business_role==='OWNER_ADMIN') return {ok:false,status:403,code:'AI_ROLE_DENIED',ids,identity,role:identity.business_role,jti:verified.payload.jti};
  return {ok:true,ids,identity,role:identity.business_role,jti:verified.payload.jti};
}

async function currentContracts(){
  return await sql.unsafe(`
    select ct.contract_id,cl.client_id,ct.counterparty_code,ct.current_external_contract_number,ct.contract_status,
           ct.effective_from,ct.effective_to,ct.authority_state::text,ct.lifecycle_state::text,
           ct.source_system,ct.source_version,ct.source_timestamp,ct.updated_at,
           case
             when ct.authority_state='CONFIRMED'::portal_private.authority_state_enum
              and ct.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
              and ct.contract_status='ACTIVE' then 'CONFIRMED_CURRENT'
             else 'PENDING_VERIFICATION'
           end as verification_state,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'reference_type',r.reference_type,'reference_value',r.reference_value,
               'authority_state',r.authority_state::text,'source_note',r.source_note,'created_at',r.created_at
             ) order by r.created_at)
             from portal_private.contract_external_references r
             where r.contract_key=ct.id
               and r.reference_type not in ('HISTORICAL','SUPERSEDED')
               and r.authority_state not in ('SUPERSEDED'::portal_private.authority_state_enum,'REJECTED'::portal_private.authority_state_enum)
           ),'[]'::jsonb) as competing_references,
           coalesce((
             select jsonb_agg(t.task_id order by t.created_at)
             from portal_private.staff_tasks t
             where t.contract_key=ct.id and t.qa_only=false
               and t.status not in ('COMPLETED','REJECTED','CLOSED')
           ),'[]'::jsonb) as open_control_task_ids,
           (
             ct.current_external_contract_number is null
             and (select count(distinct r.reference_value) from portal_private.contract_external_references r
                  where r.contract_key=ct.id and r.reference_type not in ('HISTORICAL','SUPERSEDED')
                    and r.authority_state not in ('SUPERSEDED','REJECTED')) > 1
           ) as conflict
    from portal_private.contracts ct
    left join portal_private.clients cl on cl.id=ct.client_key
    where ct.lifecycle_state not in ('ARCHIVED','SUPERSEDED','CLOSED')
      and ct.authority_state not in ('SUPERSEDED','REJECTED')
      and (${sourceClause('ct')})
      and (
        ct.lifecycle_state='ACTIVE'
        or exists(select 1 from portal_private.staff_tasks t where t.contract_key=ct.id and t.qa_only=false and t.status not in ('COMPLETED','REJECTED','CLOSED'))
      )
    order by ct.contract_id`);
}

async function currentClients(){
  return await sql.unsafe(`select client_id,legal_name,registration_country,registered_address,authority_state::text,lifecycle_state::text,source_system,source_version,source_timestamp,updated_at
    from portal_private.clients cl where cl.lifecycle_state='ACTIVE' and cl.authority_state not in ('SUPERSEDED','REJECTED') and (${sourceClause('cl')}) order by client_id`);
}
async function currentApplications(){
  return await sql.unsafe(`select a.application_id,cl.client_id,ct.contract_id,a.product,a.quantity_tonnes,a.delivery_period_from,a.delivery_period_to,a.delivery_basis,a.destination,a.payment_terms,a.price_mode::text,a.status::text,d.deal_id,a.submitted_at,a.authority_state::text,a.lifecycle_state::text,a.source_system,a.source_version,a.source_timestamp,a.updated_at
    from portal_private.client_applications a join portal_private.clients cl on cl.id=a.client_key join portal_private.contracts ct on ct.id=a.contract_key left join portal_private.deals d on d.id=a.linked_deal_key
    where a.lifecycle_state='ACTIVE' and a.authority_state not in ('SUPERSEDED','REJECTED') and (${sourceClause('a')}) order by a.created_at desc`);
}
async function currentDeals(){
  return await sql.unsafe(`select d.deal_id,cl.client_id,ct.contract_id,d.business_status,d.finance_status::text,d.accounting_closure_status::text,d.opened_at,d.closed_at,d.authority_state::text,d.lifecycle_state::text,d.source_system,d.source_version,d.source_timestamp,d.updated_at
    from portal_private.deals d join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key
    where d.lifecycle_state not in ('ARCHIVED','SUPERSEDED') and d.authority_state not in ('SUPERSEDED','REJECTED') and (${sourceClause('d')})
      and (d.lifecycle_state='ACTIVE' or d.accounting_closure_status<>'CLOSED') order by d.created_at desc`);
}
async function currentDocuments(types=null){
  if(types?.length){
    return await sql`select d.document_id,d.document_type,cl.client_id,d.counterparty_code,ct.contract_id,x.deal_id,d.authoritative_filename,d.authority_state::text,d.lifecycle_state::text,d.source_system,d.source_version,d.source_timestamp,d.updated_at,dv.version_number,dv.sha256,dv.is_current,dv.is_effective
      from portal_private.documents d left join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key left join portal_private.deals x on x.id=d.deal_key left join portal_private.document_versions dv on dv.id=d.current_version_id
      where d.lifecycle_state='ACTIVE' and d.authority_state not in ('SUPERSEDED','REJECTED') and d.document_type=any(${types}::text[])
        and coalesce(lower(d.source_system),'') !~ '(^|[_/\\-])(qa|test|debug|temp)($|[_/\\-])'
        and (dv.id is null or (dv.is_current and dv.lifecycle_state='ACTIVE' and dv.authority_state not in ('SUPERSEDED','REJECTED')))
      order by d.updated_at desc`;
  }
  return await sql.unsafe(`select d.document_id,d.document_type,cl.client_id,d.counterparty_code,ct.contract_id,x.deal_id,d.authoritative_filename,d.authority_state::text,d.lifecycle_state::text,d.source_system,d.source_version,d.source_timestamp,d.updated_at,dv.version_number,dv.sha256,dv.is_current,dv.is_effective
    from portal_private.documents d left join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key left join portal_private.deals x on x.id=d.deal_key left join portal_private.document_versions dv on dv.id=d.current_version_id
    where d.lifecycle_state='ACTIVE' and d.authority_state not in ('SUPERSEDED','REJECTED') and (${sourceClause('d')})
      and (dv.id is null or (dv.is_current and dv.lifecycle_state='ACTIVE' and dv.authority_state not in ('SUPERSEDED','REJECTED')))
    order by d.updated_at desc`);
}
async function currentPayments(){
  return await sql.unsafe(`select p.payment_id,p.bank_fact_status::text,p.payment_at,p.amount,p.currency,p.finance_status::text,p.accounting_closure_status::text,p.authority_state::text,p.lifecycle_state::text,p.source_system,p.source_version,p.source_timestamp,p.updated_at
    from portal_private.payments p where p.lifecycle_state='ACTIVE' and p.authority_state not in ('SUPERSEDED','REJECTED') and (${sourceClause('p')}) order by p.payment_at desc`);
}
async function currentPaymentAllocations(){
  return await sql.unsafe(`select p.payment_id,cl.client_id,ct.contract_id,d.deal_id,pa.allocated_amount,pa.allocation_status::text,pa.finance_status::text,pa.accounting_closure_status::text,pa.allocated_at,pa.authority_state::text,pa.lifecycle_state::text,pa.source_system,pa.source_version,pa.source_timestamp,pa.updated_at
    from portal_private.payment_allocations pa join portal_private.payments p on p.id=pa.payment_key join portal_private.clients cl on cl.id=pa.client_key join portal_private.contracts ct on ct.id=pa.contract_key left join portal_private.deals d on d.id=pa.deal_key
    where pa.lifecycle_state='ACTIVE' and pa.authority_state not in ('SUPERSEDED','REJECTED') and (${sourceClause('pa')}) order by pa.created_at desc`);
}
async function currentShipments(){
  return await sql.unsafe(`select s.shipment_id,cl.client_id,d.deal_id,s.shipment_status::text,s.origin_location,s.destination_location,s.planned_departure_at,s.actual_departure_at,s.planned_arrival_at,s.actual_arrival_at,s.closed_at,s.authority_state::text,s.lifecycle_state::text,s.source_system,s.source_version,s.source_timestamp,s.updated_at
    from portal_private.shipments s join portal_private.clients cl on cl.id=s.client_key join portal_private.deals d on d.id=s.deal_key
    where s.lifecycle_state='ACTIVE' and s.authority_state not in ('SUPERSEDED','REJECTED') and (${sourceClause('s')}) order by s.updated_at desc`);
}
async function currentRail(){
  const docs=await sql.unsafe(`select rd.rail_document_id,rd.document_type,rd.gu12_number,cl.client_id,d.deal_id,rd.document_number,rd.document_date,rd.route_text,rd.authority_state::text,rd.lifecycle_state::text,rd.source_system,rd.source_version,rd.source_timestamp,rd.updated_at
    from portal_private.rail_documents rd left join portal_private.clients cl on cl.id=rd.client_key left join portal_private.deals d on d.id=rd.deal_key
    where rd.lifecycle_state='ACTIVE' and rd.authority_state not in ('SUPERSEDED','REJECTED') and (${sourceClause('rd')}) order by rd.updated_at desc`);
  const movement=await sql`select provider,dedupe_key,wagon_number,station_name,esr_code,operation,event_at,latitude,longitude,coordinate_source,provider_origin,provider_destination,received_at,authority_state::text,lifecycle_state::text
    from portal_private.rail_movement_events where lifecycle_state='ACTIVE' and authority_state not in ('SUPERSEDED','REJECTED') order by coalesce(event_at,received_at) desc limit 500`;
  const monitoring=await sql`select provider,monitoring_status,poll_interval_minutes,stale_after_minutes,started_at,ended_at,last_successful_update,last_attempt_at,provider_status,sync_status,retry_count,created_at,updated_at
    from portal_private.rail_monitoring_targets where monitoring_status<>'CLOSED' order by updated_at desc`;
  return {documents:docs,movement,monitoring};
}
async function currentPublications(){
  return await sql.unsafe(`select p.publication_id,p.publication_type::text,p.title,p.status::text,p.audience,p.prepared_at,p.approved_at,p.published_at,p.authority_state::text,p.lifecycle_state::text,p.source_system,p.source_version,p.source_timestamp,p.updated_at,
      coalesce((select jsonb_agg(jsonb_build_object('item_id',pi.id,'item_type',pi.item_type::text,'item_order',pi.item_order,'product',pi.product,'basis',pi.basis,'currency',pi.currency,'price',pi.price,'headline',pi.headline,'content_text',pi.content_text,'analytics_as_of',pi.analytics_as_of,'forecast_scenario',pi.forecast_scenario,'authority_state',pi.authority_state::text,'lifecycle_state',pi.lifecycle_state::text) order by pi.item_order) from portal_private.publication_items pi where pi.publication_key=p.id and pi.lifecycle_state='ACTIVE' and pi.authority_state not in ('SUPERSEDED','REJECTED') and (${sourceClause('pi')})),'[]'::jsonb) items
    from portal_private.publications p where p.lifecycle_state='ACTIVE' and p.authority_state not in ('SUPERSEDED','REJECTED') and p.status::text not in ('SUPERSEDED','ARCHIVED') and (${sourceClause('p')}) order by p.prepared_at desc`);
}
async function currentPublicationIndex(){
  return await sql.unsafe(`select p.publication_id,p.publication_type::text,p.status::text,p.prepared_at,p.published_at,p.updated_at,
      (select count(*)::int from portal_private.publication_items pi where pi.publication_key=p.id and pi.lifecycle_state='ACTIVE' and pi.authority_state not in ('SUPERSEDED','REJECTED') and (${sourceClause('pi')})) as item_count
    from portal_private.publications p where p.lifecycle_state='ACTIVE' and p.authority_state not in ('SUPERSEDED','REJECTED') and p.status::text not in ('SUPERSEDED','ARCHIVED') and (${sourceClause('p')}) order by p.prepared_at desc`);
}
async function currentResource(){
  const requests=await sql.unsafe(`select r.supplier_request_id,d.deal_id,r.supplier_reference,r.status,r.requested_at,r.source_system,r.source_version,r.created_at,r.updated_at from portal_private.supplier_requests r join portal_private.deals d on d.id=r.deal_key where (${sourceClause('r')}) order by r.created_at desc`);
  const responses=await sql.unsafe(`select sr.supplier_response_id,r.supplier_request_id,d.deal_id,sr.response_state,sr.received_at,sr.recorded_at,sr.source_system,sr.created_at from portal_private.supplier_responses sr join portal_private.supplier_requests r on r.id=sr.supplier_request_key join portal_private.deals d on d.id=r.deal_key where (${sourceClause('sr')}) order by sr.created_at desc`);
  const decisions=await sql.unsafe(`select r.resource_decision_id,d.deal_id,r.decision_state,r.decision_reason,r.decided_at,r.source_system,r.source_version,r.created_at from portal_private.resource_decisions r join portal_private.deals d on d.id=r.deal_key where (${sourceClause('r')}) order by r.created_at desc`);
  return {supplierRequests:requests,supplierResponses:responses,resourceDecisions:decisions};
}
async function currentTasks(role){
  const domains = role==='OPERATIONS_DIRECTOR' ? ['APPLICATION','DEAL','CONTRACT','DOCUMENT','RESOURCE','PUBLICATION','MARKET','RAIL','SHIPMENT','QUALITY','VED','COMMERCIAL']
    : role==='FINANCE' ? ['PAYMENT','ACCOUNTING','FINANCE','DEAL','CONTRACT']
    : role==='LEGAL' ? ['CONTRACT','DOCUMENT','LEGAL','PORTAL_EVENT']
    : (role==='MARKET_ANALYST'||role==='COMMERCIAL_DIRECTOR') ? ['CLIENT','CONTRACT','APPLICATION','DEAL','COMMERCIAL','MARKET','PUBLICATION','PORTAL_EVENT']
    : role==='RAIL_LOGISTICS' ? ['RAIL','SHIPMENT','PORTAL_EVENT']
    : ['TECHNICAL','IAM','AUDIT','PORTAL_EVENT'];
  return await sql`select task_id,title,description,status::text,priority::text,authority_domain,assigned_functional_role::text,due_at,source_type,source_object_id,source_version,acknowledged_at,decision,decision_at,created_at,updated_at
    from portal_private.staff_tasks where qa_only=false and authority_domain=any(${domains}::text[]) and status not in ('COMPLETED','REJECTED','CLOSED')
      and coalesce(lower(source_type),'') !~ '(^|[_/\\-])(qa|test|debug|temp)($|[_/\\-])'
    order by case priority when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,due_at nulls last,created_at desc`;
}
async function currentPortalEvents(role){
  const types = role==='OPERATIONS_DIRECTOR' ? ['CLIENT_APPLICATION_SUBMIT','CLIENT_CLAIM_SUBMIT','CLIENT_PAYMENT_PROOF_SUBMIT','CLIENT_MESSAGE_SUBMIT','CLIENT_DOCUMENT_ACK','AGENT_MESSAGE_SUBMIT','AGENT_NOTE_SUBMIT','ADMIN_PUBLICATION_REQUEST','ADMIN_UNPUBLISH_REQUEST','ADMIN_PRICE_PUBLICATION_REQUEST']
    : role==='LEGAL' ? ['CLIENT_CLAIM_SUBMIT','CLIENT_DOCUMENT_ACK','CLIENT_MESSAGE_SUBMIT']
    : (role==='MARKET_ANALYST'||role==='COMMERCIAL_DIRECTOR') ? ['CLIENT_APPLICATION_SUBMIT','CLIENT_MESSAGE_SUBMIT','AGENT_MESSAGE_SUBMIT','AGENT_NOTE_SUBMIT','ADMIN_PUBLICATION_REQUEST','ADMIN_UNPUBLISH_REQUEST','ADMIN_PRICE_PUBLICATION_REQUEST']
    : role==='RAIL_LOGISTICS' ? ['CLIENT_MESSAGE_SUBMIT','AGENT_MESSAGE_SUBMIT','AGENT_NOTE_SUBMIT']
    : role==='SYSTEM_ADMIN' ? ['ADMIN_SOURCE_SYNC_REQUEST','ADMIN_AUTHORITY_ACTION_REQUEST']
    : ['CLIENT_PAYMENT_PROOF_SUBMIT'];
  return await sql`select event_id,event_type,processing_state,acknowledgement_state,authority_domain,authority_target_type,authority_target_id,created_at,updated_at,authority_state::text,lifecycle_state::text
    from portal_private.portal_reverse_events where event_type=any(${types}::text[]) and lifecycle_state not in ('ARCHIVED','SUPERSEDED')
      and source_system !~* '(^|[_/\\-])(qa|test|debug|temp)($|[_/\\-])'
    order by created_at desc limit 250`;
}
async function controls(role){
  if(role==='SYSTEM_ADMIN') return [];
  const rows=await sql`
    select * from (
      select 'CONTRACT_VERIFICATION'::text control_type,ct.contract_id entity_id,
             case when ct.lifecycle_state='DRAFT' or ct.authority_state in ('DRAFT','SOURCE_RECEIVED') or ct.current_external_contract_number is null then 'TO_VERIFY' else 'OK' end status,
             ('status='||ct.contract_status||'; authority='||ct.authority_state::text||'; lifecycle='||ct.lifecycle_state::text||'; external='||coalesce(ct.current_external_contract_number,'<NULL>')) detail,ct.updated_at
      from portal_private.contracts ct where ct.lifecycle_state not in ('ARCHIVED','SUPERSEDED','CLOSED') and ct.authority_state not in ('SUPERSEDED','REJECTED')
        and (ct.lifecycle_state='DRAFT' or ct.authority_state in ('DRAFT','SOURCE_RECEIVED') or ct.current_external_contract_number is null)
      union all
      select 'PAYMENT_ACCOUNTING_OPEN',d.deal_id,'HOLD',('Finance='||p.finance_status::text||'; Accounting='||p.accounting_closure_status::text||'; amount='||p.amount::text||' '||p.currency::text),p.updated_at
      from portal_private.payments p join portal_private.payment_allocations pa on pa.payment_key=p.id and pa.deal_key is not null join portal_private.deals d on d.id=pa.deal_key
      where p.lifecycle_state not in ('ARCHIVED','SUPERSEDED') and p.authority_state not in ('SUPERSEDED','REJECTED') and p.finance_status='PAID' and p.accounting_closure_status<>'CLOSED'
    ) q order by updated_at desc`;
  if(role==='FINANCE') return rows.filter(x=>x.control_type==='PAYMENT_ACCOUNTING_OPEN'||x.control_type==='CONTRACT_VERIFICATION');
  if(role==='LEGAL') return rows.filter(x=>x.control_type==='CONTRACT_VERIFICATION');
  if(role==='RAIL_LOGISTICS'||role==='MARKET_ANALYST'||role==='COMMERCIAL_DIRECTOR') return [];
  return rows;
}
async function systemAdminState(){
  const iam=await sql`select u.id as portal_user_id,u.login_name,u.display_name,u.status::text,u.authority_state::text,u.lifecycle_state::text,u.last_auth_verified_at,u.updated_at,
    coalesce((select jsonb_agg(r.role::text order by r.role::text) from portal_private.portal_user_roles r where r.user_id=u.id and r.status='ACTIVE' and r.revoked_at is null),'[]'::jsonb) roles,
    coalesce((select jsonb_agg(s.functional_role::text order by s.functional_role::text) from portal_private.staff_user_roles s where s.user_id=u.id and s.status='ACTIVE'),'[]'::jsonb) staff_roles
    from portal_private.portal_users u where u.lifecycle_state='ACTIVE' and u.authority_state not in ('SUPERSEDED','REJECTED') order by u.login_name nulls last`;
  const sessions=await sql`select id,user_id,status::text,revoked_at,reason,created_at,updated_at from portal_private.portal_sessions_control order by updated_at desc limit 250`;
  const auditRows=await sql`select event_id,event_at,actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,severity::text,result::text from portal_private.audit_events order by event_at desc limit 250`;
  const health=await sql`select provider,mode,credentials_state,api_contract_state,one_wagon_test_passed,production_polling_enabled,client_publication_enabled,default_poll_interval_minutes,changed_at,note from portal_private.rail_provider_runtime_control order by provider`;
  const ai=await sql`select identity_id,business_role::text,display_name,status::text,credential_version,token_ttl_seconds,not_before,revoked_at,created_at,updated_at from portal_private.ai_service_identities order by business_role::text`;
  return {iam,sessions,audit:auditRows,integrationHealth:health,aiIdentities:ai};
}

async function buildCurrentState(role){
  const base={
    data_contract:'AI_READ_ONLY_V1',
    generated_at:new Date().toISOString(),
    current_only:true,
    history_included:false,
    qa_test_debug_temp_excluded:true,
    superseded_archived_excluded:true,
    allowed_domains:ROLE_DOMAINS[role],
    organizational_title:(role==='MARKET_ANALYST'||role==='COMMERCIAL_DIRECTOR')?'Коммерческий директор':null,
  };
  if(role==='OPERATIONS_DIRECTOR') return {...base,
    clients:await currentClients(),contracts:await currentContracts(),applications:await currentApplications(),deals:await currentDeals(),documents:await currentDocuments(),
    controls:await controls(role),shipments:await currentShipments(),railSummary:await currentRail(),resource:await currentResource(),publications:await currentPublications(),
    vedRecords:[],qualityRecords:[],commercialRecords:await currentApplications(),tasks:await currentTasks(role),events:await currentPortalEvents(role),
  };
  if(role==='FINANCE') return {...base,
    contracts:await currentContracts(),deals:await currentDeals(),financialDocuments:await currentDocuments(FIN_DOC_TYPES),payments:await currentPayments(),paymentAllocations:await currentPaymentAllocations(),
    controls:await controls(role),tasks:await currentTasks(role),
  };
  if(role==='LEGAL') return {...base,
    contracts:await currentContracts(),documents:await currentDocuments(),applications:await currentApplications(),deals:await currentDeals(),controls:await controls(role),tasks:await currentTasks(role),events:await currentPortalEvents(role),
  };
  if(role==='MARKET_ANALYST'||role==='COMMERCIAL_DIRECTOR') {
    const applications=await currentApplications();
    const publications=await currentPublicationIndex();
    const market={
      projection:'COMMERCIAL_CURRENT_STATE_COMPACT_V1',
      publication_count:publications.length,
      active_item_count:publications.reduce((n,x)=>n+Number(x.item_count||0),0),
      latest_updated_at:publications[0]?.updated_at??null,
      publication_items_in_current_state:false,
      full_market_source_tool:'market_data',
    };
    return {...base,
      clients:await currentClients(),contracts:await currentContracts(),applications,deals:await currentDeals(),commercialRecords:applications,
      market,publications,tasks:await currentTasks(role),events:await currentPortalEvents(role),
    };
  }
  if(role==='RAIL_LOGISTICS') return {...base,
    deals:await currentDeals(),shipments:await currentShipments(),rail:await currentRail(),documents:await currentDocuments(),tasks:await currentTasks(role),events:await currentPortalEvents(role),
  };
  if(role==='SYSTEM_ADMIN') return {...base,...await systemAdminState(),tasks:await currentTasks(role),events:await currentPortalEvents(role)};
  throw new Error('AI_ROLE_DENIED');
}

async function history(role,domain){
  if(!roleAllowsHistory(role,domain)) throw Object.assign(new Error('AI_HISTORY_DOMAIN_DENIED'),{status:403});
  switch(domain){
    case 'contracts': return await sql`select ct.contract_id,ct.current_external_contract_number,ct.contract_status,ct.authority_state::text,ct.lifecycle_state::text,ct.source_system,ct.source_version,ct.source_timestamp,ct.created_at,ct.updated_at from portal_private.contracts ct order by ct.updated_at desc limit 250`;
    case 'deals': return await sql`select deal_id,business_status,finance_status::text,accounting_closure_status::text,authority_state::text,lifecycle_state::text,source_system,source_version,source_timestamp,created_at,updated_at from portal_private.deals order by updated_at desc limit 250`;
    case 'documents': return await sql`select d.document_id,d.document_type,d.authoritative_filename,d.authority_state::text,d.lifecycle_state::text,d.source_system,d.source_version,d.source_timestamp,d.created_at,d.updated_at,dv.version_number,dv.sha256,dv.is_current,dv.is_effective from portal_private.documents d left join portal_private.document_versions dv on dv.document_key=d.id order by d.document_id,dv.version_number desc limit 500`;
    case 'publications': return await sql`select publication_id,publication_type::text,title,status::text,audience,prepared_at,approved_at,published_at,authority_state::text,lifecycle_state::text,source_system,source_version,source_timestamp,created_at,updated_at from portal_private.publications order by updated_at desc limit 250`;
    case 'payments': return await sql`select payment_id,bank_fact_status::text,payment_at,amount,currency,finance_status::text,accounting_closure_status::text,authority_state::text,lifecycle_state::text,source_system,source_version,source_timestamp,created_at,updated_at from portal_private.payments order by updated_at desc limit 250`;
    case 'rail': return await sql`select provider,dedupe_key,wagon_number,station_name,operation,event_at,received_at,authority_state::text,lifecycle_state::text from portal_private.rail_movement_events order by received_at desc limit 500`;
    case 'shipments': return await sql`select shipment_id,shipment_status::text,origin_location,destination_location,authority_state::text,lifecycle_state::text,source_system,source_version,source_timestamp,created_at,updated_at from portal_private.shipments order by updated_at desc limit 250`;
    case 'tasks': return await sql`select task_id,title,status::text,priority::text,authority_domain,assigned_functional_role::text,source_type,source_object_id,qa_only,created_at,updated_at from portal_private.staff_tasks order by updated_at desc limit 250`;
    case 'audit': return await sql`select event_id,event_at,actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,severity::text,result::text from portal_private.audit_events order by event_at desc limit 250`;
    case 'sessions': return await sql`select id,user_id,status::text,revoked_at,reason,created_at,updated_at from portal_private.portal_sessions_control order by updated_at desc limit 250`;
    default: throw Object.assign(new Error('AI_HISTORY_DOMAIN_DENIED'),{status:403});
  }
}

Deno.serve(async(req)=>{
  const path=functionPath(req);
  if(path==='/token'){
    if(req.method!=='POST') return json({ok:false,code:'METHOD_NOT_ALLOWED'},405,{allow:'POST'});
    try{return await issueToken(req);}catch(e){console.error('ai token issue failed',String(e?.message||e));return json({ok:false,code:'AI_TOKEN_ISSUE_ERROR'},500);}
  }
  if(req.method!=='GET') return methodDenied();
  if(path!=='/current-state'&&path!=='/history') return json({ok:false,code:'AI_ROUTE_NOT_FOUND'},404);
  const auth=await authenticateAi(req);
  if(!auth.ok){
    await audit({identity:auth.identity??null,role:auth.role??null,req,ids:auth.ids,domain:'AUTH',result:'DENIED',httpStatus:auth.status,tokenJti:auth.jti??null});
    return json({ok:false,code:auth.code,request_id:auth.ids.requestId},auth.status);
  }
  try{
    if(path==='/current-state'){
      const data=await buildCurrentState(auth.role);
      await audit({identity:auth.identity,role:auth.role,req,ids:auth.ids,domain:'CURRENT_STATE',result:'SUCCESS',httpStatus:200,tokenJti:auth.jti,metadata:{domains:ROLE_DOMAINS[auth.role],history:false}});
      return json({ok:true,ai_identity_id:auth.identity.identity_id,functional_role:auth.role,request_id:auth.ids.requestId,correlation_id:auth.ids.correlationId,data});
    }
    const domain=(new URL(req.url).searchParams.get('domain')||'').toLowerCase();
    const data=await history(auth.role,domain);
    await audit({identity:auth.identity,role:auth.role,req,ids:auth.ids,domain:`HISTORY:${domain}`,result:'SUCCESS',httpStatus:200,tokenJti:auth.jti,metadata:{history:true,domain}});
    return json({ok:true,ai_identity_id:auth.identity.identity_id,functional_role:auth.role,request_id:auth.ids.requestId,correlation_id:auth.ids.correlationId,history:true,domain,data});
  }catch(e){
    const status=Number(e?.status||500);const code=String(e?.message||'AI_READ_ERROR');
    await audit({identity:auth.identity,role:auth.role,req,ids:auth.ids,domain:path,result:status<500?'DENIED':'ERROR',httpStatus:status,tokenJti:auth.jti});
    return json({ok:false,code,request_id:auth.ids.requestId},status);
  }
});
