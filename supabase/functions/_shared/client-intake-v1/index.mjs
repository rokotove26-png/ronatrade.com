import crypto from 'node:crypto';

export const CLIENT_INTAKE_CONTRACT='RONA_CLIENT_INTAKE_V1';
export const ROUTING_STATES=Object.freeze(['PENDING','QUEUED','PROCESSING','APPLIED','FAILED_RETRYABLE','DEAD_LETTER']);
export const ACTIVE_TASK_STATUSES=new Set(['NEW','ACKNOWLEDGED','IN_PROGRESS','WAITING']);
export const PRICE_MODES=Object.freeze(['ACCEPT_PUBLISHED_PRICE','CLIENT_PROPOSED_PRICE']);

export const DEFAULT_CLIENT_INTAKE_ROUTING_REGISTRY=Object.freeze([
  {policy_key:'CLIENT_APPLICATION_PUBLISHED_PRICE_V1',source_kind:'CLIENT_APPLICATION',actionable_type:'PUBLISHED_PRICE_APPLICATION',responsible_role:'OPERATIONS_DIRECTOR',task_required:true,client_visible:true,admin_visible:true,acknowledgement_required:true,priority:100},
  {policy_key:'CLIENT_APPLICATION_PROPOSED_PRICE_V1',source_kind:'CLIENT_APPLICATION',actionable_type:'CLIENT_PROPOSED_PRICE_APPLICATION',responsible_role:'OPERATIONS_DIRECTOR',task_required:true,client_visible:true,admin_visible:true,acknowledgement_required:true,priority:100},
  {policy_key:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',source_kind:'PORTAL_REVERSE_EVENT',actionable_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',responsible_role:'OPERATIONS_DIRECTOR',task_required:true,client_visible:true,admin_visible:true,acknowledgement_required:true,priority:120},
  {policy_key:'COMMERCIAL_TERMS_REQUEST_V1',source_kind:'PORTAL_REVERSE_EVENT',actionable_type:'COMMERCIAL_TERMS_REQUEST_V1',responsible_role:'OPERATIONS_DIRECTOR',task_required:true,client_visible:true,admin_visible:true,acknowledgement_required:true,priority:110},
  {policy_key:'CLIENT_MESSAGE_SUBMIT_V1',source_kind:'PORTAL_REVERSE_EVENT',actionable_type:'CLIENT_MESSAGE_SUBMIT',responsible_role:'OPERATIONS_DIRECTOR',task_required:true,client_visible:true,admin_visible:true,acknowledgement_required:true,priority:50},
  {policy_key:'CLIENT_CLAIM_SUBMIT_V1',source_kind:'PORTAL_REVERSE_EVENT',actionable_type:'CLIENT_CLAIM_SUBMIT',responsible_role:'LEGAL',task_required:true,client_visible:true,admin_visible:true,acknowledgement_required:true,priority:100},
  {policy_key:'CLIENT_PAYMENT_PROOF_SUBMIT_V1',source_kind:'PORTAL_REVERSE_EVENT',actionable_type:'CLIENT_PAYMENT_PROOF_SUBMIT',responsible_role:'ACCOUNTING',task_required:true,client_visible:true,admin_visible:true,acknowledgement_required:true,priority:100},
  {policy_key:'CLIENT_DOCUMENT_ACK_V1',source_kind:'PORTAL_REVERSE_EVENT',actionable_type:'CLIENT_DOCUMENT_ACK',responsible_role:'LEGAL',task_required:true,client_visible:true,admin_visible:true,acknowledgement_required:true,priority:90},
]);

const clone=v=>v===undefined?undefined:structuredClone(v);
const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const nowIso=clock=>new Date(clock()).toISOString();
const sourceKeyOf=s=>`${s.source_kind}:${s.source_record_id}`;
const sha=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const stableUuid=value=>{const h=sha(value);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`};
const fingerprint=s=>sha(JSON.stringify({source_kind:s.source_kind,source_record_id:s.source_record_id,source_event_type:s.source_event_type,actionable_type:deriveActionableType(s),payload:s.payload??null,quantity_tonnes:s.quantity_tonnes??null}));

export function normalizeDomQuantity(value){const n=Number(String(value??'').replace(',','.'));return Number.isFinite(n)?n:null}

export function deriveActionableType(source){
  if(source?.source_kind==='CLIENT_APPLICATION'){
    const mode=upper(source.price_mode??source?.payload?.price_mode);
    if(mode==='ACCEPT_PUBLISHED_PRICE')return 'PUBLISHED_PRICE_APPLICATION';
    if(mode==='CLIENT_PROPOSED_PRICE')return 'CLIENT_PROPOSED_PRICE_APPLICATION';
    return 'UNSUPPORTED_PRICE_MODE';
  }
  const payloadType=upper(source?.payload?.message_type);
  if(payloadType)return payloadType;
  return upper(source?.source_event_type||source?.event_type||'UNKNOWN_CLIENT_ACTIONABLE');
}

export function isActionableClientSource(source){
  if(source?.source_kind==='CLIENT_APPLICATION')return true;
  return source?.source_kind==='PORTAL_REVERSE_EVENT'&&upper(source?.actor_role)==='CLIENT'&&upper(source?.source_event_type||source?.event_type).startsWith('CLIENT_');
}

export function getPath(root,path){let node=root;for(const part of String(path||'').split('.').filter(Boolean)){if(node===null||node===undefined||typeof node!=='object')return undefined;node=node[part]}return node}
function setPath(root,path,value){const out=clone(root)??{},parts=String(path||'').split('.').filter(Boolean);if(!parts.length)return out;let node=out;for(let i=0;i<parts.length-1;i++){const p=parts[i];if(!node[p]||typeof node[p]!=='object')node[p]={};node=node[p]}node[parts.at(-1)]=clone(value);return out}

export function selectRoutingPolicy(source,registry=DEFAULT_CLIENT_INTAKE_ROUTING_REGISTRY){
  const actionableType=deriveActionableType(source),kind=source?.source_kind;
  const exact=registry.filter(p=>p.source_kind===kind&&p.actionable_type===actionableType).sort((a,b)=>(b.priority||0)-(a.priority||0))[0];
  if(exact)return clone(exact);
  if(kind==='PORTAL_REVERSE_EVENT'&&actionableType!=='CLIENT_MESSAGE_SUBMIT'&&upper(source?.source_event_type||source?.event_type)==='CLIENT_MESSAGE_SUBMIT'){
    const generic=registry.find(p=>p.source_kind===kind&&p.actionable_type==='CLIENT_MESSAGE_SUBMIT');
    if(generic&&!source?.payload?.message_type)return clone(generic);
  }
  return null;
}

export function createClientIntakeEngine(options={}){
  const registry=clone(options.registry||DEFAULT_CLIENT_INTAKE_ROUTING_REGISTRY),clock=options.clock||(()=>Date.now()),maxAttempts=Number(options.maxAttempts||3),stuckMs=Number(options.stuckMs||5*60*1000);
  const sources=new Map(),intakes=new Map(),sourceToIntake=new Map(),idempotency=new Map(),outbox=new Map(),tasks=new Map(),taskByStage=new Map(),corrections=[];

  function rememberSource(input){const source=clone(input);if(!source?.source_kind||!source?.source_record_id)throw new Error('CLIENT_INTAKE_SOURCE_ID_REQUIRED');const key=sourceKeyOf(source),existing=sources.get(key);if(!existing)sources.set(key,source);else if(fingerprint(existing)!==fingerprint(source))throw new Error('CLIENT_INTAKE_SOURCE_IMMUTABLE_CONFLICT');return clone(sources.get(key))}
  function ensureOutbox(intake,policy){const stageKey='RESPONSIBLE_ROLE_ROUTING',key=`${intake.intake_id}:${stageKey}`;if(outbox.has(key))return outbox.get(key);const missing=!policy,row={outbox_id:stableUuid(`client-intake-outbox:${key}`),intake_id:intake.intake_id,stage_key:stageKey,state:missing?'DEAD_LETTER':'PENDING',attempt_count:0,max_attempts:maxAttempts,last_error_code:missing?'ROUTING_POLICY_MISSING':null,next_attempt_at:null,processing_started_at:null,applied_at:null,created_at:nowIso(clock),updated_at:nowIso(clock)};outbox.set(key,row);return row}

  function ingest(input){
    const source=rememberSource(input);if(!isActionableClientSource(source))return null;
    const sourceKey=sourceKeyOf(source),fp=fingerprint(source),idem=text(source.idempotency_key),idemKey=idem?`${source.source_kind}:${idem}`:'';
    if(idemKey){const prior=idempotency.get(idemKey);if(prior&&prior.fingerprint!==fp)throw new Error('CLIENT_INTAKE_IDEMPOTENCY_CONFLICT');if(prior&&sourceToIntake.has(prior.source_key))return clone(intakes.get(sourceToIntake.get(prior.source_key)))}
    if(sourceToIntake.has(sourceKey))return clone(intakes.get(sourceToIntake.get(sourceKey)));
    const actionableType=deriveActionableType(source),policy=selectRoutingPolicy(source,registry),intakeId=stableUuid(`client-intake:${sourceKey}`),submittedAt=source.submitted_at||source.created_at||nowIso(clock);
    const row={contract:CLIENT_INTAKE_CONTRACT,intake_id:intakeId,durable_id:intakeId,source_kind:source.source_kind,source_record_id:String(source.source_record_id),source_event_type:upper(source.source_event_type||source.event_type||actionableType),actionable_type:actionableType,source_idempotency_key:idem||null,source_fingerprint:fp,source_submitted_at:submittedAt,client_key:source.client_key||null,contract_key:source.contract_key||null,deal_key:source.deal_key||null,client_visible:policy?policy.client_visible!==false:true,admin_visible:policy?policy.admin_visible!==false:true,routing_policy_key:policy?.policy_key||null,responsible_role:policy?.responsible_role||null,task_required:policy?.task_required===true,acknowledgement_required:policy?.acknowledgement_required===true,routing_state:policy?'PENDING':'DEAD_LETTER',routing_reason:policy?null:'ROUTING_POLICY_MISSING',created_at:nowIso(clock),updated_at:nowIso(clock)};
    intakes.set(intakeId,row);sourceToIntake.set(sourceKey,intakeId);if(idemKey)idempotency.set(idemKey,{fingerprint:fp,source_key:sourceKey,intake_id:intakeId});ensureOutbox(row,policy);return clone(row);
  }

  function effectiveSource(intakeId){const intake=intakes.get(intakeId);if(!intake)return null;let effective=clone(sources.get(`${intake.source_kind}:${intake.source_record_id}`));for(const c of corrections.filter(x=>x.intake_id===intakeId).sort((a,b)=>a.corrected_at.localeCompare(b.corrected_at)))effective=setPath(effective,c.field_path,c.corrected_value);return effective}
  function appendCorrection(input){const intake=intakes.get(input.intake_id);if(!intake)throw new Error('CLIENT_INTAKE_CORRECTION_INTAKE_REQUIRED');const source=sources.get(`${intake.source_kind}:${intake.source_record_id}`),actual=getPath(source,input.field_path);if(JSON.stringify(actual)!==JSON.stringify(input.source_value))throw new Error('CLIENT_INTAKE_CORRECTION_SOURCE_VALUE_MISMATCH');if(upper(input.correction_authority)!=='OWNER')throw new Error('CLIENT_INTAKE_CORRECTION_AUTHORITY_REQUIRED');const row=Object.freeze({correction_id:stableUuid(`correction:${input.intake_id}:${input.field_path}:${corrections.length}:${nowIso(clock)}`),intake_id:input.intake_id,source_record:`${intake.source_kind}:${intake.source_record_id}`,field_path:String(input.field_path),source_value:clone(input.source_value),corrected_value:clone(input.corrected_value),correction_authority:'OWNER',correction_reason:String(input.correction_reason||'OWNER_CORRECTION'),corrected_at:nowIso(clock)});corrections.push(row);return clone(row)}
  function projection(intakeId,audience){const intake=intakes.get(intakeId);if(!intake)return null;const visible=audience==='CLIENT'?intake.client_visible:intake.admin_visible;if(!visible)return null;const source=effectiveSource(intakeId);return{contract:CLIENT_INTAKE_CONTRACT,intake_id:intake.intake_id,durable_id:intake.durable_id,audience,actionable_type:intake.actionable_type,routing_state:intake.routing_state,status:intake.routing_state,routing_reason:intake.routing_reason,responsible_role:intake.responsible_role,source_record:`${intake.source_kind}:${intake.source_record_id}`,source_id:intake.source_record_id,submitted_at:intake.source_submitted_at,effective_payload:clone(source?.payload??null),effective_quantity_tonnes:source?.payload?.quantity_tonnes??source?.quantity_tonnes??null}}

  function processOne(key,workerOptions={}){
    const row=outbox.get(key);if(!row||!['PENDING','QUEUED','FAILED_RETRYABLE'].includes(row.state))return clone(row||null);const intake=intakes.get(row.intake_id);if(!intake)throw new Error('CLIENT_INTAKE_OUTBOX_ORPHAN');const source=sources.get(`${intake.source_kind}:${intake.source_record_id}`),policy=selectRoutingPolicy(source,registry);
    row.state='PROCESSING';row.processing_started_at=nowIso(clock);row.updated_at=nowIso(clock);row.attempt_count+=1;intake.routing_state='PROCESSING';intake.updated_at=nowIso(clock);
    if(!policy){row.last_error_code='ROUTING_POLICY_MISSING';row.state=row.attempt_count>=maxAttempts?'DEAD_LETTER':'FAILED_RETRYABLE';row.next_attempt_at=row.state==='FAILED_RETRYABLE'?nowIso(clock):null;intake.routing_state=row.state;intake.routing_reason=row.last_error_code;return clone(row)}
    if(workerOptions.fail===true){row.last_error_code=workerOptions.errorCode||'ROUTING_WORKER_FAILURE';row.state=row.attempt_count>=maxAttempts?'DEAD_LETTER':'FAILED_RETRYABLE';row.next_attempt_at=row.state==='FAILED_RETRYABLE'?nowIso(clock):null;row.updated_at=nowIso(clock);intake.routing_state=row.state;intake.routing_reason=row.last_error_code;intake.updated_at=nowIso(clock);return clone(row)}
    if(policy.task_required){const taskKey=`${intake.intake_id}:${row.stage_key}`;if(!taskByStage.has(taskKey)){const task={task_id:`CIT-${sha(taskKey).slice(0,20).toUpperCase()}`,intake_id:intake.intake_id,stage_key:row.stage_key,status:'NEW',assigned_functional_role:policy.responsible_role,created_at:nowIso(clock)};tasks.set(task.task_id,task);taskByStage.set(taskKey,task.task_id)}}
    row.state='APPLIED';row.last_error_code=null;row.next_attempt_at=null;row.applied_at=nowIso(clock);row.updated_at=nowIso(clock);intake.routing_state='APPLIED';intake.routing_reason=null;intake.updated_at=nowIso(clock);return clone(row);
  }
  function processAll(workerOptions={}){const results=[];for(const key of [...outbox.keys()].sort()){const row=outbox.get(key);if(['PENDING','QUEUED','FAILED_RETRYABLE'].includes(row.state))results.push(processOne(key,workerOptions))}return results}
  function reconcile(sourceList=[],options={}){const now=clock();for(const source of sourceList)ingest(source);for(const intake of intakes.values()){const source=sources.get(`${intake.source_kind}:${intake.source_record_id}`),policy=selectRoutingPolicy(source,registry);if(policy){intake.client_visible=true;intake.admin_visible=true;intake.responsible_role=policy.responsible_role;intake.task_required=policy.task_required===true;ensureOutbox(intake,policy)}const key=`${intake.intake_id}:RESPONSIBLE_ROLE_ROUTING`;let row=outbox.get(key);if(!row&&policy)row=ensureOutbox(intake,policy);if(row?.state==='PROCESSING'&&now-Date.parse(row.processing_started_at||row.updated_at)>stuckMs){row.state='FAILED_RETRYABLE';row.last_error_code='STUCK_PROCESSING_RECOVERED';row.next_attempt_at=nowIso(clock);intake.routing_state='FAILED_RETRYABLE';intake.routing_reason=row.last_error_code}if(policy?.task_required&&row?.state==='APPLIED'){const taskKey=`${intake.intake_id}:RESPONSIBLE_ROLE_ROUTING`;if(!taskByStage.has(taskKey)){row.state='FAILED_RETRYABLE';row.last_error_code='REQUIRED_TASK_MISSING';row.next_attempt_at=nowIso(clock);intake.routing_state='FAILED_RETRYABLE';intake.routing_reason=row.last_error_code}}}if(options.process!==false)processAll();return metrics()}
  function metrics(){const actionable=[...intakes.values()];let unrouted=0,clientInvisible=0,adminInvisible=0,stuck=0,oldest=null;const now=clock();for(const i of actionable){if(i.routing_state!=='APPLIED')unrouted++;if(!i.client_visible)clientInvisible++;if(!i.admin_visible)adminInvisible++;const row=outbox.get(`${i.intake_id}:RESPONSIBLE_ROLE_ROUTING`);if(row?.state==='PROCESSING'){const age=Math.max(0,now-Date.parse(row.processing_started_at||row.updated_at));if(age>=stuckMs){stuck++;oldest=oldest===null?age:Math.max(oldest,age)}}}return{actionable_client_intake_total:actionable.length,unrouted_client_intake_count:unrouted,client_invisible_intake_count:clientInvisible,admin_invisible_intake_count:adminInvisible,stuck_intake_count:stuck,oldest_stuck_intake_age:oldest,dual_invisible_actionable_intake_count:actionable.filter(i=>!i.client_visible&&!i.admin_visible).length}}

  return{ingest,rememberSource,appendCorrection,effectiveSource,projection,processOne,processAll,reconcile,metrics,snapshot:()=>({sources:clone([...sources.values()]),intakes:clone([...intakes.values()]),outbox:clone([...outbox.values()]),tasks:clone([...tasks.values()]),corrections:clone(corrections)}),_unsafeTestMutateIntake:(id,patch)=>Object.assign(intakes.get(id),patch),_unsafeTestMutateOutbox:(id,patch)=>Object.assign(outbox.get(`${id}:RESPONSIBLE_ROLE_ROUTING`),patch),_unsafeTestDeleteTaskForIntake:id=>{const k=`${id}:RESPONSIBLE_ROLE_ROUTING`,taskId=taskByStage.get(k);if(taskId){tasks.delete(taskId);taskByStage.delete(k)}}};
}
