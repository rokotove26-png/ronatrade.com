import postgres from "postgres";
import { createFinancePaymentsV7GatewayExtension } from './finance-payments-v7-extension.mjs';

// Preserve the exact current release gateway and extend only FINANCE / AI-FINANCE Pilot.
// CURRENT_STATE_FIRST: release/public-go-live-v1.1@e697e6c034ed24eed30229655dd2fb12857571c5.
export const FINANCE_GATEWAY_UPSTREAM_COMMIT='e697e6c034ed24eed30229655dd2fb12857571c5';
const UPSTREAM=`https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/${FINANCE_GATEWAY_UPSTREAM_COMMIT}/supabase/functions/rona-mcp-gateway/index.ts`;

type RequestHandler=(req:Request)=>Response|Promise<Response>;

const DB=Deno.env.get('SUPABASE_DB_URL');
if(!DB)throw new Error('MCP_RUNTIME_VARS_MISSING');
const sql=postgres(DB,{prepare:false,max:3});
const nativeServe=Deno.serve.bind(Deno);
let upstreamHandler:RequestHandler|null=null;

const captureServe=(first:unknown,second?:unknown):unknown=>{
  const handler=typeof first==='function'?first:second;
  if(typeof handler!=='function')throw new Error('FINANCE_GATEWAY_UPSTREAM_HANDLER_INVALID');
  upstreamHandler=handler as RequestHandler;
  return {finished:Promise.resolve(),shutdown:async()=>{}};
};

const mutableDeno=Deno as unknown as {serve:(...args:unknown[])=>unknown};
mutableDeno.serve=captureServe;
try{await import(UPSTREAM)}finally{mutableDeno.serve=nativeServe as unknown as (...args:unknown[])=>unknown}
if(typeof upstreamHandler!=='function')throw new Error('FINANCE_GATEWAY_UPSTREAM_HANDLER_NOT_CAPTURED');

nativeServe(createFinancePaymentsV7GatewayExtension({upstreamHandler:upstreamHandler as RequestHandler,sql}));
