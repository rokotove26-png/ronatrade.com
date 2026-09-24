import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { AuthDbUnavailableError, withAuthDbConnectRecovery } from '../supabase/functions/rona-portal-api/auth-db-connect-recovery.mjs';

const shared = readFileSync(new URL('../supabase/functions/rona-portal-api/shared.ts', import.meta.url), 'utf8');
const wrapper = readFileSync(new URL('../supabase/functions/rona-portal-api/payments-v8-production-hardening.ts', import.meta.url), 'utf8');
const applicationHandler = readFileSync(new URL('../supabase/functions/_shared/client-application-business-v2/handler.mjs', import.meta.url), 'utf8');
const sessionId = '57597070-b859-4e68-9e13-99cc03e2f9af';
const userId = '19bb3586-b551-4c0b-a529-65e0603d121e';

function actualAuthenticate({ getUser = async () => ({ data: { user: { id: userId } }, error: null }), query }) {
  const start = shared.indexOf('export async function authenticate(req:Request)');
  const end = shared.indexOf('export async function sessionScope(c:Ctx)');
  assert.ok(start > 0 && end > start);
  const source = shared.slice(start, end)
    .replace('export async function authenticate(req:Request):Promise<Ctx|null>', 'async function authenticate(req)')
    .replace('const base:Ctx=', 'const base=')
    .replace('SUPA_URL!', 'SUPA_URL');
  let sqlCalls = 0;
  const sql = (parts) => {
    sqlCalls++;
    assert.match(parts.join(''), /portal_private\.resolve_portal_auth/);
    assert.match(parts.join(''), /join auth\.sessions/);
    return query(sqlCalls);
  };
  const authenticate = Function('createClient', 'SUPA_URL', 'runtimeKey', 'claims', 'uuid', 'sql',
    'withAuthDbConnectRecovery', 'Deno', 'resolveAdminImpersonation', `return (${source});`)(
    () => ({ auth: { getUser } }), 'https://example.invalid', () => 'test-only-key',
    () => ({ session_id: sessionId }), /^[0-9a-f-]{36}$/i, sql,
    (operation, options) => withAuthDbConnectRecovery(operation, { ...options, sleep: async () => {}, log: () => {} }),
    { env: { get: () => 'eu-central-1' } }, () => { throw new Error('unexpected impersonation'); });
  const request = new Request('https://example.invalid/v1/admin/client-intake/E/respond',
    { method: 'POST', headers: { authorization: 'Bearer test-token' } });
  return { authenticate: () => authenticate(request), sqlCalls: () => sqlCalls };
}

const validRow = { portal_user_id: userId, display_name: 'QA', roles: ['ADMIN'], not_after: null };
const timeout = () => Object.assign(new Error('write CONNECT_TIMEOUT'), { code: 'CONNECT_TIMEOUT' });

test('actual authenticate code: valid session normal DB', async () => {
  const harness = actualAuthenticate({ query: () => [validRow] });
  const ctx = await harness.authenticate();
  assert.equal(ctx.user, userId);
  assert.deepEqual(ctx.roles, ['ADMIN']);
  assert.equal(harness.sqlCalls(), 1);
});

test('actual authenticate code: invalid user and invalid session fail closed', async () => {
  const invalidUser = actualAuthenticate({ getUser: async () => ({ data: { user: null }, error: { code: 'INVALID' } }), query: () => assert.fail('SQL must not run') });
  assert.equal(await invalidUser.authenticate(), null);
  assert.equal(invalidUser.sqlCalls(), 0);
  const invalidSession = actualAuthenticate({ query: () => [] });
  assert.equal(await invalidSession.authenticate(), null);
  assert.equal(invalidSession.sqlCalls(), 1);
});

test('actual authenticate code: transient connection recovers before one business dispatch', async () => {
  let mutations = 0;
  const harness = actualAuthenticate({ query: (call) => call === 1 ? Promise.reject(timeout()) : [validRow] });
  const ctx = await harness.authenticate();
  if (ctx?.roles.includes('ADMIN')) mutations++;
  assert.equal(harness.sqlCalls(), 2);
  assert.equal(mutations, 1);
});

test('actual authenticate code: exhausted connection yields infrastructure error before mutation', async () => {
  let mutations = 0;
  const harness = actualAuthenticate({ query: () => Promise.reject(timeout()) });
  await assert.rejects(async () => { await harness.authenticate(); mutations++; }, AuthDbUnavailableError);
  assert.equal(harness.sqlCalls(), 2);
  assert.equal(mutations, 0);
});

test('all production authentication entry paths expose 503 and retain fail-closed denial', () => {
  assert.match(wrapper, /isAuthDbUnavailable\(error\)[\s\S]{0,180}send\(req\.headers\.get\('origin'\),503/);
  assert.match(applicationHandler, /error\?\.code==='AUTH_BACKEND_UNAVAILABLE'[\s\S]{0,160}503/);
  assert.match(applicationHandler, /APPLICATION_SESSION_DENIED'},401/);
  assert.match(shared, /if\(rows\.length!==1\)return null/);
  assert.match(wrapper, /base=await capturedHandler\(req,info\)/);
});
