const encoder=new TextEncoder();

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

const FINANCE_PILOT_INFRA_TOOL_NAMES=Object.freeze([
  'execution_checkpoint_read',
  'execution_checkpoint_submit'
]);

export const FINANCE_PILOT_MAIL_READ_TOOL_NAMES=Object.freeze([
  'mail_sync_status',
  'mail_recent',
  'mail_search',
  'mail_read'
]);

function isFinancePilotMcpRoute(req){
  try{
    const path=new URL(req.url).pathname.replace(/\/+$/,'');
    return path==='/finance-pilot/mcp'||path.endsWith('/rona-mcp-gateway/finance-pilot/mcp');
  }catch{return false}
}

// Compatibility normalization only. The canonical Finance business surface remains the
// unchanged legacy eight. The shared AI Office may additionally advertise only explicitly
// allowlisted host-independent execution-recovery tools and read-only corporate mailbox
// tools. These additions do not create Finance business facts or expand Finance write authority.
export async function augmentFinancePilotToolsList(req,upstream){
  if(!isFinancePilotMcpRoute(req)||!upstream.ok)return upstream;
  let body;try{body=await upstream.clone().json()}catch{return upstream}
  const tools=body?.result?.tools;
  if(!Array.isArray(tools))return upstream;

  const allowedNames=[...FINANCE_PILOT_LEGACY_TOOL_NAMES,...FINANCE_PILOT_INFRA_TOOL_NAMES,...FINANCE_PILOT_MAIL_READ_TOOL_NAMES];
  const byName=new Map();
  for(const tool of tools){
    const name=String(tool?.name||'');
    if(allowedNames.includes(name)&&!byName.has(name))byName.set(name,tool);
  }
  if(FINANCE_PILOT_LEGACY_TOOL_NAMES.some(name=>!byName.has(name)))return upstream;

  body.result.tools=[
    ...FINANCE_PILOT_LEGACY_TOOL_NAMES.map(name=>byName.get(name)),
    ...FINANCE_PILOT_INFRA_TOOL_NAMES.map(name=>byName.get(name)).filter(Boolean),
    ...FINANCE_PILOT_MAIL_READ_TOOL_NAMES.map(name=>byName.get(name)).filter(Boolean),
  ];
  const serialized=JSON.stringify(body);
  const headers=new Headers(upstream.headers);
  headers.set('content-length',String(encoder.encode(serialized).length));
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('x-rona-finance-payments-contract','ADMIN_PAYMENTS_V7_AUTOMATIC_MATERIALIZATION_V1');
  // Preserve the historical Finance business-surface contract: this header counts
  // canonical Finance business tools only, not additive AI Office infrastructure tools.
  headers.set('x-rona-finance-tools-count','8');
  headers.set(
    'x-rona-finance-infra-tools-count',
    String(FINANCE_PILOT_INFRA_TOOL_NAMES.filter(name=>byName.has(name)).length)
  );
  headers.set(
    'x-rona-finance-mail-read-tools-count',
    String(FINANCE_PILOT_MAIL_READ_TOOL_NAMES.filter(name=>byName.has(name)).length)
  );
  return new Response(serialized,{status:upstream.status,statusText:upstream.statusText,headers});
}

export function createFinancePaymentsV7NativeHooks({sql}={}){
  void sql;
  return Object.freeze({
    async toolsList(req,res){return augmentFinancePilotToolsList(req,res)},
    async toolCall(req,msg){void req;void msg;return null}
  });
}

export function createFinancePaymentsV7GatewayExtension({upstreamHandler,sql}={}){
  void sql;
  if(typeof upstreamHandler!=='function')throw new Error('FINANCE_PAYMENTS_V7_UPSTREAM_HANDLER_REQUIRED');
  return async function financePaymentsV7Gateway(req){
    let msg=null;
    if(req.method==='POST'){
      try{msg=await req.clone().json()}catch{}
    }
    const upstream=await upstreamHandler(req);
    if(msg?.jsonrpc==='2.0'&&msg?.method==='tools/list')return augmentFinancePilotToolsList(req,upstream);
    return upstream;
  }
}
