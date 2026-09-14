import postgres from "npm:postgres@3.4.7";
import { createFinancePaymentsV7GatewayExtension } from './finance-payments-v7-extension.mjs';

// Preserve the exact known-good production gateway and add only the Finance Pilot tool.
// IMPORTANT: use the same direct npm import style as the upstream production gateway;
// the v21/v23 candidates used a bare import-map alias and failed at Edge runtime startup.
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
