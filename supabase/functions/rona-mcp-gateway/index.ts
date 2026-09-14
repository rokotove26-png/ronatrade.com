import postgres from "postgres";
import { createFinancePaymentsV7NativeHooks } from './finance-payments-v7-extension.mjs';

export const FINANCE_GATEWAY_UPSTREAM_COMMIT='736a535fe245decdf79de06d32940c2cb17370aa';
const UPSTREAM=`https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/${FINANCE_GATEWAY_UPSTREAM_COMMIT}/supabase/functions/rona-mcp-gateway/index.ts`;

const DB=Deno.env.get('SUPABASE_DB_URL');
if(!DB)throw new Error('MCP_RUNTIME_VARS_MISSING');
const financeSql=postgres(DB,{prepare:false,max:3});
globalThis['__RONA_FINANCE_V7_HOOKS__']=createFinancePaymentsV7NativeHooks({sql:financeSql});

const OLD_WRAPPED_REQUEST=`async function wrappedRequest(handler, req) {
  const msg = await inspectMcp(req);
  const name = msg?.method === "tools/call" ? String(msg?.params?.name || "") : "";
  const ctx = (name === "handoff_request_submit" || name === "coordination_detail") ? await authContext(req) : null;
  if (name === "coordination_detail" && ctx && scopeHas(ctx.scope, "mcp:read")) {
    const direct = await coordinationDetail(ctx, req, msg);
    if (direct) return direct;
  }
  if (name === "handoff_request_submit" && ctx) {
    const normalized = syntacticallyValidCrossRoleHandoff(ctx, msg?.params?.arguments ?? {});
    if (normalized) {
      const direct = await createCrossRoleHandoff(ctx, req, msg, normalized);
      if (direct) return direct;
    }
  }
  let res = await handler(req);
  if (msg?.method === "tools/list") res = await augmentToolsListResponse(res);
  if (name === "current_state") res = await compactCurrentStateResponse(res);
  return res;
}`;

const NEW_WRAPPED_REQUEST=`async function wrappedRequest(handler, req) {
  const msg = await inspectMcp(req);
  const name = msg?.method === "tools/call" ? String(msg?.params?.name || "") : "";
  const ctx = (name === "handoff_request_submit" || name === "coordination_detail") ? await authContext(req) : null;
  if (name === "coordination_detail" && ctx && scopeHas(ctx.scope, "mcp:read")) {
    const direct = await coordinationDetail(ctx, req, msg);
    if (direct) return direct;
  }
  if (name === "handoff_request_submit" && ctx) {
    const normalized = syntacticallyValidCrossRoleHandoff(ctx, msg?.params?.arguments ?? {});
    if (normalized) {
      const direct = await createCrossRoleHandoff(ctx, req, msg, normalized);
      if (direct) return direct;
    }
  }
  if (name === "finance_event_submit") {
    const hooks = globalThis["__RONA_FINANCE_V7_HOOKS__"];
    if (hooks?.toolCall) {
      const direct = await hooks.toolCall(req, msg);
      if (direct) return direct;
    }
  }
  let res = await handler(req);
  if (msg?.method === "tools/list") {
    res = await augmentToolsListResponse(res);
    const hooks = globalThis["__RONA_FINANCE_V7_HOOKS__"];
    if (hooks?.toolsList) res = await hooks.toolsList(req, res);
  }
  if (name === "current_state") res = await compactCurrentStateResponse(res);
  return res;
}`;

const upstreamResponse=await fetch(UPSTREAM,{cache:'no-store'});
if(!upstreamResponse.ok)throw new Error(`FINANCE_GATEWAY_UPSTREAM_FETCH_FAILED_${upstreamResponse.status}`);
const source=await upstreamResponse.text();
const markerCount=source.split(OLD_WRAPPED_REQUEST).length-1;
if(markerCount!==1)throw new Error(`FINANCE_GATEWAY_UPSTREAM_PATCH_MARKER_DRIFT_${markerCount}`);
const patched=source.replace(OLD_WRAPPED_REQUEST,NEW_WRAPPED_REQUEST);
await import(`data:application/javascript;charset=utf-8,${encodeURIComponent(patched)}`);
