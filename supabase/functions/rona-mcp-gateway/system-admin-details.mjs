const READ_HINTS = {readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
export const SYSTEM_ADMIN_DETAIL_TOOLS = [
  ['object_detail','object_id','Read a SYSTEM_ADMIN open_delta object and its role-visible canonical records. Missing source fields remain null.'],
  ['pr_detail','object_id','Read an open_delta PR checkpoint and live public GitHub PR metadata and acceptance text. Does not approve or merge.'],
  ['review_detail','object_id','Read PRIVATE_RLS canonical handoff and live catalog security metadata for the four specified tables. Does not complete the review.']
].map(([name,key,description])=>({name,description,inputSchema:{type:'object',properties:{[key]:{type:'string',minLength:1,maxLength:160}},required:[key],additionalProperties:false},annotations:READ_HINTS,securitySchemes:[{type:'oauth2',scopes:['mcp:read']}]}));
const TABLES=['admin_impersonation_sessions','admin_impersonation_events','admin_entity_retirement_operations','admin_auth_cleanup_outbox'];
export function createSystemAdminDetails({sql,isAdmin,scopeHas,requestIds,rateAllowed,recordMcpEvent,rpcToolResponse,fetchImpl=fetch}) {
  async function loadObject(ctx,id) {
    const rows=await sql`select state_version,open_delta,pending_actions,canonical_sources,metadata,updated_at from portal_private.ai_role_state_checkpoints_v2 where functional_role=${ctx.role}::portal_private.ai_business_role_enum limit 1`;
    const cp=rows[0];
    const delta=cp?.open_delta?.find(d=>d.scope===id);
    if(!delta) return null;
    const records=await sql`select record_id,record_type,functional_role::text as from_role,target_role::text,target_type,target_id,status,payload,source_refs,evidence_refs,created_at from portal_private.ai_coordination_records r where qa_only=false and (functional_role=${ctx.role}::portal_private.ai_business_role_enum or target_role=${ctx.role}::portal_private.ai_business_role_enum) and not exists(select 1 from portal_private.ai_coordination_records n where n.supersedes_id=r.record_id and n.qa_only=false) and (target_id=${id} or payload->>'entity_id'=${id} or position(${id} in coalesce(payload->>'subject',''))>0 or position(${id} in coalesce(payload->>'requested_check',''))>0) order by created_at desc limit 20`;
    const explicit=records.filter(r=>r.target_id===id || r.payload?.entity_id===id);
    const pick=k=>delta[k]??explicit.find(r=>r.payload?.[k]!=null)?.payload[k]??null;
    const data={object_id:id,type:/^PR[1-9][0-9]*$/.test(id)?'PR':id==='PRIVATE_RLS'?'REVIEW':'STATE_OBJECT',status:delta.status,owner:pick('owner'),gate:pick('gate'),dependency:pick('dependency'),required_action:pick('required_action'),hold_reason:pick('hold_reason'),completion_criteria:pick('completion_criteria'),managing_role:ctx.role,checkpoint:{state_version:cp.state_version,updated_at:cp.updated_at,delta},pending_actions:cp.pending_actions?.filter(a=>a.action===id||a.action===id+'_REVIEW')??[],canonical_sources:cp.canonical_sources??[],coordination_records:records,source_refs:[`portal_private.ai_role_state_checkpoints_v2:${ctx.role}:${cp.state_version}`,...records.map(r=>`COORDINATION:${r.record_id}`)]};
    data.missing_source_fields=['owner','gate','dependency','required_action','hold_reason','completion_criteria'].filter(k=>data[k]===null);
    data.detail_completeness=data.missing_source_fields.length?'PARTIAL_SOURCE':'SOURCE_LOCKED';
    return data;
  }
  async function prDetails(data) {
    if(!/^PR[1-9][0-9]{0,7}$/.test(data.object_id)) throw new Error('PR_OBJECT_REQUIRED');
    const number=Number(data.object_id.slice(2));
    const url=`https://api.github.com/repos/rokotove26-png/ronatrade.com/pulls/${number}`;
    let response;
    try {response=await fetchImpl(url,{headers:{accept:'application/vnd.github+json','user-agent':'RONA-System-Admin-Read'},signal:AbortSignal.timeout(8000)});} catch {throw new Error('GITHUB_SOURCE_UNAVAILABLE');}
    if(!response.ok) throw new Error('GITHUB_SOURCE_UNAVAILABLE');
    const pr=await response.json();
    const body=typeof pr.body==='string'?pr.body.slice(0,20000):'';
    const gate=body.split(/\n/).find(line=>/draft until/i.test(line))??null;
    data.pr={number,state:pr.state,draft:pr.draft,merged:pr.merged,mergeable:pr.mergeable,title:pr.title,url:pr.html_url,author:pr.user?.login??null,assignees:(pr.assignees??[]).map(a=>a.login),requested_reviewers:(pr.requested_reviewers??[]).map(a=>a.login),base_sha:pr.base?.sha,head_sha:pr.head?.sha,updated_at:pr.updated_at,acceptance_text:body};
    data.gate=data.gate??gate;
    data.required_action=data.required_action??gate;
    data.completion_criteria=data.completion_criteria??gate;
    data.source_refs.push(url);
    return data;
  }
  async function reviewDetails(data) {
    if(data.object_id!=='PRIVATE_RLS') throw new Error('REVIEW_OBJECT_REQUIRED');
    const handoff=data.coordination_records.find(r=>r.record_type==='HANDOFF_REQUEST'&&r.payload?.requested_check&&TABLES.every(t=>r.payload.requested_check.includes(t)));
    if(!handoff) throw new Error('REVIEW_TABLE_SOURCE_MISSING');
    const tables=await sql`select n.nspname as schema,c.relname as table_name,c.relrowsecurity as rls_enabled,c.relforcerowsecurity as force_rls,(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive)),'[]'::jsonb) from pg_policy p where p.polrelid=c.oid) as policies,(select coalesce(jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type)),'[]'::jsonb) from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee=0 or pg_get_userbyid(a.grantee) in ('anon','authenticated','service_role')) as direct_grants from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='portal_private' and c.relname in ('admin_impersonation_sessions','admin_impersonation_events','admin_entity_retirement_operations','admin_auth_cleanup_outbox') and c.relkind in ('r','p') order by c.relname`;
    data.tables=TABLES.map(name=>{const t=tables.find(t=>t.table_name===name);return t?{...t,review_status:'SMOKE_REGRESSION_EVIDENCE_REQUIRED',catalog_status:t.rls_enabled&&!t.force_rls&&t.direct_grants.length===0?'HARDENING_CONFIGURATION_OBSERVED':'CONFIGURATION_REVIEW_REQUIRED'}:{table_name:name,review_status:'TABLE_NOT_FOUND'};});
    data.required_action=data.required_action??handoff.payload.requested_check;
    data.completion_criteria=data.completion_criteria??handoff.payload.requested_check;
    data.review_status=data.status;
    data.source_refs.push('POSTGRES_CATALOG:pg_class/pg_policy/aclexplode');
    return data;
  }
  return async function call(ctx,req,msg) {
    const name=msg?.params?.name;
    if(!SYSTEM_ADMIN_DETAIL_TOOLS.some(t=>t.name===name))return null;
    const ids=requestIds(req);
    const deny=async code=>{await recordMcpEvent(ctx,ids,name,'DENIED',200,{code});return rpcToolResponse(msg.id,{ok:false,code,status:403},true);};
    if(!ctx||!isAdmin(ctx)||!scopeHas(ctx.scope,'mcp:read'))return deny('SYSTEM_ADMIN_READ_REQUIRED');
    if(!await rateAllowed(ctx))return rpcToolResponse(msg.id,{ok:false,code:'RATE_LIMITED',status:429},true);
    const args=msg?.params?.arguments;
    if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==1||typeof args.object_id!=='string'||! /^[A-Z][A-Z0-9_]{0,159}$/.test(args.object_id))return deny('INVALID_ARGUMENTS');
    let data;
    try {
      data=await loadObject(ctx,args.object_id);
      if(!data)return deny('OBJECT_NOT_IN_ROLE_OPEN_DELTA');
      if(name==='pr_detail')data=await prDetails(data);
      if(name==='review_detail'||(name==='object_detail'&&args.object_id==='PRIVATE_RLS'))data=await reviewDetails(data);
      data.missing_source_fields=['owner','gate','dependency','required_action','hold_reason','completion_criteria'].filter(k=>data[k]===null);
      data.detail_completeness=data.missing_source_fields.length?'PARTIAL_SOURCE':'SOURCE_LOCKED';
    }catch(e){const code=['PR_OBJECT_REQUIRED','REVIEW_OBJECT_REQUIRED','REVIEW_TABLE_SOURCE_MISSING','GITHUB_SOURCE_UNAVAILABLE'].includes(e.message)?e.message:'DETAIL_SOURCE_ERROR';return deny(code);}
    await recordMcpEvent(ctx,ids,name,'SUCCESS',200,{object_id:data.object_id,detail_completeness:data.detail_completeness});
    return rpcToolResponse(msg.id,{ok:true,role:ctx.role,identity_id:ctx.identity_id,correlation_id:ids.correlationId,data});
  };
}
