// @ts-nocheck
// Slug-agnostic entrypoint for rona-owner-ai-sync.
// Runtime business reads remain in runtime.ts. Admin Payments consumes existing upstream
// Deal handoff state read-only and applies the final Owner Finance canon inside Payments only.

import postgres from 'postgres';
import { enrichOwnerPaymentsAccountingCurrencyProgressV6 } from './owner-payments-accounting-currency-progress-v6.ts';

const nativeServe = Deno.serve.bind(Deno);
const DB = Deno.env.get('SUPABASE_DB_URL');
const ownerPaymentsSql = DB ? postgres(DB,{prepare:false,max:1,idle_timeout:1,max_lifetime:30,connect_timeout:5}) : null;
let runtimeHandler = null;

function normalizeAiSyncPath(pathname) {
  const p = String(pathname || '');
  if (/\/admin\/sync\/?$/.test(p)) return '/admin/sync';
  if (/\/agent\/sync\/?$/.test(p)) return '/agent/sync';
  return p;
}

const capturedServe = (...args) => {
  const handler = typeof args[0] === 'function' ? args[0] : args[1];
  if (typeof handler !== 'function') throw new Error('AI_SYNC_HANDLER_CAPTURE_FAILED');
  runtimeHandler = handler;
  return {
    finished: Promise.resolve(),
    ref() {},
    unref() {},
    shutdown() { return Promise.resolve(); },
    addr: { transport: 'tcp', hostname: '0.0.0.0', port: 0 },
  };
};

const serveDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve');
Object.defineProperty(Deno, 'serve', { value: capturedServe, configurable: true, writable: true });
await import('./runtime.ts');
if (serveDescriptor) Object.defineProperty(Deno, 'serve', serveDescriptor);
else Object.defineProperty(Deno, 'serve', { value: nativeServe, configurable: true, writable: true });
if (typeof runtimeHandler !== 'function') throw new Error('AI_SYNC_HANDLER_NOT_REGISTERED');

nativeServe(async (req) => {
  const url = new URL(req.url);
  const normalizedPath = normalizeAiSyncPath(url.pathname);
  if (normalizedPath !== url.pathname) url.pathname = normalizedPath;
  const init = { method: req.method, headers: req.headers, redirect: req.redirect, signal: req.signal };
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = req.body;
  const response = await runtimeHandler(new Request(url.toString(), init));
  if (normalizedPath !== '/admin/sync' || !response.ok || !ownerPaymentsSql) return response;
  const payload = await response.json().catch(()=>null);
  if (!payload?.data?.financeFragment) return new Response(JSON.stringify({ok:false,code:'OWNER_PAYMENTS_FINANCE_FRAGMENT_MISSING'}),{status:502,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  payload.data.financeFragment = await enrichOwnerPaymentsAccountingCurrencyProgressV6(payload.data.financeFragment,ownerPaymentsSql);
  const headers = new Headers(response.headers);
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-rona-owner-payments-semantics','ADMIN_PAYMENTS_DEAL_ACCOUNTING_CURRENCY_PROGRESS_V6');
  headers.set('x-rona-payments-upstream-lifecycle','READ_ONLY_EXISTING_HANDOFF');
  headers.set('x-rona-owner-finance-canon','eabba23f-70b9-4d40-86ef-3d0578c71d4a');
  headers.delete('content-length');
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
});
