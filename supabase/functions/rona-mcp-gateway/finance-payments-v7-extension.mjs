const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE=/^[A-Za-z0-9][A-Za-z0-9._:\/-]{7,159}$/;
const EVENT_TYPES=new Set(['CLIENT_PAYMENT_CONFIRMED','DEAL_FINANCIAL_OBLIGATION_CONFIRMED','DEAL_PAYMENT_SCHEDULE_CONFIRMED','PAYMENT_TRIGGER_CONFIRMED','OUTGOING_PAYMENT_CONFIRMED','OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED','PAYMENT_RESOURCE_CHAIN_CONFIRMED','DOCUMENTARY_STATUS_CONFIRMED']);
const encoder=new TextEncoder();

export const FINANCE_PAYMENTS_V7_TOOL=Object.freeze({
  name:'finance_event_submit',
  title:'Подтвердить финансовое событие Payments V7',
  description:'Только FINANCE / AI-FINANCE Pilot. Принимает source-locked структурированный финансовый факт и атомарно материализует его в канонический Payments V7 contour. Не читает банк, не интерпретирует исходный документ и не принимает authority от browser.',
  inputSchema:{
    type:'object',
    properties:{
      event_type:{type:'string',enum:[...EVENT_TYPES]},
      deal_id:{type:'string',minLength:1,maxLength:160},
      payment_id:{type:'string',minLength:1,maxLength:160},
      expected_current_authority_id:{type:['string','null'],pattern:'^[0-9a-fA-F-]{36}$'},
      effective_at:{type:'string',minLength:10,maxLength:80},
      source_refs:{type:'array',minItems:1,maxItems:32,items:{type:'object',properties:{source_type:{type:'string',minLength:1,maxLength:120},source_id:{type:'string',minLength:1,maxLength:240},role:{type:'string',maxLength:160}},required:['source_type','source_id'],additionalProperties:false}},
      source_version:{type:'string',minLength:1,maxLength:240},
      source_timestamp:{type:'string',minLength:10,maxLength:80},
      idempotency_key:{type:'string',minLength:8,maxLength:160},
      payload:{type:'object'}
    },
    required:['event_type','effective_at','source_refs','source_version','source_timestamp','idempotency_key','payload'],
    additionalProperties:false
  },
  annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}
});

export const FINANCE_PILOT_LEGACY_TOOL_NAMES=Object.freeze([
  'current_state',
  'history',
  'document_read',
  'task_acknowledge',
  'task_progress_submit',
  'functional_conclusion_submit',
  'handoff_request_submit',
  'business_change_proposal_submit'
]);

async function sha256Hex(value){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(String(value))));return[...d].map(x=>x.toString(16).padStart(2,'0')).join('')}
function bearer(req){const h=req.headers.get('authorization')||'';return h.startsWith('Bearer ')?h.slice(7).trim():''}
function requestIds(req){const r=req.headers.get('x-request-id')||'',c=req.headers.get('x-correlation-id')||'';return{mcpRequestId:UUID_RE.test(r)?r:crypto.randomUUID(),correlationId:UUID_RE.test(c)?c:crypto.randomUUID()}}
async function inspect(req){if(req.method!=='POST')return null;try{const m=await req.clone().json();return m&&m.jsonrpc==='2.0'&&typeof m.method==='string'?m:null}catch{return null}}
function rpc(id,body,isError=false,status=200){return new Response(JSON.stringify({jsonrpc:'2.0',id:id??null,result:{content:[{type:'text',text:JSON.stringify(body)}],...(isError?{isError:true}:{})}}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','x-content-type-options':'nosniff','x-rona-finance-payments-contract':'ADMIN_PAYMENTS_V7_FINANCE_CONTROLLED_WRITE_V1'}})}
function validEvent(args){if(!args||typeof args!=='object'||Array.isArray(args))return null;const allowed=new Set(['event_type','deal_id','payment_id','expected_current_authority_id','effective_at','source_refs','source_version','source_timestamp','idempotency_key','payload']);if(Object.keys(args).some(k=>!allowed.has(k)))return null;const event_type=String(args.event_type||'').toUpperCase();if(!EVENT_TYPES.has(event_type)||!IDEMPOTENCY_RE.test(String(args.idempotency_key||''))||!Array.isArray(args.source_refs)||args.source_refs.length<1||args.source_refs.length>32||!args.payload||typeof args.payload!=='object'||Array.isArray(args.payload))return null;const source_refs=[];for(const r of args.source_refs){if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.source_type!=='string'||!r.source_type.trim()||typeof r.source_id!=='string'||!r.source_id.trim())return null;source_refs.push({source_type:r.source_type.trim(),source_id:r.source_id.trim(),...(r.role?{role:String(r.role).trim()}:{})})}const expected=args.expected_current_authority_id==null?null:String(args.expected_current_authority_id);if(expected&&!UUID_RE.test(expected))return null;return{event_type,deal_id:args.deal_id?String(args.deal_id).trim():undefined,payment_id:args.payment_id?String(args.payment_id).trim():undefined,expected_current_authority_id:expected,effective_at:String(args.effective_at||''),source_refs,source_version:String(args.source_version||'').trim(),source_timestamp:String(args.source_timestamp||''),idempotency_key:String(args.idempotency_key),payload:args.payload}}
async function authFinance(req,sql){const token=bearer(req);if(!token)return null;const hash=await sha256Hex(token);const rows=await sql`select t.token_id,t.client_id,t.owner_portal_user_id,t.scope,t.server_slug,t.functional_role::text as role,t.identity_id,c.max_requests_per_minute from portal_private.mcp_oauth_tokens t join portal_private.mcp_gateway_config c on c.server_slug=t.server_slug and c.business_role=t.functional_role and c.identity_id=t.identity_id join portal_private.ai_service_identities i on i.identity_id=t.identity_id and i.business_role=t.functional_role where t.access_token_hash=${hash} and t.revoked_at is null and t.access_expires_at>now() and c.enabled=true and i.status::text='ACTIVE' and i.revoked_at is null limit 1`;const ctx=rows[0];if(!ctx||ctx.role!=='FINANCE'||ctx.identity_id!=='AI-FINANCE'||ctx.server_slug!=='rona-mcp-finance-pilot'||!new Set(String(ctx.scope||'').split(/\s+/)).has('mcp:coordinate'))return null;return ctx}
async function rateAllowed(ctx,sql){const rows=await sql`select count(*)::int n from portal_private.mcp_gateway_request_events where token_id=${ctx.token_id}::uuid and event_at>now()-interval '60 seconds'`;return Number(rows[0]?.n||0)<Number(ctx.max_requests_per_minute||60)}
async function audit(ctx,ids,sql,result,metadata={}){try{await sql`insert into portal_private.mcp_gateway_request_events(server_slug,functional_role,identity_id,token_id,client_id,owner_portal_user_id,tool_name,mcp_request_id,backend_request_id,correlation_id,result,http_status,metadata) values(${ctx.server_slug},${ctx.role}::portal_private.ai_business_role_enum,${ctx.identity_id},${ctx.token_id}::uuid,${ctx.client_id},${ctx.owner_portal_user_id??null}::uuid,'finance_event_submit',${ids.mcpRequestId}::uuid,null,${ids.correlationId}::uuid,${result},200,${sql.json(metadata)}::jsonb)`}catch(e){console.error('finance Payments V7 gateway audit failed',String(e?.message||e))}}

function isFinancePilotMcpRoute(req){
  try{
    const path=new URL(req.url).pathname.replace(/\/+$/,'');
    return path==='/finance-pilot/mcp'||path.endsWith('/rona-mcp-gateway/finance-pilot/mcp');
  }catch{return false}
}

async function submitFinanceEvent(ctx,req,msg,sql){
  const ids=requestIds(req);
  if(!ctx)return rpc(msg.id,{ok:false,code:'FINANCE_ROLE_BINDING_REQUIRED',status:403},true);
  if(!await rateAllowed(ctx,sql))return rpc(msg.id,{ok:false,code:'RATE_LIMITED',status:429},true);
  const event=validEvent(msg.params?.arguments);if(!event){await audit(ctx,ids,sql,'DENIED',{code:'FINANCE_EVENT_INVALID'});return rpc(msg.id,{ok:false,code:'FINANCE_EVENT_INVALID',status:400},true)}
  const actor={role:'FINANCE',identity_id:'AI-FINANCE',correlation_id:ids.correlationId,mcp_request_id:ids.mcpRequestId,server_slug:ctx.server_slug};
  try{const rows=await sql`select portal_private.persist_finance_event_v7(${sql.json(actor)}::jsonb,${sql.json(event)}::jsonb) result`;const result=rows[0]?.result||{accepted:false,reason_code:'FINANCE_EVENT_RESULT_MISSING',action_class:'TECHNICAL_MATERIALIZATION_REQUIRED'};await audit(ctx,ids,sql,result.accepted?'SUCCESS':'DENIED',{event_type:event.event_type,reason_code:result.reason_code??null,finance_event_id:result.finance_event_id??null});return rpc(msg.id,{ok:result.accepted===true,data:result,status:result.accepted===true?200:409},result.accepted!==true)}catch(e){const code=String(e?.message||e).includes('persist_finance_event_v7')?'TECHNICAL_MATERIALIZATION_REQUIRED':'FINANCE_EVENT_PERSISTENCE_FAILED';await audit(ctx,ids,sql,'ERROR',{code,error:String(e?.message||e).slice(0,500)});return rpc(msg.id,{ok:false,code,status:503},true)}
}

export async function augmentFinancePilotToolsList(req,upstream){
  if(!isFinancePilotMcpRoute(req)||!upstream.ok)return upstream;
  let body;try{body=await upstream.clone().json()}catch{return upstream}
  const tools=body?.result?.tools;
  if(!Array.isArray(tools))return upstream;

  const legacySet=new Set(FINANCE_PILOT_LEGACY_TOOL_NAMES);
  const legacy=[];
  const seen=new Set();
  const unexpected=[];
  for(const tool of tools){
    const name=String(tool?.name||'');
    if(legacySet.has(name)){
      if(seen.has(name))return upstream;
      seen.add(name);
      legacy.push(tool);
      continue;
    }
    if(name==='coordination_detail'||name===FINANCE_PAYMENTS_V7_TOOL.name)continue;
    unexpected.push(tool);
  }
  if(unexpected.length||legacy.length!==FINANCE_PILOT_LEGACY_TOOL_NAMES.length||FINANCE_PILOT_LEGACY_TOOL_NAMES.some(name=>!seen.has(name)))return upstream;

  body.result.tools=[...legacy,FINANCE_PAYMENTS_V7_TOOL];
  const serialized=JSON.stringify(body);
  const headers=new Headers(upstream.headers);
  headers.set('content-length',String(encoder.encode(serialized).length));
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('x-rona-finance-payments-contract','ADMIN_PAYMENTS_V7_FINANCE_CONTROLLED_WRITE_V1');
  headers.set('x-rona-finance-tools-count','9');
  return new Response(serialized,{status:upstream.status,statusText:upstream.statusText,headers});
}

export function createFinancePaymentsV7NativeHooks({sql}){
  return Object.freeze({
    async toolsList(req,res){return augmentFinancePilotToolsList(req,res)},
    async toolCall(req,msg){
      if(msg?.method!=='tools/call'||msg?.params?.name!=='finance_event_submit')return null;
      let ctx=null;
      try{ctx=await authFinance(req,sql)}catch(e){console.error('finance Payments V7 auth extension failed',String(e?.message||e));return rpc(msg.id,{ok:false,code:'FINANCE_EXTENSION_AUTH_UNAVAILABLE',status:503},true,503)}
      return submitFinanceEvent(ctx,req,msg,sql);
    }
  });
}

export function createFinancePaymentsV7GatewayExtension({upstreamHandler,sql}){
  if(typeof upstreamHandler!=='function')throw new Error('FINANCE_PAYMENTS_V7_UPSTREAM_HANDLER_REQUIRED');
  const hooks=createFinancePaymentsV7NativeHooks({sql});
  return async function financePaymentsV7Gateway(req){
    const msg=await inspect(req);if(!msg)return upstreamHandler(req);
    const listRequest=msg.method==='tools/list';
    const submitRequest=msg.method==='tools/call'&&msg.params?.name==='finance_event_submit';
    if(!listRequest&&!submitRequest)return upstreamHandler(req);
    if(submitRequest)return hooks.toolCall(req,msg);
    const upstream=await upstreamHandler(req);
    return hooks.toolsList(req,upstream);
  }
}
