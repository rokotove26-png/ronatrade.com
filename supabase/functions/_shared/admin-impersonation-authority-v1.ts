export type AdminActor = {
  authUserId: string;
  portalUserId: string;
  sessionId: string;
  displayName?: string;
  roles: string[];
};

export type AdminImpersonation = {
  id: string;
  effectiveUserId: string;
  effectiveRole: "CLIENT" | "AGENT";
  targetClientKey: string | null;
  targetAgentPersonKey: string | null;
  returnView: "companies" | "agents";
  correlationId: string;
  startedAt: string;
  expiresAt: string;
};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function sha256Hex(value:string){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map((x)=>x.toString(16).padStart(2,"0")).join("");
}

export async function resolveAdminImpersonation(
  db:any,
  actor:AdminActor,
  opaqueToken:string|null|undefined
):Promise<AdminImpersonation|null>{
  const token=String(opaqueToken||"").trim();
  if(!token)return null;
  if(!actor.roles.includes("ADMIN"))return null;
  if(!UUID_RE.test(actor.authUserId)||!UUID_RE.test(actor.portalUserId)||!UUID_RE.test(actor.sessionId))return null;
  const tokenHash=await sha256Hex(token);
  const rows=await db`
    select
      ais.id,
      ais.effective_portal_user_id,
      ais.effective_role::text,
      ais.target_client_key,
      ais.target_agent_person_key,
      ais.return_view,
      ais.correlation_id,
      ais.started_at,
      ais.expires_at
    from portal_private.admin_impersonation_sessions ais
    join portal_private.portal_users effective on effective.id=ais.effective_portal_user_id
    join portal_private.portal_user_roles er
      on er.user_id=effective.id
     and er.role=ais.effective_role
     and er.status='ACTIVE'::portal_private.binding_status_enum
     and er.revoked_at is null
    where ais.token_hash=${tokenHash}
      and ais.actor_admin_portal_user_id=${actor.portalUserId}::uuid
      and ais.actor_admin_auth_user_id=${actor.authUserId}::uuid
      and ais.actor_admin_session_id=${actor.sessionId}::uuid
      and ais.status='ACTIVE'
      and ais.ended_at is null
      and ais.expires_at>now()
      and effective.status='ACTIVE'::portal_private.portal_user_status_enum
      and effective.authority_state='CONFIRMED'::portal_private.authority_state_enum
      and effective.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and (
        (
          ais.effective_role='CLIENT'::portal_private.portal_role_enum
          and exists(
            select 1
            from portal_private.clients cl
            join portal_private.client_user_bindings b
              on b.client_key=cl.id
             and b.user_id=effective.id
            where cl.id=ais.target_client_key
              and cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
              and cl.authority_state in (
                'CONFIRMED'::portal_private.authority_state_enum,
                'VERIFIED'::portal_private.authority_state_enum
              )
              and b.status='ACTIVE'::portal_private.binding_status_enum
              and b.revoked_at is null
              and b.valid_from<=now()
              and (b.valid_to is null or b.valid_to>now())
              and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          )
        )
        or
        (
          ais.effective_role='AGENT'::portal_private.portal_role_enum
          and exists(
            select 1
            from portal_private.agent_persons ap
            join portal_private.agent_user_bindings b
              on b.agent_person_key=ap.id
             and b.user_id=effective.id
            where ap.id=ais.target_agent_person_key
              and ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
              and ap.authority_state not in (
                'REJECTED'::portal_private.authority_state_enum,
                'SUPERSEDED'::portal_private.authority_state_enum
              )
              and b.status='ACTIVE'::portal_private.binding_status_enum
              and b.revoked_at is null
              and b.valid_from<=now()
              and (b.valid_to is null or b.valid_to>now())
              and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
              and (
                select count(distinct b2.agent_person_key)
                from portal_private.agent_user_bindings b2
                where b2.user_id=effective.id
                  and b2.status='ACTIVE'::portal_private.binding_status_enum
                  and b2.revoked_at is null
                  and b2.valid_from<=now()
                  and (b2.valid_to is null or b2.valid_to>now())
                  and b2.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
              )=1
          )
        )
      )
    limit 1
  `;
  if(rows.length!==1)return null;
  const row=rows[0];
  return{
    id:String(row.id),
    effectiveUserId:String(row.effective_portal_user_id),
    effectiveRole:String(row.effective_role)==="AGENT"?"AGENT":"CLIENT",
    targetClientKey:row.target_client_key?String(row.target_client_key):null,
    targetAgentPersonKey:row.target_agent_person_key?String(row.target_agent_person_key):null,
    returnView:String(row.return_view)==="agents"?"agents":"companies",
    correlationId:String(row.correlation_id),
    startedAt:new Date(row.started_at).toISOString(),
    expiresAt:new Date(row.expires_at).toISOString()
  };
}

export function impersonationMetadata(actor:AdminActor,impersonation:AdminImpersonation){
  return{
    actor_admin_portal_user_id:actor.portalUserId,
    actor_admin_auth_user_id:actor.authUserId,
    actor_admin_session_id:actor.sessionId,
    effective_portal_user_id:impersonation.effectiveUserId,
    effective_role:impersonation.effectiveRole,
    impersonation_session_id:impersonation.id,
    target_client_key:impersonation.targetClientKey,
    target_agent_person_key:impersonation.targetAgentPersonKey,
    impersonation_correlation_id:impersonation.correlationId
  };
}

export function clientBoundKey(impersonation:AdminImpersonation|null|undefined){
  return impersonation?.effectiveRole==="CLIENT"?impersonation.targetClientKey:null;
}

export function agentBoundPersonKey(impersonation:AdminImpersonation|null|undefined){
  return impersonation?.effectiveRole==="AGENT"?impersonation.targetAgentPersonKey:null;
}

export async function recordImpersonationEvent(
  db:any,
  actor:AdminActor,
  impersonation:AdminImpersonation|null|undefined,
  req:Request,
  route:string,
  action:string,
  result:string,
  metadata:Record<string,unknown>={}
){
  if(!impersonation)return null;
  const requestHeader=req.headers.get("x-request-id");
  const requestId=requestHeader&&UUID_RE.test(requestHeader)?requestHeader:crypto.randomUUID();
  const correlationHeader=req.headers.get("x-correlation-id");
  const correlationId=correlationHeader&&UUID_RE.test(correlationHeader)?correlationHeader:impersonation.correlationId;
  await db`
    insert into portal_private.admin_impersonation_events(
      impersonation_session_id,
      actor_admin_portal_user_id,
      actor_admin_auth_user_id,
      actor_admin_session_id,
      effective_portal_user_id,
      effective_role,
      target_client_key,
      target_agent_person_key,
      request_id,
      correlation_id,
      method,
      route,
      action,
      result,
      metadata
    ) values(
      ${impersonation.id}::uuid,
      ${actor.portalUserId}::uuid,
      ${actor.authUserId}::uuid,
      ${actor.sessionId}::uuid,
      ${impersonation.effectiveUserId}::uuid,
      ${impersonation.effectiveRole}::portal_private.portal_role_enum,
      ${impersonation.targetClientKey}::uuid,
      ${impersonation.targetAgentPersonKey}::uuid,
      ${requestId}::uuid,
      ${correlationId}::uuid,
      ${req.method},
      ${route},
      ${action},
      ${result},
      ${db.json(metadata)}
    )
  `;
  return{requestId,correlationId};
}
