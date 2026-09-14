import postgres from "npm:postgres@3.4.7";
import { createFinancePaymentsV7GatewayExtension } from './finance-payments-v7-extension.mjs';

// Preserve the exact current release gateway and extend only FINANCE / AI-FINANCE Pilot.
// This source pin must move only after CURRENT_STATE_FIRST confirms a newer approved release.
export const FINANCE_GATEWAY_UPSTREAM_COMMIT='0c136582cbe825149257994465d784f28a24ab0c';
const UPSTREAM=`https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/${FINANCE_GATEWAY_UPSTREAM_COMMIT}/supabase/functions/rona-mcp-gateway/index.ts`;

const DB=Deno.env.get('SUPABASE_DB_URL');
if(!DB)throw new Error('MCP_RUNTIME_VARS_MISSING');
const sql=postgres(DB,{prepare:false,max:3});
const nativeServe=Deno.serve.bind(Deno);
let upstreamHandler=null;

const captureServe=(first,second)=>{
  const handler=typeof first==='function'?first:second;
  if(typeof handler!=='function')throw new Error('FINANCE_GATEWAY_UPSTREAM_HANDLER_INVALID');
  upstreamHandler=handler;
  return {finished:Promise.resolve(),shutdown:async()=>{}};
};

Deno.serve=captureServe;
try{await import(UPSTREAM)}finally{Deno.serve=nativeServe}
if(typeof upstreamHandler!=='function')throw new Error('FINANCE_GATEWAY_UPSTREAM_HANDLER_NOT_CAPTURED');

nativeServe(createFinancePaymentsV7GatewayExtension({upstreamHandler,sql}));
