// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
const DB=Deno.env.get("SUPABASE_DB_URL"),SUPA_URL=Deno.env.get("SUPABASE_URL");if(!DB||!SUPA_URL)throw new Error("runtime vars missing");const sql=postgres(DB,{prepare:false,max:1,idle_timeout:1,max_lifetime:30,connect_timeout:5});const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function runtimeKey(kind){const legacy=kind==="pub"?Deno.env.get("SUPABASE_ANON_KEY"):Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;const raw=Deno.env.get(kind==="pub"?"SUPABASE_PUBLISHABLE_KEYS":"SUPABASE_SECRET_KEYS");if(raw){const p=JSON.parse(raw);if(p.default)return p.default}throw new Error("key missing")}
function send(status,body){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}function claims(token){try{const p=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(atob(p+"=".repeat((4-p.length%4)%4)))}catch{return{}}}
async function authContext(req){const authorization=req.headers.get("authorization");if(!authorization?.startsWith("Bearer "))return null;const token=authorization.slice(7),client=createClient(SUPA_URL,runtimeKey("pub"),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});const {data,error}=await client.auth.getUser(token);if(error||!data.user)return null;const sid=claims(token).session_id;if(typeof sid!=="string"||!UUID_RE.test(sid))return null;const rows=await sql`select a.portal_user_id,a.display_name,a.roles,s.not_after from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) a join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid where a.session_allowed and (s.not_after is null or s.not_after>now())`;if(rows.length!==1)return null;return{userId:String(rows[0].portal_user_id),roles:(rows[0].roles||[]).map(String)}}
function pathOf(req){const p=new URL(req.url).pathname,m="/rona-owner-ai-sync",i=p.indexOf(m);return i>=0?(p.slice(i+m.length)||"/"):p}function requireRole(ctx,role){if(!ctx?.roles?.includes(role))throw Object.assign(new Error("ROLE_MISMATCH"),{status:403})}
function marketNoise(text){return /(full-contour|\buat\b|protocol|production operating|global cleanup|self-ack|go-live|owner appointment|activation|test r[0-9])/i.test(String(text||""))}
function marketTerms(text){return /(market|рын|price|прайс|цен|telegram|platts|argus|petromarket|hairatan|khafi|afghanistan|galaba|бенз|диз|lpg|суг|benchmark|конкурент)/i.test(String(text||""))}
async function coordinationDashboard(){
  const roleMetrics=await sql`
    with periods(period,since_at,sort) as (
      values
        ('TODAY',date_trunc('day',now()),1),
        ('7D',now()-interval '7 days',2),
        ('30D',now()-interval '30 days',3),
        ('ALL',null::timestamptz,4)
    ), roles as (
      select business_role::text role,display_name,identity_id,status::text identity_status
      from portal_private.ai_service_identities
      where revoked_at is null
    ), business as (
      select * from portal_private.ai_runtime_queue
      where qa_only=false and source_type in ('PORTAL_REVERSE_EVENT','STAFF_TASK','COORDINATION')
    )
    select p.period,r.role,r.display_name,r.identity_id,r.identity_status,
      count(b.id)::int sent,
      count(b.id) filter (where b.delivered_at is not null)::int delivered,
      count(b.id) filter (where b.state='PROCESSED')::int responses,
      count(b.id) filter (where b.state not in ('PROCESSED','DEAD_LETTER'))::int awaiting,
      count(b.id) filter (where b.sla_breached_at is not null and b.state not in ('PROCESSED','DEAD_LETTER'))::int sla_breached,
      count(b.id) filter (where b.state in ('BLOCKED','DEAD_LETTER') or b.last_error_code is not null)::int errors,
      count(b.id) filter (where b.source_type='PORTAL_REVERSE_EVENT')::int portal_requests,
      max(b.processed_at) last_response_at,max(b.created_at) last_request_at
    from periods p cross join roles r
    left join business b on b.target_role::text=r.role and (p.since_at is null or b.created_at>=p.since_at)
    group by p.period,p.sort,r.role,r.display_name,r.identity_id,r.identity_status
    order by p.sort,r.role`;
  const recent=await sql`
    select q.id,q.source_type,q.source_id,q.target_role::text as target_role,q.priority,q.state,
      coalesce(nullif(q.payload->>'title',''),nullif(q.payload->'payload'->>'subject',''),nullif(q.payload->'payload'->>'requested_check',''),q.source_id) as subject,
      q.created_at,q.delivered_at,q.processed_at,q.deadline_at,q.sla_breached_at,q.last_error_code
    from portal_private.ai_runtime_queue q
    where q.qa_only=false and q.source_type in ('PORTAL_REVERSE_EVENT','STAFF_TASK','COORDINATION')
    order by q.created_at desc limit 24`;
  const periods={TODAY:[],"7D":[],"30D":[],ALL:[]};
  for(const row of roleMetrics){const key=String(row.period);if(periods[key])periods[key].push(row)}
  const totals={};
  for(const [key,rows] of Object.entries(periods))totals[key]=rows.reduce((a,r)=>({sent:a.sent+Number(r.sent||0),delivered:a.delivered+Number(r.delivered||0),responses:a.responses+Number(r.responses||0),awaiting:a.awaiting+Number(r.awaiting||0),slaBreached:a.slaBreached+Number(r.sla_breached||0),errors:a.errors+Number(r.errors||0),portalRequests:a.portalRequests+Number(r.portal_requests||0)}),{sent:0,delivered:0,responses:0,awaiting:0,slaBreached:0,errors:0,portalRequests:0});
  return{generatedAt:new Date().toISOString(),semantics:{sent:"Business queue records: PORTAL_REVERSE_EVENT + STAFF_TASK + COORDINATION; HEARTBEAT and SYSTEM_CHECK excluded",responses:"Only queue records settled to PROCESSED by authoritative response/terminal triggers",awaiting:"Non-terminal queue records excluding DEAD_LETTER",sla:"Authoritative ai_runtime_queue.sla_breached_at"},periods,totals,recent};
}
async function agentRewardsDashboard(){
  const rows=await sql`
    with active_assignments as (
      select aca.id assignment_id,aca.client_key,ale.agent_legal_entity_id,ale.legal_name agent_legal_name,
             cl.client_id,cl.legal_name client_name
      from portal_private.agent_client_assignments aca
      join portal_private.agent_legal_entities ale on ale.id=aca.agent_legal_entity_key
      join portal_private.clients cl on cl.id=aca.client_key
      where aca.status::text='ACTIVE'
        and aca.lifecycle_state::text='ACTIVE'
        and aca.authority_state::text in ('CONFIRMED','VERIFIED')
        and aca.valid_from<=now() and (aca.valid_to is null or aca.valid_to>now())
        and ale.lifecycle_state::text='ACTIVE'
    ), scope as (
      select a.*,d.id deal_key,d.deal_id,d.business_status,d.finance_status::text finance_status,
             d.accounting_closure_status::text accounting_status
      from active_assignments a
      left join portal_private.deals d on d.client_key=a.client_key
        and d.lifecycle_state::text not in ('ARCHIVED','SUPERSEDED')
    )
    select s.assignment_id,s.agent_legal_entity_id,s.agent_legal_name,s.client_id,s.client_name,
           s.deal_id,s.business_status,s.finance_status,s.accounting_status,
           t.status::text term_status,t.lifecycle_state::text term_lifecycle_state,t.authority_state::text term_authority_state,
           t.commission_mode::text commission_mode,t.commission_rate,t.commission_fixed_amount,t.currency term_currency,
           st.settlement_id,st.settlement_state::text settlement_state,st.amount settlement_amount,st.currency settlement_currency,
           st.authority_state::text settlement_authority_state,st.payable_confirmed_at,st.paid_at,
           greatest(coalesce(t.updated_at,'epoch'::timestamptz),coalesce(st.updated_at,'epoch'::timestamptz)) updated_at
    from scope s
    left join lateral (
      select x.* from portal_private.agent_deal_terms x
      where x.assignment_id=s.assignment_id and x.deal_key=s.deal_key
      order by x.updated_at desc limit 1
    ) t on s.deal_key is not null
    left join lateral (
      select x.* from portal_private.agent_settlements x
      where x.deal_key=s.deal_key and x.lifecycle_state::text='ACTIVE'
        and (t.id is null or x.agent_deal_term_key=t.id)
      order by x.updated_at desc limit 1
    ) st on s.deal_key is not null
    order by s.agent_legal_name,s.client_name,s.deal_id nulls last`;
  return{generatedAt:new Date().toISOString(),rows};
}
async function adminSync(){
  const railTariffs=await sql`select tariff_key,product_group,territory,route_text,tariff_usd_per_t,source_provider,status,original_rate,original_currency,original_unit,valid_to,notes,source_refs,approved_at,updated_at from portal_private.owner_rail_tariff_matrix order by case product_group when 'LIGHT_PETROLEUM' then 1 else 2 end,territory,route_text`;
  const aiRuntime=(await sql`select enabled,protocol_version,scheduler_state,model_execution_state,heartbeat_minutes,worker_version,updated_at from portal_private.ai_runtime_control where singleton=true limit 1`)[0]||null;
  const aiEmployees=await sql`select identity_id,business_role::text,display_name,status::text,updated_at from portal_private.ai_service_identities order by business_role::text`;
  const latestAiConclusions=await sql`select distinct on (functional_role,target_type,target_id) record_id,functional_role::text as role,target_type,target_id,status,version,payload->>'summary' as summary,created_at from portal_private.ai_coordination_records where record_type='FUNCTIONAL_CONCLUSION' and qa_only=false order by functional_role,target_type,target_id,version desc,created_at desc limit 50`;
  const homeCoordination=await coordinationDashboard();
  const agentRewardsFragment=await agentRewardsDashboard();

  const marketIdentity=(await sql`select identity_id,business_role::text as role,display_name,status::text,updated_at from portal_private.ai_service_identities where identity_id='AI-COMMERCIAL-DIRECTOR' limit 1`)[0]||null;
  const marketRecords=await sql`
    select record_id,record_type,target_type,target_id,target_role::text as target_role,status,version,
      payload->>'subject' as subject,payload->>'priority' as priority,payload->>'summary' as summary,
      payload->>'recommendation' as recommendation,payload->>'requested_check' as requested_check,
      payload->>'reason' as reason,source_refs,created_at
    from portal_private.ai_coordination_records
    where qa_only=false and functional_role::text in ('COMMERCIAL_DIRECTOR','MARKET_ANALYST') and target_type='PUBLICATION'
      and record_type in ('FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST')
      and created_at>=now()-interval '7 days'
    order by created_at desc
    limit 120`;
  const marketPublications=await sql`
    select p.publication_id,p.publication_type::text as publication_type,p.title,p.status::text as status,p.audience,
      p.prepared_at,p.published_at,p.source_system,p.source_version,p.source_timestamp,
      coalesce(jsonb_agg(jsonb_build_object('item_id',pi.id,'item_order',pi.item_order,'item_type',pi.item_type::text,'product',pi.product,'basis',pi.basis,'price',pi.price,'currency',pi.currency,'content_text',pi.content_text,'analytics_as_of',pi.analytics_as_of) order by pi.item_order) filter (where pi.id is not null),'[]'::jsonb) as items
    from portal_private.publications p
    left join portal_private.publication_items pi on pi.publication_key=p.id and pi.lifecycle_state::text='ACTIVE'
    where p.lifecycle_state::text='ACTIVE' and p.authority_state::text='CONFIRMED' and p.status::text='PUBLISHED'
    group by p.id
    order by p.published_at desc nulls last,p.prepared_at desc
    limit 3`;
  const analytics=marketRecords.filter(r=>{if(r.record_type!=='FUNCTIONAL_CONCLUSION')return false;const t=[r.summary,r.recommendation,(r.source_refs||[]).join(' ')].join(' ');return !marketNoise(t)&&marketTerms(t)}).slice(0,12);
  const news=marketRecords.filter(r=>{if(r.record_type!=='HANDOFF_REQUEST')return false;const subject=String(r.subject||'');const t=[subject,r.requested_check,r.reason,(r.source_refs||[]).join(' ')].join(' ');if(marketNoise(t))return false;if(/TECH BLOCKER|OWNER COMMAND — route Telegram Platts PDF ingest/i.test(subject))return false;return marketTerms(t)}).slice(0,18);
  const marketAnalystFragment={generatedAt:new Date().toISOString(),currentOnly:true,identity:marketIdentity?{...marketIdentity,organizationalTitle:'Коммерческий директор'}:{identity_id:'AI-COMMERCIAL-DIRECTOR',role:'COMMERCIAL_DIRECTOR',organizationalTitle:'Коммерческий директор',status:'TO_VERIFY'},analytics,news,currentPublications:marketPublications};

  const payments=await sql`
    select p.payment_id,p.payment_at,p.amount,p.currency,
           coalesce(nullif(p.payer_name,''),cl.legal_name) payer_name,
           p.original_payment_purpose,p.bank_transaction_reference,
           p.bank_fact_status::text bank_fact_status,p.finance_status::text finance_status,
           p.accounting_closure_status::text accounting_closure_status,
           p.source_system,p.source_version,p.source_timestamp,
           cl.client_id,cl.legal_name,ct.contract_id,d.deal_id,
           pa.allocated_amount,pa.allocation_status::text allocation_status,
           plan.obligation_amount,
           case when plan.obligation_amount is null then null else greatest(plan.obligation_amount-coalesce(dr.deal_received_total,0),0) end remaining_amount
    from portal_private.payments p
    left join portal_private.payment_allocations pa on pa.payment_key=p.id
      and pa.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and pa.authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum)
      and pa.allocation_status in ('ALLOCATED'::portal_private.payment_allocation_state_enum,'VERIFIED'::portal_private.payment_allocation_state_enum)
    left join portal_private.clients cl on cl.id=pa.client_key
    left join portal_private.contracts ct on ct.id=pa.contract_key
    left join portal_private.deals d on d.id=pa.deal_key
    left join lateral (select sum(pp.planned_amount) obligation_amount from portal_private.owner_payment_plan pp where pp.deal_key=d.id and pp.status<>'CANCELLED') plan on true
    left join lateral (select sum(x.allocated_amount) deal_received_total from portal_private.payment_allocations x where x.deal_key=d.id and x.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and x.authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum) and x.allocation_status in ('ALLOCATED'::portal_private.payment_allocation_state_enum,'VERIFIED'::portal_private.payment_allocation_state_enum)) dr on true
    where p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and p.authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum)
      and p.bank_fact_status='BANK_CONFIRMED'::portal_private.payment_bank_state_enum
    order by p.payment_at desc,p.payment_id desc,d.deal_id nulls last`;
  const outgoingPayments=await sql`
    select fact_id,payment_at,beneficiary_name,beneficiary_role,amount,currency,purpose,bank_document,deal_ids,deal_allocation_status,flow_kind,bank_fact_status,source_document,source_version,source_timestamp,authority_state,lifecycle_state
    from portal_private.owner_outgoing_payment_facts
    where lifecycle_state='ACTIVE' and authority_state='CONFIRMED' and bank_fact_status='BANK_CONFIRMED'
    order by payment_at desc,fact_id desc`;
  const dealFinanceSummaries=await sql`
    select deal_id,client_id,client_name,obligation_amount,received_amount,currency,client_remaining_amount,finance_status,accounting_status,cash_residual_amount,cash_residual_currency,cash_residual_status,cash_residual_note,source_document,source_version,source_timestamp,authority_state
    from portal_private.owner_deal_finance_summary
    where lifecycle_state='ACTIVE' and authority_state='CONFIRMED'
    order by deal_id`;
  const paymentTotalsByCurrency=await sql`select currency,sum(amount) amount from portal_private.payments where lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum) and bank_fact_status='BANK_CONFIRMED'::portal_private.payment_bank_state_enum group by currency order by currency`;
  const planState=(await sql`select count(*)::int plan_rows from portal_private.owner_payment_plan where status<>'CANCELLED'`)[0]||{plan_rows:0};
  const cash=await sql`select snapshot_date,currency,opening_balance,received_amount,paid_amount,closing_balance,source_system,updated_at from portal_private.owner_cash_snapshots where snapshot_date=(select max(snapshot_date) from portal_private.owner_cash_snapshots) order by currency`;
  const financeFragment={authoritativeSource:'ACCOUNTING_FINANCE_CANONICAL_V011',sourceAsOf:cash[0]?.snapshot_date||null,payments,outgoingPayments,dealFinanceSummaries,paymentTotalsByCurrency,obligationPlanAvailable:Number(planState.plan_rows||0)>0||dealFinanceSummaries.length>0,cash,cashSemantics:'Q3_CUMULATIVE_BANK_TURNS_WITH_CLOSING_BALANCE_AS_OF_SNAPSHOT_DATE'};
  return{generatedAt:new Date().toISOString(),railTariffs,aiRuntime,aiEmployees,homeCoordination,agentRewardsFragment,latestAiConclusions:latestAiConclusions.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,20),marketAnalystFragment,financeFragment}
}
function normalizedShare(v){const n=Number(v);if(!Number.isFinite(n)||n<0)return null;return n>1?n/100:n}
async function agentSync(ctx){const rawPolicy=(await sql`select numeric_value,applies_to,status,updated_at from portal_private.owner_agent_display_policies where policy_key='POSITIVE_ACTUAL_FX_EFFECT_AGENT_VISIBLE_SHARE' and agent_visible=true and status='ACTIVE_DISPLAY_ONLY' limit 1`)[0]||null;const share=rawPolicy?normalizedShare(rawPolicy.numeric_value):null;const displayPolicy=rawPolicy&&share!==null?{positiveActualFxVisibleShare:share,appliesTo:String(rawPolicy.applies_to),status:String(rawPolicy.status),updatedAt:rawPolicy.updated_at,note:'При подтвержденном положительном фактическом курсовом эффекте в ЛК Агента учитывается только разрешенная доля подтвержденной суммы. Прогнозные и неподтвержденные значения не используются.'}:null;const settlements=await sql`select s.settlement_id,d.deal_id,cl.client_id,s.settlement_state::text,s.amount,s.currency,s.payable_confirmed_at,s.paid_at,s.updated_at from portal_private.agent_settlements s join portal_private.deals d on d.id=s.deal_key join portal_private.clients cl on cl.id=d.client_key where s.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and portal_private.agent_user_has_deal_access(${ctx.userId}::uuid,s.deal_key,now()) order by s.created_at desc`;const amountVisible=new Set(['APPROVED','PAYABLE_CONFIRMED','PAID']);return{generatedAt:new Date().toISOString(),displayPolicy,settlements:settlements.map(r=>{const stage=String(r.settlement_state);const visible=amountVisible.has(stage);return{settlementId:String(r.settlement_id),dealId:String(r.deal_id),clientId:String(r.client_id),stage,amount:visible?r.amount:null,currency:visible?r.currency:null,paymentObligationConfirmed:r.payable_confirmed_at!=null,paymentFactConfirmed:r.paid_at!=null,updatedAt:r.updated_at}}),positiveActualFxEffects:[]}}
Deno.serve(async req=>{const ctx=await authContext(req);if(!ctx)return send(401,{ok:false,code:"PORTAL_ACCESS_DENIED"});if(req.method!=="GET")return send(405,{ok:false,code:"METHOD_NOT_ALLOWED"});try{const path=pathOf(req);if(path==="/admin/sync"){requireRole(ctx,"ADMIN");return send(200,{ok:true,data:await adminSync()})}if(path==="/agent/sync"){requireRole(ctx,"AGENT");return send(200,{ok:true,data:await agentSync(ctx)})}return send(404,{ok:false,code:"ROUTE_NOT_FOUND"})}catch(e){console.error("rona-owner-ai-sync error",e);const status=Number(e?.status||500);return send(status>=400&&status<600?status:500,{ok:false,code:String(e?.message||"SERVER_ERROR")})}});
