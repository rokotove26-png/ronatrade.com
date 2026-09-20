const upper=value=>String(value??'').trim().toUpperCase();
const text=value=>String(value??'').trim();

export function isApplicationDetailType(value){
  return upper(value).startsWith('APPLICATION_DETAILS_');
}

function applicationOwnerStatus(status,current){
  const s=upper(status);
  if(s==='DEAL_REGISTERED')return 'DEAL';
  if(['CANCELLED','CANCELED'].includes(s))return 'CANCELLED';
  if(['REJECTED','DECLINED'].includes(s))return 'REJECTED';
  return text(current)||'NEW';
}

function requestBusinessState(taskStatus,currentOwner,currentStatus,currentLifecycle){
  const s=upper(taskStatus);
  if(['COMPLETED','DONE','CLOSED'].includes(s))return {owner_status:'COMPLETED',status:'COMPLETED',lifecycle_state:'ARCHIVED'};
  if(['CANCELLED','CANCELED'].includes(s))return {owner_status:'CANCELLED',status:'CANCELLED',lifecycle_state:'ARCHIVED'};
  if(['REJECTED','DECLINED'].includes(s))return {owner_status:'REJECTED',status:'REJECTED',lifecycle_state:'ARCHIVED'};
  if(['ACKNOWLEDGED','IN_PROGRESS','PROCESSING','WORKING'].includes(s))return {owner_status:'IN_PROGRESS',status:'IN_REVIEW',lifecycle_state:'ACTIVE'};
  if(s==='NEW')return {owner_status:'NEW',status:'SUBMITTED',lifecycle_state:'ACTIVE'};
  return {
    owner_status:text(currentOwner)||'NEW',
    status:text(currentStatus)||'SUBMITTED',
    lifecycle_state:text(currentLifecycle)||'ACTIVE'
  };
}

export function normalizeClientIntakeBusinessRows(rows,applicationStates=[],taskStates=[]){
  const applications=new Map((Array.isArray(applicationStates)?applicationStates:[]).map(x=>[text(x?.application_id),x]).filter(([k])=>k));
  const tasks=new Map((Array.isArray(taskStates)?taskStates:[]).map(x=>[text(x?.intake_id),x]).filter(([k])=>k));
  const output=[];
  const seen=new Set();

  for(const source of Array.isArray(rows)?rows:[]){
    const row={...source};
    const payload=row?.effective_payload&&typeof row.effective_payload==='object'?row.effective_payload:{};
    const recordKind=upper(row?.record_kind);
    const linkedApplicationId=text(payload?.application_id||row?.linked_application_id);
    const rowApplicationId=text(row?.application_id);
    const canonicalApplicationId=recordKind==='CLIENT_APPLICATION'?rowApplicationId:linkedApplicationId;
    const appState=canonicalApplicationId?applications.get(canonicalApplicationId):null;

    // APPLICATION_DETAILS_* is an audit/intake identity linked to a canonical application,
    // never an independent business application row.
    if(isApplicationDetailType(row?.actionable_type)&&linkedApplicationId)continue;

    if(appState){
      const key=`APP:${canonicalApplicationId}`;
      if(seen.has(key))continue;
      seen.add(key);
      row.application_id=canonicalApplicationId;
      row.record_kind='CLIENT_APPLICATION';
      row.status=appState.status??row.status??null;
      row.lifecycle_state=appState.lifecycle_state??row.lifecycle_state??null;
      row.deal_id=appState.deal_id??row.deal_id??null;
      row.deal_status=appState.business_status??row.deal_status??null;
      row.owner_status=applicationOwnerStatus(row.status,row.owner_status);
      output.push(row);
      continue;
    }

    const requestId=text(row?.request_id||row?.source_id||rowApplicationId);
    const key=`REQ:${requestId}`;
    if(seen.has(key))continue;
    seen.add(key);
    const task=tasks.get(text(row?.intake_id));
    const state=requestBusinessState(task?.task_status,row.owner_status,row.status,row.lifecycle_state);
    row.record_kind='CLIENT_REQUEST';
    row.request_id=requestId||rowApplicationId;
    Object.assign(row,state);
    if(task){
      row.intake_task_status=task.task_status??null;
      row.intake_task_decision=task.task_decision??null;
      row.intake_task_decision_at=task.task_decision_at??null;
    }
    output.push(row);
  }
  return output;
}
