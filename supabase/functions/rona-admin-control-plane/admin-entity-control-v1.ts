import {
  resolveAdminImpersonation,
  sha256Hex,
  type AdminActor,
  type AdminImpersonation
} from "../_shared/admin-impersonation-authority-v1.ts";

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL_APPLICATIONS=new Set(["REJECTED","CANCELLED","CLOSED","DEAL_REGISTERED"]);
const RETIREMENT_TTL_MS=10*60*1000;
const IMPERSONATION_TTL_MS=12*60*1000;

type AdminCtx={auth:string;user:string;name:string;sid:string};

function fail(code:string,status=400):never{
  throw Object.assign(new Error(code),{status});
}
function text(value:unknown,name:string,max=240){
  const out=String(value??"").trim();
  if(!out||out.length>max)fail("INVALID_"+name,400);
  return out;
}
function base64Url(bytes:Uint8Array){
  let raw="";
  for(const b of bytes)raw+=String.fromCharCode(b);
  return btoa(raw).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
function opaqueToken(){
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}
function actor(ctx:AdminCtx):AdminActor{
  return{authUserId:ctx.auth,portalUserId:ctx.user,sessionId:ctx.sid,displayName:ctx.name,roles:["ADMIN"]};
}
function headerToken(req:Request){
  return String(req.headers.get("x-rona-admin-impersonation-token")||"").trim();
}
function stable(value:unknown){return JSON.stringify(value)}
async function hashJson(value:unknown){return sha256Hex(stable(value))}
function terminalApplication(status:unknown){return TERMINAL_APPLICATIONS.has(String(status||"").toUpperCase())}

export function createAdminEntityControl(deps:{
  sql:any;
  service:any;
  audit:(tx:any,ctx:AdminCtx,action:string,entityType:string,entityId:string,req:Request,metadata?:Record<string,unknown>)=>Promise<void>;
  jsonBody:(req:Request)=>Promise<Record<string,any>>;
}){
  const{sql,service,audit,jsonBody}=deps;

  async function companyUsers(clientId:string){
    return await sql`
      select distinct
        u.id::text portal_user_id,
        u.display_name,
        u.login_name
      from portal_private.clients cl
      join portal_private.client_user_bindings b on b.client_key=cl.id
      join portal_private.portal_users u on u.id=b.user_id
      join portal_private.portal_user_roles r
        on r.user_id=u.id
       and r.role='CLIENT'::portal_private.portal_role_enum
       and r.status='ACTIVE'::portal_private.binding_status_enum
       and r.revoked_at is null
      where cl.client_id=${clientId}
        and cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and cl.authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
        and b.status='ACTIVE'::portal_private.binding_status_enum
        and b.revoked_at is null
        and b.valid_from<=now()
        and (b.valid_to is null or b.valid_to>now())
        and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and portal_private.client_user_has_contract_access(u.id,b.contract_key,now())
        and u.status='ACTIVE'::portal_private.portal_user_status_enum
        and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and u.authority_state='CONFIRMED'::portal_private.authority_state_enum
      order by u.display_name,u.id::text
    `;
  }

  async function agentUsers(agentPersonId:string){
    return await sql`
      select distinct
        u.id::text portal_user_id,
        u.display_name,
        u.login_name
      from portal_private.agent_persons ap
      join portal_private.agent_user_bindings b on b.agent_person_key=ap.id
      join portal_private.portal_users u on u.id=b.user_id
      join portal_private.portal_user_roles r
        on r.user_id=u.id
       and r.role='AGENT'::portal_private.portal_role_enum
       and r.status='ACTIVE'::portal_private.binding_status_enum
       and r.revoked_at is null
      where ap.agent_person_id=${agentPersonId}
        and ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and ap.authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
        and b.status='ACTIVE'::portal_private.binding_status_enum
        and b.revoked_at is null
        and b.valid_from<=now()
        and (b.valid_to is null or b.valid_to>now())
        and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and u.status='ACTIVE'::portal_private.portal_user_status_enum
        and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and u.authority_state='CONFIRMED'::portal_private.authority_state_enum
      order by u.display_name,u.id::text
    `;
  }

  async function targets(kind:string,entityId:string){
    if(kind==="COMPANY"){
      const entity=await sql`
        select id::text entity_key,client_id entity_id,legal_name display_name
        from portal_private.clients
        where client_id=${entityId}
          and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        limit 1
      `;
      if(entity.length!==1)fail("COMPANY_NOT_FOUND",404);
      const users=await companyUsers(entityId);
      return{
        kind,
        entity:entity[0],
        users,
        canImpersonate:true,
        selectionRequired:users.length>1,
        subjectMode:users.length?"PORTAL_USER":"ADMIN_ENTITY",
        readOnly:users.length===0,
        disabledReason:null
      };
    }
    if(kind==="AGENT"){
      const entity=await sql`
        select id::text entity_key,agent_person_id entity_id,coalesce(display_alias,full_name,agent_person_id) display_name
        from portal_private.agent_persons
        where agent_person_id=${entityId}
          and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          and authority_state not in ('REJECTED'::portal_private.authority_state_enum,'SUPERSEDED'::portal_private.authority_state_enum)
        limit 1
      `;
      if(entity.length!==1)fail("AGENT_NOT_FOUND",404);
      const users=await agentUsers(entityId);
      return{
        kind,
        entity:entity[0],
        users,
        canImpersonate:users.length===1,
        invariantViolation:users.length>1,
        selectionRequired:false,
        disabledReason:users.length===0?"TARGET_PORTAL_USER_NOT_FOUND":users.length>1?"AGENT_PORTAL_USER_INVARIANT_VIOLATION":null
      };
    }
    fail("INVALID_ENTITY_KIND",400);
  }

  async function start(ctx:AdminCtx,req:Request){
    const body=await jsonBody(req);
    const kind=text(body.kind,"KIND",16).toUpperCase();
    const entityId=text(body.entityId,"ENTITY_ID",160);
    const returnView=kind==="AGENT"?"agents":"companies";
    const info=await targets(kind,entityId);
    const users=Array.isArray(info.users)?info.users:[];
    const adminEntity=kind==="COMPANY"&&users.length===0;
    if(kind==="AGENT"&&users.length!==1)fail(users.length===0?"TARGET_PORTAL_USER_NOT_FOUND":"AGENT_PORTAL_USER_INVARIANT_VIOLATION",409);
    const requested=String(body.targetPortalUserId||"").trim();
    if(kind==="COMPANY"&&users.length>1&&!requested)fail("TARGET_PORTAL_USER_SELECTION_REQUIRED",409);
    const selected=adminEntity
      ?{portal_user_id:ctx.user,display_name:ctx.name,login_name:null}
      :users.length===1?users[0]:users.find((u:any)=>String(u.portal_user_id)===requested);
    if(!selected)fail("TARGET_PORTAL_USER_NOT_FOUND",409);
    const subjectMode=adminEntity?"ADMIN_ENTITY":"PORTAL_USER";
    if(kind==="AGENT"){
      const activePersons=await sql`
        select count(distinct agent_person_key)::int n
        from portal_private.agent_user_bindings
        where user_id=${selected.portal_user_id}::uuid
          and status='ACTIVE'::portal_private.binding_status_enum
          and revoked_at is null
          and valid_from<=now()
          and (valid_to is null or valid_to>now())
          and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      `;
      if(Number(activePersons[0]?.n||0)!==1)fail("AGENT_PORTAL_USER_INVARIANT_VIOLATION",409);
    }
    const token=opaqueToken(),tokenHash=await sha256Hex(token);
    const correlationId=crypto.randomUUID();
    const expiresAt=new Date(Date.now()+IMPERSONATION_TTL_MS).toISOString();
    const row=await sql.begin(async(tx:any)=>{
      await tx`select pg_advisory_xact_lock(hashtextextended('ADMIN_IMPERSONATION:'||${ctx.sid},0))`;
      await tx`
        update portal_private.admin_impersonation_sessions
        set status='REVOKED',ended_at=coalesce(ended_at,now()),end_reason='REPLACED_BY_NEW_SESSION',updated_at=now()
        where actor_admin_session_id=${ctx.sid}::uuid
          and status='ACTIVE' and ended_at is null
      `;
      let targetClientKey:string|null=null,targetAgentPersonKey:string|null=null;
      if(kind==="COMPANY"){
        const x=await tx`select id::text from portal_private.clients where client_id=${entityId} and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum for update`;
        if(x.length!==1)fail("COMPANY_NOT_FOUND",404);
        targetClientKey=String(x[0].id);
      }else{
        const x=await tx`select id::text from portal_private.agent_persons where agent_person_id=${entityId} and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum for update`;
        if(x.length!==1)fail("AGENT_NOT_FOUND",404);
        targetAgentPersonKey=String(x[0].id);
      }
      const inserted=await tx`
        insert into portal_private.admin_impersonation_sessions(
          token_hash,actor_admin_portal_user_id,actor_admin_auth_user_id,actor_admin_session_id,
          effective_portal_user_id,effective_role,target_client_key,target_agent_person_key,
          return_view,correlation_id,expires_at,metadata
        ) values(
          ${tokenHash},${ctx.user}::uuid,${ctx.auth}::uuid,${ctx.sid}::uuid,
          ${selected.portal_user_id}::uuid,${kind==="AGENT"?"AGENT":"CLIENT"}::portal_private.portal_role_enum,
          ${targetClientKey}::uuid,${targetAgentPersonKey}::uuid,
          ${returnView},${correlationId}::uuid,${expiresAt}::timestamptz,
          ${tx.json({entityId,subjectMode,readOnly:adminEntity})}
        )
        returning id::text,effective_portal_user_id::text,effective_role::text,target_client_key::text,target_agent_person_key::text,
                  return_view,correlation_id::text,started_at,expires_at
      `;
      await audit(tx,ctx,"ADMIN_IMPERSONATION_STARTED",kind,entityId,req,{
        impersonation_session_id:String(inserted[0].id),
        effective_portal_user_id:String(inserted[0].effective_portal_user_id),
        effective_role:String(inserted[0].effective_role),
        target_client_key:inserted[0].target_client_key?String(inserted[0].target_client_key):null,
        target_agent_person_key:inserted[0].target_agent_person_key?String(inserted[0].target_agent_person_key):null,
        correlation_id:String(inserted[0].correlation_id),
        subject_mode:subjectMode,
        read_only:adminEntity
      });
      return inserted[0];
    });
    return{
      impersonationToken:token,
      impersonation:{
        id:String(row.id),
        effectivePortalUserId:String(row.effective_portal_user_id),
        effectiveRole:String(row.effective_role),
        targetClientKey:row.target_client_key?String(row.target_client_key):null,
        targetAgentPersonKey:row.target_agent_person_key?String(row.target_agent_person_key):null,
        returnView:String(row.return_view),
        correlationId:String(row.correlation_id),
        startedAt:new Date(row.started_at).toISOString(),
        expiresAt:new Date(row.expires_at).toISOString(),
        subjectMode,
        readOnly:adminEntity
      },
      targetPath:kind==="AGENT"?"/portal/agent":"/portal/client"
    };
  }

  async function resolve(ctx:AdminCtx,req:Request){
    const imp=await resolveAdminImpersonation(sql,actor(ctx),headerToken(req));
    if(!imp)fail("IMPERSONATION_SESSION_INVALID",401);
    return{
      id:imp.id,
      effectivePortalUserId:imp.effectiveUserId,
      effectiveRole:imp.effectiveRole,
      targetClientKey:imp.targetClientKey,
      targetAgentPersonKey:imp.targetAgentPersonKey,
      returnView:imp.returnView,
      correlationId:imp.correlationId,
      startedAt:imp.startedAt,
      expiresAt:imp.expiresAt,
      subjectMode:imp.subjectMode,
      readOnly:imp.readOnly
    };
  }

  async function end(ctx:AdminCtx,req:Request){
    const imp=await resolveAdminImpersonation(sql,actor(ctx),headerToken(req));
    if(!imp)fail("IMPERSONATION_SESSION_INVALID",401);
    const tabId=String(req.headers.get("x-rona-impersonation-tab")||"").trim();
    if(tabId!==imp.id)fail("IMPERSONATION_TAB_INVALID",409);
    await sql.begin(async(tx:any)=>{
      await tx`
        update portal_private.admin_impersonation_sessions
        set status='ENDED',ended_at=now(),end_reason='ADMIN_RETURN',updated_at=now()
        where id=${imp.id}::uuid and status='ACTIVE' and ended_at is null
      `;
      await audit(tx,ctx,"ADMIN_IMPERSONATION_ENDED","IMPERSONATION",imp.id,req,{
        effective_portal_user_id:imp.effectiveUserId,
        effective_role:imp.effectiveRole,
        target_client_key:imp.targetClientKey,
        target_agent_person_key:imp.targetAgentPersonKey,
        correlation_id:imp.correlationId
      });
    });
    return{returnView:imp.returnView,ended:true};
  }

  async function companyPreview(db:any,clientId:string){
    const rows=await db`
      select id::text entity_key,client_id entity_id,legal_name display_name,updated_at,lifecycle_state::text,authority_state::text
      from portal_private.clients
      where client_id=${clientId}
      limit 1
    `;
    if(rows.length!==1)fail("COMPANY_NOT_FOUND",404);
    const entity=rows[0];
    if(String(entity.lifecycle_state)!=="ACTIVE")fail("COMPANY_NOT_ACTIVE",409);
    const activeDeals=await db`
      select deal_id,business_status
      from portal_private.deals
      where client_key=${entity.entity_key}::uuid
        and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      order by deal_id
    `;
    if(activeDeals.length)fail("ACTIVE_DEALS_DECISION_REQUIRED",409);
    const pendingApps=await db`
      select application_id,status::text
      from portal_private.client_applications
      where client_key=${entity.entity_key}::uuid
        and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and status in (
          'DRAFT'::portal_private.application_status_enum,
          'SUBMITTED'::portal_private.application_status_enum,
          'UNDER_REVIEW'::portal_private.application_status_enum,
          'ACCEPTED_AWAITING_DEAL_REGISTRATION'::portal_private.application_status_enum
        )
      order by application_id
    `;
    if(pendingApps.length)fail("NONTERMINAL_APPLICATIONS_DECISION_REQUIRED",409);
    const counts=(await db`
      select
        (select count(*) from portal_private.client_user_bindings b where b.client_key=${entity.entity_key}::uuid and b.status='ACTIVE'::portal_private.binding_status_enum and b.revoked_at is null)::int client_bindings,
        (select count(*) from portal_private.client_user_pending_company_bindings b where b.client_key=${entity.entity_key}::uuid and b.status in ('PENDING'::portal_private.binding_status_enum,'ACTIVE'::portal_private.binding_status_enum) and b.revoked_at is null)::int pending_bindings,
        (select count(*) from portal_private.client_user_deal_grants g where g.client_key=${entity.entity_key}::uuid and g.status='ACTIVE'::portal_private.binding_status_enum and g.revoked_at is null)::int deal_grants,
        (select count(*) from portal_private.agent_client_assignments a where a.client_key=${entity.entity_key}::uuid and a.status='ACTIVE'::portal_private.binding_status_enum and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum)::int agent_assignments,
        (select count(*) from portal_private.deals d where d.client_key=${entity.entity_key}::uuid)::int historical_deals,
        (select count(*) from portal_private.documents d where d.client_key=${entity.entity_key}::uuid)::int historical_documents,
        (select count(*) from portal_private.payment_allocations p where p.client_key=${entity.entity_key}::uuid)::int historical_payment_allocations,
        (select count(*) from portal_private.rail_documents r where r.client_key=${entity.entity_key}::uuid)::int historical_rail_documents
    `)[0];
    return{
      entityType:"COMPANY",
      entityKey:String(entity.entity_key),
      entityPublicId:String(entity.entity_id),
      displayName:String(entity.display_name),
      entityUpdatedAt:new Date(entity.updated_at).toISOString(),
      entityLifecycle:String(entity.lifecycle_state),
      entityAuthority:String(entity.authority_state),
      blockers:{activeDeals:0,nonterminalApplications:0},
      impact:{
        clientBindings:Number(counts.client_bindings||0),
        pendingBindings:Number(counts.pending_bindings||0),
        dealGrants:Number(counts.deal_grants||0),
        agentAssignments:Number(counts.agent_assignments||0)
      },
      archive:{
        deals:Number(counts.historical_deals||0),
        documents:Number(counts.historical_documents||0),
        paymentAllocations:Number(counts.historical_payment_allocations||0),
        railDocuments:Number(counts.historical_rail_documents||0)
      }
    };
  }

  async function agentPreview(db:any,agentPersonId:string){
    const rows=await db`
      select id::text entity_key,agent_person_id entity_id,coalesce(display_alias,full_name,agent_person_id) display_name,
             updated_at,lifecycle_state::text,authority_state::text
      from portal_private.agent_persons
      where agent_person_id=${agentPersonId}
      limit 1
    `;
    if(rows.length!==1)fail("AGENT_NOT_FOUND",404);
    const entity=rows[0];
    if(String(entity.lifecycle_state)!=="ACTIVE")fail("AGENT_NOT_ACTIVE",409);
    const counts=(await db`
      select
        (select count(*) from portal_private.agent_user_bindings b where b.agent_person_key=${entity.entity_key}::uuid and b.status='ACTIVE'::portal_private.binding_status_enum and b.revoked_at is null)::int agent_bindings,
        (select count(*) from portal_private.agent_client_assignments a where a.agent_person_key=${entity.entity_key}::uuid and a.status='ACTIVE'::portal_private.binding_status_enum and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum)::int company_assignments,
        (select count(*) from portal_private.agent_deal_terms t join portal_private.agent_client_assignments a on a.id=t.assignment_id where a.agent_person_key=${entity.entity_key}::uuid and t.status='ACTIVE'::portal_private.binding_status_enum and t.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum)::int active_deal_terms,
        (select count(*) from portal_private.agent_deal_terms t join portal_private.agent_client_assignments a on a.id=t.assignment_id where a.agent_person_key=${entity.entity_key}::uuid)::int historical_deal_terms
    `)[0];
    return{
      entityType:"AGENT",
      entityKey:String(entity.entity_key),
      entityPublicId:String(entity.entity_id),
      displayName:String(entity.display_name),
      entityUpdatedAt:new Date(entity.updated_at).toISOString(),
      entityLifecycle:String(entity.lifecycle_state),
      entityAuthority:String(entity.authority_state),
      blockers:{},
      impact:{
        agentBindings:Number(counts.agent_bindings||0),
        companyAssignments:Number(counts.company_assignments||0),
        activeDealTerms:Number(counts.active_deal_terms||0)
      },
      archive:{dealTerms:Number(counts.historical_deal_terms||0)}
    };
  }

  async function computePreview(db:any,kind:string,entityId:string){
    return kind==="COMPANY"?companyPreview(db,entityId):kind==="AGENT"?agentPreview(db,entityId):fail("INVALID_ENTITY_KIND",400);
  }

  async function preview(ctx:AdminCtx,req:Request,kind:string,entityId:string){
    const p=await computePreview(sql,kind,entityId);
    const impactHash=await hashJson(p);
    const nonce=opaqueToken(),nonceHash=await sha256Hex(nonce);
    const expiresAt=new Date(Date.now()+RETIREMENT_TTL_MS).toISOString();
    const rows=await sql`
      insert into portal_private.admin_entity_retirement_operations(
        entity_type,entity_key,entity_public_id,
        actor_admin_portal_user_id,actor_admin_auth_user_id,actor_admin_session_id,
        status,nonce_hash,impact_hash,preview,expires_at
      ) values(
        ${kind},${p.entityKey}::uuid,${p.entityPublicId},
        ${ctx.user}::uuid,${ctx.auth}::uuid,${ctx.sid}::uuid,
        'PREFLIGHT',${nonceHash},${impactHash},${sql.json(p)},${expiresAt}::timestamptz
      )
      returning id::text,status,expires_at
    `;
    await sql.begin(async(tx:any)=>audit(tx,ctx,"ADMIN_ENTITY_RETIREMENT_PREFLIGHT",kind,p.entityPublicId,req,{
      operation_id:String(rows[0].id),impact_hash:impactHash,impact:p.impact,archive:p.archive
    }));
    return{operationId:String(rows[0].id),confirmationNonce:nonce,impactHash,expiresAt:new Date(rows[0].expires_at).toISOString(),preview:p};
  }

  async function retirePortalUsers(tx:any,ctx:AdminCtx,userIds:string[],reason:string,operationId:string){
    for(const userId of [...new Set(userIds.filter((x)=>UUID_RE.test(x)))]){
      const clientScope=await tx`
        select 1 from portal_private.client_user_bindings b
        join portal_private.clients cl on cl.id=b.client_key
        where b.user_id=${userId}::uuid
          and b.status='ACTIVE'::portal_private.binding_status_enum
          and b.revoked_at is null
          and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          and cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        limit 1
      `;
      if(!clientScope.length){
        await tx`
          update portal_private.portal_user_roles
          set status='REVOKED'::portal_private.binding_status_enum,
              revoked_at=coalesce(revoked_at,now()),
              revoked_by=coalesce(revoked_by,${ctx.user}::uuid),
              reason=${reason},
              updated_at=now()
          where user_id=${userId}::uuid
            and role='CLIENT'::portal_private.portal_role_enum
            and status='ACTIVE'::portal_private.binding_status_enum
            and revoked_at is null
        `;
      }
      const agentScope=await tx`
        select 1 from portal_private.agent_user_bindings b
        join portal_private.agent_persons ap on ap.id=b.agent_person_key
        where b.user_id=${userId}::uuid
          and b.status='ACTIVE'::portal_private.binding_status_enum
          and b.revoked_at is null
          and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          and ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        limit 1
      `;
      if(!agentScope.length){
        await tx`
          update portal_private.portal_user_roles
          set status='REVOKED'::portal_private.binding_status_enum,
              revoked_at=coalesce(revoked_at,now()),
              revoked_by=coalesce(revoked_by,${ctx.user}::uuid),
              reason=${reason},
              updated_at=now()
          where user_id=${userId}::uuid
            and role='AGENT'::portal_private.portal_role_enum
            and status='ACTIVE'::portal_private.binding_status_enum
            and revoked_at is null
        `;
      }
      const stillActive=await tx`
        select 1
        from portal_private.portal_user_roles
        where user_id=${userId}::uuid
          and status='ACTIVE'::portal_private.binding_status_enum
          and revoked_at is null
        limit 1
      `;
      if(stillActive.length)continue;
      const u=(await tx`
        select id::text,auth_user_id::text
        from portal_private.portal_users
        where id=${userId}::uuid
        for update
      `)[0];
      if(!u)continue;
      await tx`
        update portal_private.portal_users
        set status='REVOKED'::portal_private.portal_user_status_enum,
            lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum,
            revoked_at=coalesce(revoked_at,now()),
            suspended_at=coalesce(suspended_at,now()),
            updated_at=now()
        where id=${userId}::uuid
      `;
      await tx`
        update portal_private.portal_sessions_control
        set status='REVOKED'::portal_private.binding_status_enum,
            revoked_at=coalesce(revoked_at,now()),
            revoked_by=coalesce(revoked_by,${ctx.user}::uuid),
            reason=${reason},
            updated_at=now()
        where user_id=${userId}::uuid
          and status<>'REVOKED'::portal_private.binding_status_enum
      `;
      await tx`
        insert into portal_private.portal_sessions_control(user_id,session_subject,status,revoked_at,revoked_by,reason)
        select ${userId}::uuid,s.id::text,'REVOKED'::portal_private.binding_status_enum,now(),${ctx.user}::uuid,${reason}
        from auth.sessions s
        join portal_private.portal_users pu on pu.auth_user_id=s.user_id
        where pu.id=${userId}::uuid
        on conflict(session_subject) do update
          set status='REVOKED'::portal_private.binding_status_enum,
              revoked_at=coalesce(portal_private.portal_sessions_control.revoked_at,excluded.revoked_at),
              revoked_by=coalesce(portal_private.portal_sessions_control.revoked_by,excluded.revoked_by),
              reason=excluded.reason,
              updated_at=now()
      `;
      if(u.auth_user_id){
        await tx`
          insert into portal_private.admin_auth_cleanup_outbox(operation_id,portal_user_id,auth_user_id)
          values(${operationId}::uuid,${userId}::uuid,${u.auth_user_id}::uuid)
          on conflict(operation_id,auth_user_id) do nothing
        `;
      }
    }
  }

  async function retireCompany(tx:any,ctx:AdminCtx,p:any,operationId:string){
    const clientKey=String(p.entityKey),reason="Admin Portal: company retired";
    const affected=(await tx`
      select distinct user_id::text
      from portal_private.client_user_bindings
      where client_key=${clientKey}::uuid
      union
      select distinct user_id::text
      from portal_private.client_user_pending_company_bindings
      where client_key=${clientKey}::uuid
    `).map((r:any)=>String(r.user_id));
    const assignmentIds=(await tx`select id::text from portal_private.agent_client_assignments where client_key=${clientKey}::uuid`).map((r:any)=>String(r.id));
    if(assignmentIds.length){
      await tx`
        update portal_private.agent_deal_terms
        set status='REVOKED'::portal_private.binding_status_enum,
            valid_to=coalesce(valid_to,now()),
            lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum,
            updated_at=now()
        where assignment_id=any(${assignmentIds}::uuid[])
          and status<>'REVOKED'::portal_private.binding_status_enum
      `;
    }
    await tx`
      update portal_private.agent_client_assignments
      set status='REVOKED'::portal_private.binding_status_enum,
          valid_to=coalesce(valid_to,now()),
          lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum,
          updated_at=now()
      where client_key=${clientKey}::uuid
        and status<>'REVOKED'::portal_private.binding_status_enum
    `;
    await tx`
      update portal_private.client_user_deal_grants
      set status='REVOKED'::portal_private.binding_status_enum,
          valid_to=coalesce(valid_to,now()),
          revoked_at=coalesce(revoked_at,now()),
          revoked_by=coalesce(revoked_by,${ctx.user}::uuid),
          reason=${reason},
          lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum,
          updated_at=now()
      where client_key=${clientKey}::uuid
        and status<>'REVOKED'::portal_private.binding_status_enum
    `;
    await tx`
      update portal_private.client_user_bindings
      set status='REVOKED'::portal_private.binding_status_enum,
          valid_to=coalesce(valid_to,now()),
          revoked_at=coalesce(revoked_at,now()),
          revoked_by=coalesce(revoked_by,${ctx.user}::uuid),
          reason=${reason},
          lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum,
          updated_at=now()
      where client_key=${clientKey}::uuid
        and status<>'REVOKED'::portal_private.binding_status_enum
    `;
    await tx`
      update portal_private.client_user_pending_company_bindings
      set status='REVOKED'::portal_private.binding_status_enum,
          revoked_at=coalesce(revoked_at,now()),
          revoked_by=coalesce(revoked_by,${ctx.user}::uuid),
          reason=${reason},
          lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum,
          updated_at=now()
      where client_key=${clientKey}::uuid
        and status<>'REVOKED'::portal_private.binding_status_enum
    `;
    await tx`
      update portal_private.clients
      set lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum,
          updated_at=now()
      where id=${clientKey}::uuid
    `;
    await retirePortalUsers(tx,ctx,affected,reason,operationId);
  }

  async function retireAgent(tx:any,ctx:AdminCtx,p:any,operationId:string){
    const personKey=String(p.entityKey),reason="Admin Portal: agent retired";
    const affected=(await tx`
      select distinct user_id::text
      from portal_private.agent_user_bindings
      where agent_person_key=${personKey}::uuid
    `).map((r:any)=>String(r.user_id));
    const assignmentIds=(await tx`select id::text from portal_private.agent_client_assignments where agent_person_key=${personKey}::uuid`).map((r:any)=>String(r.id));
    if(assignmentIds.length){
      await tx`
        update portal_private.agent_deal_terms
        set status='REVOKED'::portal_private.binding_status_enum,
            valid_to=coalesce(valid_to,now()),
            lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum,
            updated_at=now()
        where assignment_id=any(${assignmentIds}::uuid[])
          and status<>'REVOKED'::portal_private.binding_status_enum
      `;
    }
    await tx`
      update portal_private.agent_client_assignments
      set status='REVOKED'::portal_private.binding_status_enum,
          valid_to=coalesce(valid_to,now()),
          lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum,
          updated_at=now()
      where agent_person_key=${personKey}::uuid
        and status<>'REVOKED'::portal_private.binding_status_enum
    `;
    await tx`
      update portal_private.agent_user_bindings
      set status='REVOKED'::portal_private.binding_status_enum,
          valid_to=coalesce(valid_to,now()),
          revoked_at=coalesce(revoked_at,now()),
          revoked_by=coalesce(revoked_by,${ctx.user}::uuid),
          reason=${reason},
          lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum,
          updated_at=now()
      where agent_person_key=${personKey}::uuid
        and status<>'REVOKED'::portal_private.binding_status_enum
    `;
    await tx`
      update portal_private.agent_user_relation_control
      set relation_status='REVOKED',
          authority_state='SUPERSEDED'::portal_private.authority_state_enum,
          lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum,
          updated_at=now()
      where agent_person_key=${personKey}::uuid
        and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    `;
    await tx`
      update portal_private.agent_persons
      set lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum,
          updated_at=now()
      where id=${personKey}::uuid
    `;
    await retirePortalUsers(tx,ctx,affected,reason,operationId);
  }

  async function cleanupAuth(operationId:string){
    const rows=await sql`
      select o.id::text,u.id::text portal_user_id,o.auth_user_id::text
      from portal_private.admin_auth_cleanup_outbox o
      join portal_private.portal_users u on u.id=o.portal_user_id
      where o.operation_id=${operationId}::uuid
        and o.status in ('PENDING','FAILED_RETRYABLE')
      order by o.created_at
    `;
    let failed=false;
    for(const row of rows){
      const outboxId=String(row.id),userId=String(row.portal_user_id),authUserId=String(row.auth_user_id);
      const gate=await sql`
        select
          u.status::text user_status,
          u.lifecycle_state::text lifecycle_state,
          u.auth_user_id::text current_auth_user_id,
          exists(select 1 from portal_private.portal_user_roles r where r.user_id=u.id and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null) active_role,
          exists(select 1 from portal_private.client_user_bindings b where b.user_id=u.id and b.status='ACTIVE'::portal_private.binding_status_enum and b.revoked_at is null) active_client,
          exists(select 1 from portal_private.agent_user_bindings b where b.user_id=u.id and b.status='ACTIVE'::portal_private.binding_status_enum and b.revoked_at is null) active_agent
        from portal_private.portal_users u where u.id=${userId}::uuid
      `;
      const g=gate[0];
      if(!g||g.active_role||g.active_client||g.active_agent||String(g.lifecycle_state)!=="ARCHIVED"){
        await sql`update portal_private.admin_auth_cleanup_outbox set status='FAILED_RETRYABLE',attempts=attempts+1,last_error='AUTH_CLEANUP_GATE_DENIED',updated_at=now() where id=${outboxId}::uuid`;
        failed=true;continue;
      }
      if(!g.current_auth_user_id){
        await sql`update portal_private.admin_auth_cleanup_outbox set status='COMPLETED',attempts=attempts+1,last_error=null,completed_at=now(),updated_at=now() where id=${outboxId}::uuid`;
        continue;
      }
      if(String(g.current_auth_user_id)!==authUserId){
        await sql`update portal_private.admin_auth_cleanup_outbox set status='FAILED_RETRYABLE',attempts=attempts+1,last_error='AUTH_ID_CHANGED',updated_at=now() where id=${outboxId}::uuid`;
        failed=true;continue;
      }
      await sql`update portal_private.portal_users set auth_user_id=null,updated_at=now() where id=${userId}::uuid`;
      const{error}=await service.auth.admin.deleteUser(authUserId);
      if(error){
        await sql.begin(async(tx:any)=>{
          await tx`update portal_private.portal_users set auth_user_id=${authUserId}::uuid,updated_at=now() where id=${userId}::uuid and auth_user_id is null`;
          await tx`update portal_private.admin_auth_cleanup_outbox set status='FAILED_RETRYABLE',attempts=attempts+1,last_error=${String(error.message||"AUTH_USER_DELETE_FAILED").slice(0,1000)},updated_at=now() where id=${outboxId}::uuid`;
        });
        failed=true;continue;
      }
      await sql.begin(async(tx:any)=>{
        await tx`update portal_private.portal_users set login_name=null,status='ARCHIVED'::portal_private.portal_user_status_enum,lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum,updated_at=now() where id=${userId}::uuid`;
        await tx`update portal_private.admin_auth_cleanup_outbox set status='COMPLETED',attempts=attempts+1,last_error=null,completed_at=now(),updated_at=now() where id=${outboxId}::uuid`;
      });
    }
    return!failed;
  }

  async function verifyPostcondition(kind:string,p:any){
    if(kind==="COMPANY"){
      const rows=await sql`
        select
          (select lifecycle_state::text from portal_private.clients where id=${p.entityKey}::uuid) master_state,
          exists(select 1 from portal_private.client_user_bindings b where b.client_key=${p.entityKey}::uuid and b.status='ACTIVE'::portal_private.binding_status_enum and b.revoked_at is null) active_binding,
          exists(select 1 from portal_private.client_user_pending_company_bindings b where b.client_key=${p.entityKey}::uuid and b.status in ('PENDING'::portal_private.binding_status_enum,'ACTIVE'::portal_private.binding_status_enum) and b.revoked_at is null) pending_binding,
          exists(select 1 from portal_private.client_user_deal_grants g where g.client_key=${p.entityKey}::uuid and g.status='ACTIVE'::portal_private.binding_status_enum and g.revoked_at is null) active_grant,
          exists(select 1 from portal_private.agent_client_assignments a where a.client_key=${p.entityKey}::uuid and a.status='ACTIVE'::portal_private.binding_status_enum and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum) active_assignment
      `;
      const r=rows[0];
      return r&&String(r.master_state)==="ARCHIVED"&&!r.active_binding&&!r.pending_binding&&!r.active_grant&&!r.active_assignment;
    }
    const rows=await sql`
      select
        (select lifecycle_state::text from portal_private.agent_persons where id=${p.entityKey}::uuid) master_state,
        exists(select 1 from portal_private.agent_user_bindings b where b.agent_person_key=${p.entityKey}::uuid and b.status='ACTIVE'::portal_private.binding_status_enum and b.revoked_at is null) active_binding,
        exists(select 1 from portal_private.agent_client_assignments a where a.agent_person_key=${p.entityKey}::uuid and a.status='ACTIVE'::portal_private.binding_status_enum and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum) active_assignment,
        exists(select 1 from portal_private.agent_deal_terms t join portal_private.agent_client_assignments a on a.id=t.assignment_id where a.agent_person_key=${p.entityKey}::uuid and t.status='ACTIVE'::portal_private.binding_status_enum and t.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum) active_term
    `;
    const r=rows[0];
    return r&&String(r.master_state)==="ARCHIVED"&&!r.active_binding&&!r.active_assignment&&!r.active_term;
  }

  async function execute(ctx:AdminCtx,req:Request,kind:string,entityId:string){
    const body=await jsonBody(req);
    const operationId=text(body.operationId,"OPERATION_ID",80),nonce=text(body.confirmationNonce,"CONFIRMATION_NONCE",180);
    if(!UUID_RE.test(operationId))fail("INVALID_OPERATION_ID",400);
    const nonceHash=await sha256Hex(nonce);
    const opRows=await sql`
      select id::text,entity_type,entity_key::text,entity_public_id,status,nonce_hash,impact_hash,preview,expires_at
      from portal_private.admin_entity_retirement_operations
      where id=${operationId}::uuid
        and actor_admin_portal_user_id=${ctx.user}::uuid
        and actor_admin_auth_user_id=${ctx.auth}::uuid
        and actor_admin_session_id=${ctx.sid}::uuid
      limit 1
    `;
    if(opRows.length!==1)fail("RETIREMENT_OPERATION_NOT_FOUND",404);
    const initial=opRows[0];
    if(String(initial.entity_type)!==kind||String(initial.entity_public_id)!==entityId)fail("RETIREMENT_OPERATION_SCOPE_MISMATCH",409);
    if(String(initial.nonce_hash)!==nonceHash)fail("RETIREMENT_CONFIRMATION_INVALID",409);

    if(String(initial.status)==="FAILED_RETRYABLE"){
      const cleaned=await cleanupAuth(operationId);
      if(!cleaned)fail("AUTH_CLEANUP_RETRY_REQUIRED",502);
      const ok=await verifyPostcondition(kind,initial.preview);
      if(!ok)fail("RETIREMENT_POSTCONDITION_FAILED",500);
      await sql`update portal_private.admin_entity_retirement_operations set status='COMPLETED',error_code=null,completed_at=now(),updated_at=now() where id=${operationId}::uuid`;
      return{operationId,status:"COMPLETED",retired:true,authCleanup:"COMPLETED"};
    }

    if(String(initial.status)!=="PREFLIGHT")fail("RETIREMENT_OPERATION_NOT_EXECUTABLE",409);
    if(new Date(initial.expires_at).getTime()<=Date.now())fail("RETIREMENT_CONFIRMATION_EXPIRED",409);

    let committedPreview:any=null;
    await sql.begin(async(tx:any)=>{
      const locked=await tx`
        select id::text,entity_type,entity_key::text,entity_public_id,status,nonce_hash,impact_hash,preview,expires_at
        from portal_private.admin_entity_retirement_operations
        where id=${operationId}::uuid
          and actor_admin_portal_user_id=${ctx.user}::uuid
          and actor_admin_auth_user_id=${ctx.auth}::uuid
          and actor_admin_session_id=${ctx.sid}::uuid
        for update
      `;
      if(locked.length!==1)fail("RETIREMENT_OPERATION_NOT_FOUND",404);
      const op=locked[0];
      if(String(op.status)!=="PREFLIGHT")fail("RETIREMENT_OPERATION_NOT_EXECUTABLE",409);
      if(String(op.nonce_hash)!==nonceHash)fail("RETIREMENT_CONFIRMATION_INVALID",409);
      if(new Date(op.expires_at).getTime()<=Date.now())fail("RETIREMENT_CONFIRMATION_EXPIRED",409);
      if(kind==="COMPANY"){
        const x=await tx`select id from portal_private.clients where id=${op.entity_key}::uuid for update`;
        if(x.length!==1)fail("COMPANY_NOT_FOUND",404);
      }else{
        const x=await tx`select id from portal_private.agent_persons where id=${op.entity_key}::uuid for update`;
        if(x.length!==1)fail("AGENT_NOT_FOUND",404);
      }
      const current=await computePreview(tx,kind,entityId);
      const currentHash=await hashJson(current);
      if(currentHash!==String(op.impact_hash))fail("RETIREMENT_PREFLIGHT_STALE",409);
      await tx`update portal_private.admin_entity_retirement_operations set status='RETIRING',updated_at=now() where id=${operationId}::uuid`;
      if(kind==="COMPANY")await retireCompany(tx,ctx,current,operationId);
      else await retireAgent(tx,ctx,current,operationId);
      const outbox=(await tx`select count(*)::int n from portal_private.admin_auth_cleanup_outbox where operation_id=${operationId}::uuid and status<>'COMPLETED'`)[0];
      await tx`
        update portal_private.admin_entity_retirement_operations
        set status=${Number(outbox?.n||0)>0?"AUTH_CLEANUP_PENDING":"VERIFYING"},updated_at=now()
        where id=${operationId}::uuid
      `;
      await audit(tx,ctx,kind==="COMPANY"?"COMPANY_RETIRED_FROM_ACTIVE_CONTOUR":"AGENT_RETIRED_FROM_ACTIVE_CONTOUR",kind,entityId,req,{
        operation_id:operationId,
        impact_hash:currentHash,
        impact:current.impact,
        archive_preserved:current.archive
      });
      committedPreview=current;
    });

    const cleaned=await cleanupAuth(operationId);
    if(!cleaned){
      await sql`update portal_private.admin_entity_retirement_operations set status='FAILED_RETRYABLE',error_code='AUTH_CLEANUP_RETRY_REQUIRED',updated_at=now() where id=${operationId}::uuid`;
      fail("AUTH_CLEANUP_RETRY_REQUIRED",502);
    }
    await sql`update portal_private.admin_entity_retirement_operations set status='VERIFYING',error_code=null,updated_at=now() where id=${operationId}::uuid`;
    const ok=await verifyPostcondition(kind,committedPreview);
    if(!ok){
      await sql`update portal_private.admin_entity_retirement_operations set status='FAILED_RETRYABLE',error_code='RETIREMENT_POSTCONDITION_FAILED',updated_at=now() where id=${operationId}::uuid`;
      fail("RETIREMENT_POSTCONDITION_FAILED",500);
    }
    await sql`update portal_private.admin_entity_retirement_operations set status='COMPLETED',completed_at=now(),updated_at=now() where id=${operationId}::uuid`;
    return{operationId,status:"COMPLETED",retired:true,authCleanup:"COMPLETED"};
  }

  return{targets,start,resolve,end,preview,execute};
}
