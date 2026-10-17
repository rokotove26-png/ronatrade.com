// SYSTEM_ADMIN-only handoff lifecycle. Append-only coordination + idempotent
// technical staff-task materialization. NEVER mutates authoritative business data.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEM=/^[A-Za-z0-9][A-Za-z0-9._:\/-]{7,159}$/;
const STATUSES=new Set(['ACKNOWLEDGED','BLOCKED','VERIFIED_RESOLVED']);
const EXACT_SYSTEM=new Set(['MCP','INFRASTRUCTURE']);
const safeArgs=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
export const SYSTEM_ADMIN_HANDOFF_WRITE_TOOLS=Object.freeze([
  {name:'staff_handoff_task_materialize',title:'Принять технический handoff в задачи',
   description:'Создать только собственную техническую staff_tasks задачу из проверенного текущего SYSTEM:MCP или SYSTEM:INFRASTRUCTURE HANDOFF_REQUEST. Source-locked, audit+idempotency; не создает бизнес-фактов.',
   inputSchema:{type:'object',properties:{
     record_id:{type:'string',format:'uuid'},
     note:{type:'string',minLength:5,maxLength:1500},
     evidence_refs:{type:'array',items:{type:'string',minLength:1,maxLength:200},minItems:1,maxItems:20},
     idempotency_key:{type:'string',minLength:8,maxLength:160},
   },required:['record_id','note','evidence_refs','idempotency_key'],additionalProperties:false},
   annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},
   securitySchemes:[{type:'oauth2',scopes:['mcp:coordinate']}]},
  {name:'staff_handoff_status_submit',title:'Аудируемая сверка входящего handoff',
   description:'Append-only versioned ACKNOWLEDGED/BLOCKED. VERIFIED_RESOLVED только после COMPLETED технической staff_tasks и канонического task_complete с доказательством. Нет массового закрытия или смены бизнес-статусов.',
   inputSchema:{type:'object',properties:{
     record_id:{type:'string',format:'uuid'},
     outcome:{type:'string',enum:[...STATUSES]},
     note:{type:'string',minLength:5,maxLength:1500},
     evidence_refs:{type:'array',items:{type:'string',minLength:1,maxLength:200},minItems:1,maxItems:20},
     idempotency_key:{type:'string',minLength:8,maxLength:160},
   },required:['record_id','outcome','note','evidence_refs','idempotency_key'],additionalProperties:false},
   annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},
   securitySchemes:[{type:'oauth2',scopes:['mcp:coordinate']}]},
]);

export function technicalHandoffTaskId(root) {
  if(!UUID.test(String(root||'')))throw Error('INVALID_ROOT_ID');
  return 'TASK-SYS-HO-'+root.replaceAll('-','').toUpperCase();
}
export function createSystemAdminHandoffWorkflow(deps) {
 const {sql,primaryTechnicalCtx,scopeHas,requestIds,rateAllowed,
   recordMcpEvent,rpcToolResponse,sha256Hex,stableStringify}=deps;
 const toolSet=new Set(SYSTEM_ADMIN_HANDOFF_WRITE_TOOLS.map(x=>x.name));
 const isText=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/[\u0000-\u001F\u007F]/.test(v);
 const refs=v=>Array.isArray(v)&&v.length>=1&&v.length<=20&&v.every(x=>isText(x,1,200));
 const error=(msg,code,status=403)=>rpcToolResponse(msg.id,{ok:false,code,status},true);
 const priorSql="SELECT record_id,status,version,payload_hash FROM portal_private.ai_coordination_records WHERE identity_id=$1 AND tool_name=$2 AND idempotency_key_hash=$3 LIMIT 1";
 const currentSql="SELECT record_id,parent_record_id,record_type,status,version,target_type,target_id,target_role::text AS target_role,functional_role::text AS sender,payload,source_refs,qa_only FROM portal_private.ai_coordination_records WHERE record_id=$1::uuid AND record_type='HANDOFF_REQUEST' AND target_role='SYSTEM_ADMIN'::portal_private.ai_business_role_enum AND qa_only=false FOR UPDATE";
 const auditSql="INSERT INTO portal_private.ai_coordination_audit_events(functional_role,identity_id,token_id,client_id,server_slug,tool_name,target_type,target_id,correlation_id,mcp_request_id,idempotency_key_hash,payload_hash,result,denial_code,resulting_record_id,resulting_version,qa_only,metadata) VALUES('SYSTEM_ADMIN'::portal_private.ai_business_role_enum,$1,$2::uuid,$3,$4,$5,$6,$7,$8::uuid,$9::uuid,$10,$11,'SUCCESS',null,$12::uuid,$13,false,$14::jsonb)";
 const taskSql="INSERT INTO portal_private.staff_tasks(task_id,title,description,status,priority,authority_domain,assigned_functional_role,source_type,source_object_id,source_version,source_hash,qa_only) VALUES($1,$2,$3,'NEW'::portal_private.staff_task_status_enum,$4::portal_private.staff_priority_enum,'TECHNICAL','SYSTEM_ADMIN'::portal_private.staff_functional_role_enum,'SYSTEM_ADMIN_HANDOFF_V1',$5,'HANDOFF_SOURCE_V1',$6,false) ON CONFLICT(task_id) DO NOTHING RETURNING task_id,status::text";
 const insertCoordSql="INSERT INTO portal_private.ai_coordination_records(record_type,functional_role,identity_id,token_id,client_id,server_slug,tool_name,target_type,target_id,target_role,parent_record_id,version,supersedes_id,idempotency_key_hash,payload_hash,source_refs,evidence_refs,payload,status,correlation_id,mcp_request_id,qa_only) VALUES('HANDOFF_REQUEST','SYSTEM_ADMIN'::portal_private.ai_business_role_enum,$1,$2::uuid,$3,$4,'staff_handoff_status_submit',$5,$6,'SYSTEM_ADMIN'::portal_private.ai_business_role_enum,$7::uuid,$8,$9::uuid,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16::uuid,$17::uuid,false) RETURNING record_id,status,version";
 async function handle(ctx,req,msg){
  const name=String(msg?.params?.name||'');
  if(!toolSet.has(name))return null;
  if(!primaryTechnicalCtx(ctx)||ctx?.identity_id!=='AI-SYSTEM-ADMIN')return error(msg,'SYSTEM_ADMIN_IDENTITY_REQUIRED');
  if(!scopeHas(ctx.scope,'mcp:coordinate'))return error(msg,'COORDINATION_SCOPE_REQUIRED',401);
  if(ctx.qaOnly)return error(msg,'QA_ONLY_MUTATION_DENIED');
  if(!await rateAllowed(ctx))return error(msg,'RATE_LIMITED',429);
  const args=msg?.params?.arguments??{};
  const keys=name==='staff_handoff_status_submit'
    ?['record_id','outcome','note','evidence_refs','idempotency_key']
    :['record_id','note','evidence_refs','idempotency_key'];
  if(!safeArgs(args,keys)||!UUID.test(String(args.record_id||''))||
     !isText(args.note,5,1500)||!refs(args.evidence_refs)||
     !IDEM.test(String(args.idempotency_key||''))||
     (name==='staff_handoff_status_submit'&&!STATUSES.has(args.outcome)))
    return error(msg,'INVALID_ARGUMENTS');
  const ids=requestIds(req),rootKey='SYSTEM_ADMIN_HANDOFF_SOURCE:'+args.record_id;
  const idemHash=await sha256Hex(args.idempotency_key);
  const payloadHash=await sha256Hex(stableStringify({
    record_id:args.record_id,outcome:args.outcome??null,note:args.note,evidence_refs:args.evidence_refs
  }));
  let result;
  try{
   result=await sql.begin(async tx=>{
    await tx.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[rootKey]);
    await tx.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['SYSTEM_ADMIN_HANDOFF_IDEMP:'+ctx.identity_id+'|'+name+'|'+idemHash]);
    // Task creation is audited directly in ai_coordination_audit_events,
    // not in HANDOFF_REQUEST. Reused idempotency keys must still fail closed.
    if(name==='staff_handoff_task_materialize'){
      const priorAudit=await tx.unsafe("SELECT payload_hash,metadata FROM portal_private.ai_coordination_audit_events WHERE identity_id=$1 AND tool_name=$2 AND idempotency_key_hash=$3 AND result='SUCCESS' AND qa_only=false ORDER BY event_at DESC LIMIT 1",[ctx.identity_id,name,idemHash]);
      if(priorAudit.length){
        if(priorAudit[0].payload_hash!==payloadHash)return{error:'IDEMPOTENCY_CONFLICT'};
        const receipt=priorAudit[0].metadata||{};
        return{task_id:receipt.task_id,root_record_id:receipt.root_record_id,replay:true,task_status:null};
      }
    }
    const prior=await tx.unsafe(priorSql,[ctx.identity_id,name,idemHash]);
    if(prior.length){
      if(prior[0].payload_hash!==payloadHash)return{error:'IDEMPOTENCY_CONFLICT'};
      return{record_id:prior[0].record_id,status:prior[0].status,version:prior[0].version,replay:true};
    }
    const srcRows=await tx.unsafe(currentSql,[args.record_id]);
    if(srcRows.length!==1)return{error:'HANDOFF_NOT_FOUND_OR_NOT_AUTHORIZED'};
    const src=srcRows[0];
    const newer=await tx.unsafe("SELECT record_id FROM portal_private.ai_coordination_records WHERE supersedes_id=$1::uuid AND qa_only=false LIMIT 1",[args.record_id]);
    if(newer.length)return{error:'HANDOFF_VERSION_SUPERSEDED'};
    if(!['REQUESTED','ACKNOWLEDGED','BLOCKED'].includes(src.status))return{error:'HANDOFF_STATUS_TERMINAL'};
    const root=String(src.parent_record_id||src.record_id);
    const taskId=technicalHandoffTaskId(root);
    const isTechnical=src.target_type==='SYSTEM'&&EXACT_SYSTEM.has(src.target_id);
    if(name==='staff_handoff_task_materialize') {
      if(!isTechnical)return{error:'TECHNICAL_SOURCE_SCOPE_REQUIRED'};
      const existing=await tx.unsafe("SELECT task_id,status::text,source_type,source_object_id FROM portal_private.staff_tasks WHERE task_id=$1 LIMIT 1",[taskId]);
      if(existing.length){
        if(existing[0].source_type!=='SYSTEM_ADMIN_HANDOFF_V1'||existing[0].source_object_id!==root)return{error:'TASK_SOURCE_CONFLICT'};
        return{task_id:taskId,task_status:existing[0].status,root_record_id:root,replay:true};
      }
      const title=String(src.payload?.subject||'Technical handoff '+root).slice(0,230);
      const priority=['LOW','NORMAL','HIGH','CRITICAL'].includes(src.payload?.priority)?src.payload.priority:'NORMAL';
      const desc=['Source handoff: '+root,'Request: '+String(src.payload?.requested_check||'').slice(0,2600),
        'Reason: '+String(src.payload?.reason||'').slice(0,800),
        'Reviewed scope: '+args.note.trim(),'Evidence: '+args.evidence_refs.join(' | ')].join('\n').slice(0,3900);
      const sourceHash=await sha256Hex(stableStringify({root,source_payload:src.payload}));
      const inserted=await tx.unsafe(taskSql,[taskId,title,desc,priority,root,sourceHash]);
      if(inserted.length!==1)return{error:'TASK_CONCURRENT_INSERT_CONFLICT'};
      await tx.unsafe(auditSql,[ctx.identity_id,ctx.token_id,ctx.client_id,ctx.server_slug,name,'SYSTEM',src.target_id,ids.correlationId,ids.mcpRequestId,idemHash,payloadHash,null,null,JSON.stringify({source_record_id:src.record_id,root_record_id:root,task_id:taskId,kind:'TASK_MATERIALIZED'})]);
      return{task_id:taskId,task_status:'NEW',root_record_id:root,replay:false};
    }
    if(args.outcome==='VERIFIED_RESOLVED') {
      if(!isTechnical)return{error:'BUSINESS_SCOPE_RESOLUTION_DENIED'};
      const evidence=await tx.unsafe("SELECT s.status::text FROM portal_private.staff_tasks s WHERE s.task_id=$1 AND s.source_type='SYSTEM_ADMIN_HANDOFF_V1' AND s.source_object_id=$2 AND s.assigned_functional_role='SYSTEM_ADMIN'::portal_private.staff_functional_role_enum AND s.authority_domain='TECHNICAL' AND s.qa_only=false AND s.status='COMPLETED'::portal_private.staff_task_status_enum AND EXISTS(SELECT 1 FROM portal_private.ai_coordination_records c WHERE c.record_type='TASK_TERMINAL_ACTION' AND c.target_type='TASK' AND c.target_id=s.task_id AND c.tool_name='task_complete' AND c.status='COMPLETED' AND c.qa_only=false) LIMIT 1",[taskId,root]);
      if(!evidence.length)return{error:'CANONICAL_TASK_COMPLETION_PROOF_REQUIRED'};
    }
    const payload={...src.payload,origin_sender:src.payload?.origin_sender||src.sender,
      handoff_lifecycle:{contract:'SYSTEM_ADMIN_HANDOFF_LIFECYCLE_V1',root_record_id:root,
      previous_record_id:src.record_id,outcome:args.outcome,note:args.note,evidence_refs:args.evidence_refs}};
    const inserted=await tx.unsafe(insertCoordSql,[
      ctx.identity_id,ctx.token_id,ctx.client_id,ctx.server_slug,src.target_type,src.target_id,
      root,Number(src.version)+1,src.record_id,idemHash,payloadHash,
      JSON.stringify(src.source_refs||[]),JSON.stringify(args.evidence_refs),JSON.stringify(payload),
      args.outcome,ids.correlationId,ids.mcpRequestId
    ]);
    if(inserted.length!==1)return{error:'HANDOFF_VERSION_WRITE_FAILED'};
    await tx.unsafe(auditSql,[ctx.identity_id,ctx.token_id,ctx.client_id,ctx.server_slug,name,src.target_type,src.target_id,ids.correlationId,ids.mcpRequestId,idemHash,payloadHash,inserted[0].record_id,inserted[0].version,JSON.stringify({source_record_id:src.record_id,root_record_id:root,prior_status:src.status,new_status:args.outcome})]);
    return{record_id:inserted[0].record_id,status:inserted[0].status,version:inserted[0].version,root_record_id:root,replay:false};
   });
  }catch(e){
   const code=e?.code==='53300'?'RUNTIME_DB_CONNECTION_LIMIT':'HANDOFF_SAFE_WRITE_UNAVAILABLE';
   return error(msg,code,503);
  }
  if(result.error){
    await recordMcpEvent(ctx,ids,name,'DENIED',200,{code:result.error,source_record_id:args.record_id});
    return error(msg,result.error,/CONFLICT|SUPERSEDED/.test(result.error)?409:403);
  }
  await recordMcpEvent(ctx,ids,name,'SUCCESS',200,{source_record_id:args.record_id,
    root_record_id:result.root_record_id||args.record_id,result_task_id:result.task_id||null,
    result_record_id:result.record_id||null,replay:result.replay});
  return rpcToolResponse(msg.id,{
    ok:true,role:ctx.role,identity_id:ctx.identity_id,correlation_id:ids.correlationId,
    contract:'SYSTEM_ADMIN_HANDOFF_LIFECYCLE_V1',...result,no_business_fact_mutation:true
  });
 }
 return handle;
}
