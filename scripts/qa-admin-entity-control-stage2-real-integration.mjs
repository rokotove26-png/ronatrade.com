import postgres from "npm:postgres@3.4.7";
import {createAdminEntityControl} from "../supabase/functions/rona-admin-control-plane/admin-entity-control-v1.ts";

const url=Deno.env.get("TEST_DATABASE_URL")||"postgres://postgres:postgres@127.0.0.1:5432/rona_stage2";
const sql=postgres(url,{max:1,idle_timeout:2,connect_timeout:10});
const deletedAuthUsers=[];

const U={
  admin:"00000000-0000-4000-8000-000000000001",
  client:"00000000-0000-4000-8000-000000000002",
  agent:"00000000-0000-4000-8000-000000000003",
  adminAuth:"00000000-0000-4000-8000-000000001001",
  clientAuth:"00000000-0000-4000-8000-000000001002",
  agentAuth:"00000000-0000-4000-8000-000000001003",
  adminSession:"00000000-0000-4000-8000-000000002001",
  clientSession:"00000000-0000-4000-8000-000000002002",
  agentSession:"00000000-0000-4000-8000-000000002003",
  companyA:"00000000-0000-4000-8000-000000000101",
  companyB:"00000000-0000-4000-8000-000000000102",
  companyC:"00000000-0000-4000-8000-000000000103",
  contractA:"00000000-0000-4000-8000-000000000201",
  contractB:"00000000-0000-4000-8000-000000000202",
  contractC:"00000000-0000-4000-8000-000000000203",
  agentPerson:"00000000-0000-4000-8000-000000000301",
  dealA:"00000000-0000-4000-8000-000000000401",
  dealB:"00000000-0000-4000-8000-000000000402",
  dealC:"00000000-0000-4000-8000-000000000403",
  assignA:"00000000-0000-4000-8000-000000000601",
  assignB:"00000000-0000-4000-8000-000000000602",
  termA:"00000000-0000-4000-8000-000000000611",
  termB:"00000000-0000-4000-8000-000000000612",
  documentA:"00000000-0000-4000-8000-000000000701",
  paymentA:"00000000-0000-4000-8000-000000000702",
  railA:"00000000-0000-4000-8000-000000000703",
  publication:"00000000-0000-4000-8000-000000000801",
  priceItem:"00000000-0000-4000-8000-000000000802",
  relation:"00000000-0000-4000-8000-000000000901"
};

function assert(v,msg){if(!v)throw new Error("ASSERTION_FAILED: "+msg)}
async function expectCode(fn,code){
  try{await fn()}catch(e){const got=String(e?.message||e);assert(got===code,`expected ${code}, got ${got}`);return e}
  throw new Error("ASSERTION_FAILED: expected error "+code);
}
function request(body=null,headers={}){
  const h=new Headers(headers);
  if(body!==null)h.set("content-type","application/json");
  return new Request("https://stage2.invalid/portal/admin-authority",{method:body===null?"GET":"POST",headers,body:body===null?undefined:JSON.stringify(body)});
}
const ctx={auth:U.adminAuth,user:U.admin,name:"Stage2 Admin",sid:U.adminSession};

async function audit(tx,ctx,action,entityType,entityId,req,metadata={}){
  const rid=req.headers.get("x-request-id")||crypto.randomUUID();
  const corr=req.headers.get("x-correlation-id")||null;
  await tx`
    insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata)
    values(${ctx.user}::uuid,'ADMIN',${action},${entityType},${entityId},${rid}::uuid,${corr}::uuid,${tx.json(metadata)})
  `;
}
async function jsonBody(req){return await req.json()}

const service=createAdminEntityControl({
  sql,
  service:{
    auth:{
      admin:{
        deleteUser:async authUserId=>{
          deletedAuthUsers.push(String(authUserId));
          return{data:{user:null},error:null};
        }
      }
    }
  },
  audit,
  jsonBody
});

async function seed(){
  await sql`
    insert into auth.users(id,email) values
      (${U.adminAuth}::uuid,'admin@stage2.invalid'),
      (${U.clientAuth}::uuid,'client@stage2.invalid'),
      (${U.agentAuth}::uuid,'agent@stage2.invalid')
  `;
  await sql`
    insert into auth.sessions(id,user_id,not_after) values
      (${U.adminSession}::uuid,${U.adminAuth}::uuid,now()+interval '1 day'),
      (${U.clientSession}::uuid,${U.clientAuth}::uuid,now()+interval '1 day'),
      (${U.agentSession}::uuid,${U.agentAuth}::uuid,now()+interval '1 day')
  `;
  await sql`
    insert into portal_private.portal_users(id,auth_user_id,login_name,display_name) values
      (${U.admin}::uuid,${U.adminAuth}::uuid,'stage2-admin','Stage2 Admin'),
      (${U.client}::uuid,${U.clientAuth}::uuid,'stage2-client','Shared Client User'),
      (${U.agent}::uuid,${U.agentAuth}::uuid,'stage2-agent','Agent Person User')
  `;
  await sql`
    insert into portal_private.portal_user_roles(user_id,role) values
      (${U.admin}::uuid,'ADMIN'),
      (${U.client}::uuid,'CLIENT'),
      (${U.agent}::uuid,'AGENT')
  `;
  await sql`
    insert into portal_private.clients(id,client_id,legal_name) values
      (${U.companyA}::uuid,'RONA-C101','Stage2 Company A'),
      (${U.companyB}::uuid,'RONA-C102','Stage2 Company B'),
      (${U.companyC}::uuid,'RONA-C103','Stage2 Company C')
  `;
  await sql`
    insert into portal_private.contracts(id,contract_id,client_key,current_external_contract_number) values
      (${U.contractA}::uuid,'CTR-A',${U.companyA}::uuid,'A-001'),
      (${U.contractB}::uuid,'CTR-B',${U.companyB}::uuid,'B-001'),
      (${U.contractC}::uuid,'CTR-C',${U.companyC}::uuid,'C-001')
  `;
  await sql`
    insert into portal_private.client_user_bindings(user_id,client_key,contract_key) values
      (${U.client}::uuid,${U.companyA}::uuid,${U.contractA}::uuid),
      (${U.client}::uuid,${U.companyB}::uuid,${U.contractB}::uuid)
  `;
  await sql`
    insert into portal_private.agent_persons(id,agent_person_id,full_name,display_alias)
    values(${U.agentPerson}::uuid,'RONA-A001','Agent Stage Two','Agent Stage Two')
  `;
  await sql`
    insert into portal_private.agent_user_bindings(user_id,agent_person_key,agent_legal_entity_key)
    values(${U.agent}::uuid,${U.agentPerson}::uuid,null)
  `;
  await sql`
    insert into portal_private.deals(id,deal_id,client_key,contract_key,business_status,lifecycle_state) values
      (${U.dealA}::uuid,'DEAL-A-HIST',${U.companyA}::uuid,${U.contractA}::uuid,'CLOSED','ARCHIVED'),
      (${U.dealB}::uuid,'DEAL-B-ACTIVE',${U.companyB}::uuid,${U.contractB}::uuid,'EXECUTING','ACTIVE'),
      (${U.dealC}::uuid,'DEAL-C-BLOCK',${U.companyC}::uuid,${U.contractC}::uuid,'EXECUTING','ACTIVE')
  `;
  await sql`
    insert into portal_private.agent_client_assignments(id,agent_person_key,client_key) values
      (${U.assignA}::uuid,${U.agentPerson}::uuid,${U.companyA}::uuid),
      (${U.assignB}::uuid,${U.agentPerson}::uuid,${U.companyB}::uuid)
  `;
  await sql`
    insert into portal_private.agent_deal_terms(id,assignment_id,client_key,deal_key) values
      (${U.termA}::uuid,${U.assignA}::uuid,${U.companyA}::uuid,${U.dealA}::uuid),
      (${U.termB}::uuid,${U.assignB}::uuid,${U.companyB}::uuid,${U.dealB}::uuid)
  `;
  await sql`
    insert into portal_private.agent_user_relation_control(id,agent_person_key,relation_status)
    values(${U.relation}::uuid,${U.agentPerson}::uuid,'ACTIVE')
  `;
  await sql`
    insert into portal_private.portal_sessions_control(user_id,session_subject,status) values
      (${U.client}::uuid,${U.clientSession},'ACTIVE'),
      (${U.agent}::uuid,${U.agentSession},'ACTIVE')
  `;
  await sql`
    insert into portal_private.documents(id,document_id,client_key,contract_key,deal_key,lifecycle_state)
    values(${U.documentA}::uuid,'DOC-A-HIST',${U.companyA}::uuid,${U.contractA}::uuid,${U.dealA}::uuid,'ACTIVE')
  `;
  await sql`
    insert into portal_private.payment_allocations(id,client_key,contract_key,deal_key)
    values(${U.paymentA}::uuid,${U.companyA}::uuid,${U.contractA}::uuid,${U.dealA}::uuid)
  `;
  await sql`
    insert into portal_private.rail_documents(id,client_key,deal_key)
    values(${U.railA}::uuid,${U.companyA}::uuid,${U.dealA}::uuid)
  `;
  await sql`
    insert into portal_private.publications(id,publication_id,status,audience)
    values(${U.publication}::uuid,'PUB-STAGE2','PUBLISHED','ALL_CLIENTS')
  `;
  await sql`
    insert into portal_private.publication_items(
      id,publication_key,item_type,distribution_allowed,audience,valid_from,valid_to,
      product,price,currency,payment_terms,basis,delivery_period_from,delivery_period_to
    ) values(
      ${U.priceItem}::uuid,${U.publication}::uuid,'PRICE',true,'ALL_CLIENTS',
      now()-interval '1 day',now()+interval '30 day','DIESEL',1000,'USD','100% PREPAY','FCA',
      current_date,current_date+30
    )
  `;
}


async function applicationMutationCounts(){
  const rows=await sql`
    select
      (select count(*)::int from portal_private.client_applications) applications,
      (select count(*)::int from portal_private.application_lines) lines,
      (select count(*)::int from portal_private.portal_reverse_events) reverse_events,
      (select count(*)::int from portal_private.client_application_bundle_receipts_v2) bundle_receipts,
      (select count(*)::int from portal_private.audit_events) audit_events
  `;
  return rows[0];
}
async function expectApplicationZeroMutation(fn,code){
  const before=await applicationMutationCounts();
  await expectCode(fn,code);
  const after=await applicationMutationCounts();
  assert(JSON.stringify(before)===JSON.stringify(after),`zero mutation for ${code}`);
}

async function main(){
  await seed();

  // Shared Client really owns A+B, so Company impersonation must be hard-bound.
  const targetsA=await service.targets("COMPANY","RONA-C101");
  assert(targetsA.users.length===1,"Company A deterministic target");
  assert(String(targetsA.users[0].portal_user_id)===U.client,"Company A target is shared Client user");
  const contexts=await sql`
    select count(distinct client_key)::int n
    from portal_private.client_user_bindings
    where user_id=${U.client}::uuid and status='ACTIVE'
  `;
  assert(Number(contexts[0].n)===2,"fixture proves shared Client user has two Companies");

  const impA=await service.start(ctx,request({kind:"COMPANY",entityId:"RONA-C101"}));
  assert(impA.impersonation.effectivePortalUserId===U.client,"Client effective subject");
  assert(impA.impersonation.targetClientKey===U.companyA,"Company A hard-bound context");
  const resolvedA=await service.resolve(ctx,request(null,{"x-rona-admin-impersonation-token":impA.impersonationToken}));
  assert(resolvedA.targetClientKey===U.companyA,"refresh/resolve keeps Company A bound");
  await expectCode(()=>service.resolve(ctx,request(null,{})),"IMPERSONATION_SESSION_INVALID");

  const appReq=crypto.randomUUID(),appCorr=crypto.randomUUID();
  const standardBody={
    clientId:'RONA-C101',contractId:'CTR-A',publicationItemId:U.priceItem,quantityTonnes:100,
    priceMode:'ACCEPT_PUBLISHED_PRICE',proposedPrice:null,proposedCurrency:null,
    destinationCountry:'Kyrgyzstan',destinationStation:'Bishkek',
    deliveryPeriodFrom:'2026-09-20',deliveryPeriodTo:'2026-09-30',idempotencyKey:'stage3a-client-application',
    applicationDetails:{message_type:'APPLICATION_DETAILS_V5',client_id:'RONA-C101',contract_id:'CTR-A',
      quantity_tonnes:100,reference:{publication_item_id:U.priceItem},comment:'Stage3A atomic application'}
  };
  const appRows=await sql`
    select portal_private.submit_admin_impersonated_client_application_bundle_v2(
      ${impA.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.client}::uuid,
      ${sql.json(standardBody)}::jsonb,${appReq}::uuid,${appCorr}::uuid
    ) receipt
  `;
  const appReceipt=appRows[0].receipt;
  assert(appReceipt?.bundle_complete===true&&appReceipt?.business_contract==='RONA_APPLICATION_BUSINESS_V2',"APPLICATION_IMPERSONATED_CREATE");
  const appId=String(appReceipt.application_id);
  const appSubject=await sql`select client_key::text,contract_key::text,status::text from portal_private.client_applications where application_id=${appId}`;
  assert(String(appSubject[0].client_key)===U.companyA&&String(appSubject[0].contract_key)===U.contractA,"APPLICATION_EFFECTIVE_CLIENT_SUBJECT");
  const appDetailEvent=await sql`select actor_user_id::text,actor_auth_user_id::text,actor_role::text,client_key::text from portal_private.portal_reverse_events where authority_domain='APPLICATION' and authority_target_id=${appId} limit 1`;
  assert(String(appDetailEvent[0].actor_user_id)===U.client&&String(appDetailEvent[0].actor_auth_user_id)===U.adminAuth&&String(appDetailEvent[0].actor_role)==='CLIENT',"application details use effective Client subject");
  const appAudit=await sql`select actor_user_id::text,actor_role,metadata,request_id::text,correlation_id::text from portal_private.audit_events where action='APPLICATION_BUSINESS_V2_SUBMIT_IMPERSONATED' and entity_id=${appId} limit 1`;
  assert(String(appAudit[0].actor_user_id)===U.admin&&String(appAudit[0].actor_role)==='ADMIN',"APPLICATION_REAL_ADMIN_AUDIT");
  assert(String(appAudit[0].metadata.effective_portal_user_id)===U.client&&String(appAudit[0].metadata.target_client_key)===U.companyA,"application audit preserves effective Client and target Company");
  assert(String(appAudit[0].request_id)===appReq&&String(appAudit[0].correlation_id)===appCorr,"application audit preserves request/correlation ids");

  const deliveredReq=crypto.randomUUID(),deliveredCorr=crypto.randomUUID();
  const deliveredBody={role:'CLIENT',event_type:'CLIENT_MESSAGE_SUBMIT',authority_domain:'PRICE_CALCULATION',
    authority_target_type:'PUBLICATION_ITEM',authority_target_id:U.priceItem,client_id:'RONA-C101',contract_id:'CTR-A',
    payload:{message_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',client_id:'RONA-C101',contract_id:'CTR-A',
      product:'DIESEL',quantity_tonnes:75,destination:{station:'Bishkek'},reference:{publication_item_id:U.priceItem},
      shipment:{source_basis:'FCA'},commercial:{payment_terms:'TO_BE_AGREED'}},idempotency_key:'stage3a-delivered-price'};
  const deliveredRows=await sql`
    select portal_private.submit_admin_impersonated_delivered_application_bundle_v2(
      ${impA.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.client}::uuid,
      ${sql.json(deliveredBody)}::jsonb,${deliveredReq}::uuid,${deliveredCorr}::uuid
    ) receipt
  `;
  const deliveredReceipt=deliveredRows[0].receipt;
  assert(deliveredReceipt?.bundle_complete===true,"APPLICATION_IMPERSONATED_DELIVERED_PRICE_WRITE");
  const deliveredId=String(deliveredReceipt.application_id);
  const deliveredApp=await sql`select client_key::text,contract_key::text,price_mode::text from portal_private.client_applications where application_id=${deliveredId}`;
  assert(String(deliveredApp[0].client_key)===U.companyA&&String(deliveredApp[0].price_mode)==='REQUEST_DELIVERED_PRICE',"delivered-price application is Company A effective Client business row");

  const secondCompanyBody={...standardBody,clientId:'RONA-C102',contractId:'CTR-B',idempotencyKey:'stage3a-second-company',applicationDetails:{...standardBody.applicationDetails,client_id:'RONA-C102',contract_id:'CTR-B'}};
  await expectApplicationZeroMutation(()=>sql`select portal_private.submit_admin_impersonated_client_application_bundle_v2(${impA.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.client}::uuid,${sql.json(secondCompanyBody)}::jsonb,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid)`,`APPLICATION_IMPERSONATION_AUTHORITY_DENIED`);
  const forgedKeyBody={...standardBody,idempotencyKey:'stage3a-forged-key',client_key:U.companyB};
  await expectApplicationZeroMutation(()=>sql`select portal_private.submit_admin_impersonated_client_application_bundle_v2(${impA.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.client}::uuid,${sql.json(forgedKeyBody)}::jsonb,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid)`,`IMPERSONATION_TARGET_CLIENT_KEY_MISMATCH`);
  await expectApplicationZeroMutation(()=>sql`select portal_private.submit_admin_impersonated_client_application_bundle_v2(${impA.impersonation.id}::uuid,${U.client}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.client}::uuid,${sql.json({...standardBody,idempotencyKey:'stage3a-admin-mismatch'})}::jsonb,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid)`,`APPLICATION_IMPERSONATION_AUTHORITY_DENIED`);
  await expectApplicationZeroMutation(()=>sql`select portal_private.submit_admin_impersonated_client_application_bundle_v2(${impA.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.agent}::uuid,${sql.json({...standardBody,idempotencyKey:'stage3a-effective-mismatch'})}::jsonb,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid)`,`APPLICATION_IMPERSONATION_AUTHORITY_DENIED`);

  await sql`update portal_private.client_user_bindings set status='SUSPENDED' where user_id=${U.client}::uuid and client_key=${U.companyA}::uuid`;
  await expectApplicationZeroMutation(()=>sql`select portal_private.submit_admin_impersonated_client_application_bundle_v2(${impA.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.client}::uuid,${sql.json({...standardBody,idempotencyKey:'stage3a-binding-inactive'})}::jsonb,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid)`,`APPLICATION_IMPERSONATION_AUTHORITY_DENIED`);
  await sql`update portal_private.client_user_bindings set status='ACTIVE' where user_id=${U.client}::uuid and client_key=${U.companyA}::uuid`;
  await sql`update portal_private.portal_user_roles set status='SUSPENDED' where user_id=${U.client}::uuid and role='CLIENT'`;
  await expectApplicationZeroMutation(()=>sql`select portal_private.submit_admin_impersonated_client_application_bundle_v2(${impA.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.client}::uuid,${sql.json({...standardBody,idempotencyKey:'stage3a-client-authority-inactive'})}::jsonb,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid)`,`APPLICATION_IMPERSONATION_AUTHORITY_DENIED`);
  await sql`update portal_private.portal_user_roles set status='ACTIVE' where user_id=${U.client}::uuid and role='CLIENT'`;
  await sql`update portal_private.admin_impersonation_sessions set started_at=now()-interval '2 minutes',expires_at=now()-interval '1 second',updated_at=now() where id=${impA.impersonation.id}::uuid`;
  await expectApplicationZeroMutation(()=>sql`select portal_private.submit_admin_impersonated_client_application_bundle_v2(${impA.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.client}::uuid,${sql.json({...standardBody,idempotencyKey:'stage3a-expired'})}::jsonb,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid)`,`APPLICATION_IMPERSONATION_AUTHORITY_DENIED`);
  await sql`update portal_private.admin_impersonation_sessions set started_at=now(),expires_at=now()+interval '12 minutes',updated_at=now() where id=${impA.impersonation.id}::uuid`;
  await sql`update portal_private.admin_impersonation_sessions set status='REVOKED',ended_at=now(),end_reason='TEST_REVOKED' where id=${impA.impersonation.id}::uuid`;
  await expectApplicationZeroMutation(()=>sql`select portal_private.submit_admin_impersonated_client_application_bundle_v2(${impA.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.client}::uuid,${sql.json({...standardBody,idempotencyKey:'stage3a-revoked'})}::jsonb,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid)`,`APPLICATION_IMPERSONATION_AUTHORITY_DENIED`);
  await sql`update portal_private.admin_impersonation_sessions set status='ACTIVE',ended_at=null,end_reason=null where id=${impA.impersonation.id}::uuid`;

  // Close integration-created applications so later Company retirement preview remains eligible.
  await sql`update portal_private.client_applications set status='CLOSED',lifecycle_state='ARCHIVED',updated_at=now() where application_id in (${appId},${deliveredId})`;


  // New impersonation deterministically revokes the old one.
  const impB=await service.start(ctx,request({kind:"COMPANY",entityId:"RONA-C102"}));
  await expectApplicationZeroMutation(()=>sql`select portal_private.submit_admin_impersonated_client_application_bundle_v2(${impA.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.client}::uuid,${sql.json({...standardBody,idempotencyKey:'stage3a-replaced'})}::jsonb,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid)`,"APPLICATION_IMPERSONATION_AUTHORITY_DENIED");
  const oldState=await sql`select status from portal_private.admin_impersonation_sessions where id=${impA.impersonation.id}::uuid`;
  assert(String(oldState[0].status)==="REVOKED","new impersonation revokes old session");
  await expectCode(()=>service.resolve(ctx,request(null,{"x-rona-admin-impersonation-token":impA.impersonationToken})),"IMPERSONATION_SESSION_INVALID");

  // A stale tab cannot terminate the newer session.
  await expectCode(()=>service.end(ctx,request(null,{
    "x-rona-admin-impersonation-token":impB.impersonationToken,
    "x-rona-impersonation-tab":impA.impersonation.id
  })),"IMPERSONATION_TAB_INVALID");
  let bState=await sql`select status from portal_private.admin_impersonation_sessions where id=${impB.impersonation.id}::uuid`;
  assert(String(bState[0].status)==="ACTIVE","stale tab leaves replacement session active");

  await service.end(ctx,request(null,{
    "x-rona-admin-impersonation-token":impB.impersonationToken,
    "x-rona-impersonation-tab":impB.impersonation.id
  }));
  bState=await sql`select status from portal_private.admin_impersonation_sessions where id=${impB.impersonation.id}::uuid`;
  assert(String(bState[0].status)==="ENDED","valid Return Admin ends target context");
  const adminStill=await sql`
    select exists(select 1 from auth.sessions where id=${U.adminSession}::uuid and user_id=${U.adminAuth}::uuid) session_ok,
           exists(select 1 from portal_private.portal_user_roles where user_id=${U.admin}::uuid and role='ADMIN' and status='ACTIVE') role_ok
  `;
  assert(adminStill[0].session_ok&&adminStill[0].role_ok,"Return Admin preserves original Admin session/role");

  // Agent Person V2 impersonation and a real allowed Agent mutation.
  const agentTargets=await service.targets("AGENT","RONA-A001");
  assert(agentTargets.users.length===1&&agentTargets.canImpersonate===true,"Agent deterministic target");
  const impAgent=await service.start(ctx,request({kind:"AGENT",entityId:"RONA-A001"}));
  assert(impAgent.impersonation.targetAgentPersonKey===U.agentPerson,"Agent Person hard bound");
  const resolveAgent1=await service.resolve(ctx,request(null,{"x-rona-admin-impersonation-token":impAgent.impersonationToken}));
  const resolveAgent2=await service.resolve(ctx,request(null,{"x-rona-admin-impersonation-token":impAgent.impersonationToken}));
  assert(resolveAgent1.id===resolveAgent2.id,"valid refresh retains impersonation");

  const evtReq=crypto.randomUUID(),evtCorr=crypto.randomUUID();
  const evt=await sql`
    select * from portal_private.server_admin_impersonated_submit_reverse_event(
      ${impAgent.impersonation.id}::uuid,${U.admin}::uuid,${U.adminAuth}::uuid,${U.adminSession}::uuid,${U.agent}::uuid,
      'AGENT_MESSAGE_SUBMIT','AGENT_COMMUNICATION','DEAL','DEAL-B-ACTIVE',
      'RONA-C102','CTR-B','DEAL-B-ACTIVE',${sql.json({message:"Stage2 Agent action"})}::jsonb,
      'stage2-agent-event',${evtReq}::uuid,${evtCorr}::uuid
    )
  `;
  assert(evt.length===1,"Agent mutation succeeds with effective Agent authority");
  const eventRow=await sql`
    select actor_user_id::text,actor_auth_user_id::text,actor_role::text,event_id
    from portal_private.portal_reverse_events where id=${evt[0].event_key}::uuid
  `;
  assert(String(eventRow[0].actor_user_id)===U.agent,"business event retains effective Agent subject");
  assert(String(eventRow[0].actor_auth_user_id)===U.adminAuth,"business event records real Admin auth actor");
  assert(String(eventRow[0].actor_role)==="AGENT","business event keeps target role semantics");
  const eventAudit=await sql`
    select actor_user_id::text,actor_role,metadata
    from portal_private.audit_events
    where action='REVERSE_EVENT_SUBMIT_IMPERSONATED' and entity_id=${eventRow[0].event_id}
    limit 1
  `;
  assert(String(eventAudit[0].actor_user_id)===U.admin&&String(eventAudit[0].actor_role)==="ADMIN","Agent mutation audit is Admin-owned");
  assert(String(eventAudit[0].metadata.effective_portal_user_id)===U.agent,"Agent audit retains effective subject");

  // Expiry fails closed.
  await sql`update portal_private.admin_impersonation_sessions set started_at=now()-interval '2 minutes',expires_at=now()-interval '1 second',updated_at=now() where id=${impAgent.impersonation.id}::uuid`;
  await expectCode(()=>service.resolve(ctx,request(null,{"x-rona-admin-impersonation-token":impAgent.impersonationToken})),"IMPERSONATION_SESSION_INVALID");

  // Active Deal Company delete is a hard blocker with zero mutation.
  const opBefore=await sql`select count(*)::int n from portal_private.admin_entity_retirement_operations where entity_key=${U.companyC}::uuid`;
  const cBefore=await sql`select lifecycle_state::text,updated_at from portal_private.clients where id=${U.companyC}::uuid`;
  await expectCode(()=>service.preview(ctx,request({}),"COMPANY","RONA-C103"),"ACTIVE_DEALS_DECISION_REQUIRED");
  const opAfter=await sql`select count(*)::int n from portal_private.admin_entity_retirement_operations where entity_key=${U.companyC}::uuid`;
  const cAfter=await sql`select lifecycle_state::text,updated_at from portal_private.clients where id=${U.companyC}::uuid`;
  assert(Number(opBefore[0].n)===Number(opAfter[0].n),"active Deal blocker creates no retirement operation");
  assert(JSON.stringify(cBefore)===JSON.stringify(cAfter),"active Deal blocker mutates no Company state");

  // Archive snapshot before Company A retirement.
  const archiveBefore={
    deal:await sql`select * from portal_private.deals where id=${U.dealA}::uuid`,
    document:await sql`select * from portal_private.documents where id=${U.documentA}::uuid`,
    payment:await sql`select * from portal_private.payment_allocations where id=${U.paymentA}::uuid`,
    rail:await sql`select * from portal_private.rail_documents where id=${U.railA}::uuid`,
    application:await sql`select application_id,status::text,lifecycle_state::text from portal_private.client_applications where application_id=${appId}`
  };

  const companyPre=await service.preview(ctx,request({}),"COMPANY","RONA-C101");
  assert(companyPre.preview.archive.deals===1,"Company preview observes archived historical Deal");
  const companyResult=await service.execute(ctx,request({
    operationId:companyPre.operationId,
    confirmationNonce:companyPre.confirmationNonce
  }),"COMPANY","RONA-C101");
  assert(companyResult.status==="COMPLETED","Company retirement completes");

  const companyPost=await sql`
    select
      (select lifecycle_state::text from portal_private.clients where id=${U.companyA}::uuid) company_a,
      (select lifecycle_state::text from portal_private.clients where id=${U.companyB}::uuid) company_b,
      (select status::text from portal_private.client_user_bindings where user_id=${U.client}::uuid and client_key=${U.companyA}::uuid) binding_a,
      (select status::text from portal_private.client_user_bindings where user_id=${U.client}::uuid and client_key=${U.companyB}::uuid) binding_b,
      (select status::text from portal_private.portal_users where id=${U.client}::uuid) shared_user_status,
      (select auth_user_id::text from portal_private.portal_users where id=${U.client}::uuid) shared_auth,
      (select status::text from portal_private.portal_user_roles where user_id=${U.client}::uuid and role='CLIENT') shared_client_role
  `;
  assert(String(companyPost[0].company_a)==="ARCHIVED","Company A retired from active contour");
  assert(String(companyPost[0].company_b)==="ACTIVE","Company B remains active");
  assert(String(companyPost[0].binding_a)==="REVOKED","Company A binding revoked");
  assert(String(companyPost[0].binding_b)==="ACTIVE","shared user Company B binding preserved");
  assert(String(companyPost[0].shared_user_status)==="ACTIVE","shared Portal user preserved");
  assert(String(companyPost[0].shared_auth)===U.clientAuth,"shared Client auth identity preserved");
  assert(String(companyPost[0].shared_client_role)==="ACTIVE","shared Client role preserved");
  assert(!deletedAuthUsers.includes(U.clientAuth),"shared Client Auth user was not deleted");

  const archiveAfter={
    deal:await sql`select * from portal_private.deals where id=${U.dealA}::uuid`,
    document:await sql`select * from portal_private.documents where id=${U.documentA}::uuid`,
    payment:await sql`select * from portal_private.payment_allocations where id=${U.paymentA}::uuid`,
    rail:await sql`select * from portal_private.rail_documents where id=${U.railA}::uuid`,
    application:await sql`select application_id,status::text,lifecycle_state::text from portal_private.client_applications where application_id=${appId}`
  };
  assert(JSON.stringify(archiveBefore)===JSON.stringify(archiveAfter),"Company retirement leaves Deal/Documents/Finance/Rail/Application history unchanged");

  // Retiring Agent Person closes only Agent authority and preserves Companies/history.
  const clientsBeforeAgent=await sql`select id::text,client_id,lifecycle_state::text from portal_private.clients order by client_id`;
  const assignmentCountBefore=await sql`select count(*)::int n from portal_private.agent_client_assignments where agent_person_key=${U.agentPerson}::uuid`;
  const termCountBefore=await sql`
    select count(*)::int n from portal_private.agent_deal_terms t
    join portal_private.agent_client_assignments a on a.id=t.assignment_id
    where a.agent_person_key=${U.agentPerson}::uuid
  `;
  const agentPre=await service.preview(ctx,request({}),"AGENT","RONA-A001");
  const agentResult=await service.execute(ctx,request({
    operationId:agentPre.operationId,
    confirmationNonce:agentPre.confirmationNonce
  }),"AGENT","RONA-A001");
  assert(agentResult.status==="COMPLETED","Agent retirement completes");

  const agentPost=await sql`
    select
      (select lifecycle_state::text from portal_private.agent_persons where id=${U.agentPerson}::uuid) person_state,
      (select status::text from portal_private.agent_user_bindings where agent_person_key=${U.agentPerson}::uuid) binding_state,
      (select status::text from portal_private.portal_user_roles where user_id=${U.agent}::uuid and role='AGENT') role_state,
      (select status::text from portal_private.portal_users where id=${U.agent}::uuid) user_state,
      (select auth_user_id::text from portal_private.portal_users where id=${U.agent}::uuid) auth_link,
      (select relation_status from portal_private.agent_user_relation_control where id=${U.relation}::uuid) relation_state
  `;
  assert(String(agentPost[0].person_state)==="ARCHIVED","Agent Person archived");
  assert(String(agentPost[0].binding_state)==="REVOKED","Agent Portal binding revoked");
  assert(String(agentPost[0].role_state)==="REVOKED","AGENT role revoked");
  assert(String(agentPost[0].user_state)==="ARCHIVED","exclusive Agent Portal user archived");
  assert(agentPost[0].auth_link===null,"exclusive Agent auth link removed only after active authority closed");
  assert(String(agentPost[0].relation_state)==="REVOKED","Agent relation control retired");
  assert(deletedAuthUsers.includes(U.agentAuth),"exclusive Agent Auth cleanup executed");

  const clientsAfterAgent=await sql`select id::text,client_id,lifecycle_state::text from portal_private.clients order by client_id`;
  assert(JSON.stringify(clientsBeforeAgent)===JSON.stringify(clientsAfterAgent),"Agent retirement does not alter Companies");
  const assignmentCountAfter=await sql`select count(*)::int n from portal_private.agent_client_assignments where agent_person_key=${U.agentPerson}::uuid`;
  const termCountAfter=await sql`
    select count(*)::int n from portal_private.agent_deal_terms t
    join portal_private.agent_client_assignments a on a.id=t.assignment_id
    where a.agent_person_key=${U.agentPerson}::uuid
  `;
  assert(Number(assignmentCountBefore[0].n)===Number(assignmentCountAfter[0].n),"Agent assignments preserved as historical rows");
  assert(Number(termCountBefore[0].n)===Number(termCountAfter[0].n),"Agent deal terms preserved as historical rows");

  const matrix={
    FULL_CLIENT_IMPERSONATION:"PASS",
    FULL_AGENT_IMPERSONATION:"PASS",
    ADMIN_RETURN:"PASS",
    DUAL_IDENTITY_AUDIT:"PASS",
    CLIENT_CONTEXT_HARD_BOUND:"PASS",
    ACTIVE_DEAL_DELETE_BLOCK:"PASS",
    COMPANY_RETIREMENT_ATOMIC:"PASS",
    AGENT_RETIREMENT_ATOMIC:"PASS",
    ARCHIVE_PROTECTION:"PASS",
    SHARED_USER_PROTECTION:"PASS",
    AGENT_PERSON_V2_PRESERVED:"PASS",
    PARALLEL_TABS:"PASS",
    EXPIRED_REVOKED_FAIL_CLOSED:"PASS",
    APPLICATION_IMPERSONATED_CREATE:"PASS",
    APPLICATION_IMPERSONATED_DELIVERED_PRICE_WRITE:"PASS",
    APPLICATION_REAL_ADMIN_AUDIT:"PASS",
    APPLICATION_EFFECTIVE_CLIENT_SUBJECT:"PASS",
    APPLICATION_COMPANY_HARD_BOUND:"PASS",
    APPLICATION_SHARED_USER_SECOND_COMPANY_DENIED:"PASS",
    APPLICATION_EXPIRED_SESSION_DENIED:"PASS",
    APPLICATION_REVOKED_SESSION_DENIED:"PASS",
    APPLICATION_PARTIAL_WRITE_ZERO:"PASS"
  };
  console.log(JSON.stringify({stage:"ADMIN_ENTITY_CONTROL_STAGE2_REAL_INTEGRATION",matrix,deletedAuthUsers},null,2));
}

try{
  await main();
}finally{
  await sql.end({timeout:1});
}
