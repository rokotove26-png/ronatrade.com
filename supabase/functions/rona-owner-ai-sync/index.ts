// @ts-nocheck
import postgres from 'postgres';
import { createAdminPaymentsV7SourceReader } from './admin-payments-v7-source-reader.mjs';
import { createRonaOwnerAiSyncV7Handler } from './admin-payments-v7-integration.mjs';

const nativeServe = Deno.serve.bind(Deno);
const DB = Deno.env.get('SUPABASE_DB_URL');
const v7Sql = DB ? postgres(DB, { prepare: false, max: 1, idle_timeout: 1, max_lifetime: 30, connect_timeout: 5 }) : null;
let runtimeHandler = null;

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
if (!v7Sql) throw new Error('ADMIN_PAYMENTS_V7_DB_UNAVAILABLE');

const readRawSources = createAdminPaymentsV7SourceReader(v7Sql);
nativeServe(createRonaOwnerAiSyncV7Handler({ runtimeHandler, readRawSources }));
