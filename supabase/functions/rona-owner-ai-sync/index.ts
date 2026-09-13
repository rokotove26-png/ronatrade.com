// @ts-nocheck
import postgres from 'postgres';
import { createAdminPaymentsV7TruthSourceReader } from './admin-payments-v7-source-reader-truth.mjs';
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

async function persistOwnerDecision({ envelope }) {
  // The authenticated runtime authorizes the request first. This trusted backend DB context then
  // performs exactly one business mutation call: the sealed Stage 4B persistence primitive.
  const expected = envelope.p_expected_current_authority_id || null;
  const authority = JSON.stringify(envelope.p_authority);
  const audit = JSON.stringify(envelope.p_audit);
  const rows = await v7Sql`
    select p.id::text as id,p.payment_key::text as payment_key,p.decision_type,p.idempotency_key
    from portal_private.persist_owner_payment_decision_v7(
      ${expected}::uuid,
      ${authority}::jsonb,
      ${audit}::jsonb
    ) p`;
  if (rows.length !== 1) throw new Error('OWNER_DECISION_PERSISTENCE_RESULT_INVALID');
  return rows[0];
}

const readRawSources = createAdminPaymentsV7TruthSourceReader(v7Sql);
nativeServe(createRonaOwnerAiSyncV7Handler({
  runtimeHandler,
  readRawSources,
  persistOwnerDecision,
  logger: console,
}));
