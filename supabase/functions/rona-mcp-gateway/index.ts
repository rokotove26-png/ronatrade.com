import postgres from "postgres";
import { createFinancePaymentsV7GatewayExtension } from './finance-payments-v7-extension.mjs';

// Preserve the exact currently deployed production gateway and extend only FINANCE / AI-FINANCE Pilot.
// The current upstream gateway already wraps Deno.serve, so this extension must join that serve chain
// instead of capturing a fake server and starting a second server after upstream bootstrap.
export const FINANCE_GATEWAY_UPSTREAM_COMMIT='736a535fe245decdf79de06d32940c2cb17370aa';
const UPSTREAM=`https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/${FINANCE_GATEWAY_UPSTREAM_COMMIT}/supabase/functions/rona-mcp-gateway/index.ts`;

type RequestHandler=(req:Request)=>Response|Promise<Response>;

const DB=Deno.env.get('SUPABASE_DB_URL');
if(!DB)throw new Error('MCP_RUNTIME_VARS_MISSING');
const sql=postgres(DB,{prepare:false,max:3});
const nativeServe=Deno.serve.bind(Deno) as unknown as (...args:unknown[])=>unknown;

const financeServe=(first:unknown,second?:unknown):unknown=>{
  const handler=typeof first==='function'?first:second;
  if(typeof handler!=='function')throw new Error('FINANCE_GATEWAY_UPSTREAM_HANDLER_INVALID');
  const extended=createFinancePaymentsV7GatewayExtension({upstreamHandler:handler as RequestHandler,sql});
  return typeof first==='function'?nativeServe(extended):nativeServe(first,extended);
};

const mutableDeno=Deno as unknown as {serve:(...args:unknown[])=>unknown};
mutableDeno.serve=financeServe;
await import(UPSTREAM);
