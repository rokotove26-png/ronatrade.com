import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthDbUnavailableError, withAuthDbConnectRecovery } from '../supabase/functions/rona-portal-api/auth-db-connect-recovery.mjs';

const requestId = 'b9308727-e794-4db3-9d8f-98a1da7660f1';
const ctx = { requestId, runtimeRegion: 'eu-central-1', sleep: async () => {} };
const connectTimeout = () => Object.assign(new Error('write CONNECT_TIMEOUT'), { code: 'CONNECT_TIMEOUT' });

async function dispatch(query, options = {}) {
  let mutations = 0;
  const rows = await withAuthDbConnectRecovery(query, { ...ctx, ...options });
  if (rows.length !== 1) return { status: 401, mutations };
  mutations++;
  return { status: 200, mutations, user: rows[0].user };
}

test('valid session with a normal database authenticates, then dispatches once', async () => {
  let calls = 0;
  const result = await dispatch(() => { calls++; return [{ user: 'allowed' }]; });
  assert.deepEqual(result, { status: 200, mutations: 1, user: 'allowed' });
  assert.equal(calls, 1);
});

test('invalid session fails closed without retry or mutation', async () => {
  let calls = 0;
  const result = await dispatch(() => { calls++; return []; });
  assert.deepEqual(result, { status: 401, mutations: 0 });
  assert.equal(calls, 1);
});

test('CONNECT_TIMEOUT recovers before dispatch and does not duplicate mutation', async () => {
  let calls = 0;
  const lines = [];
  const result = await dispatch(() => ++calls === 1 ? Promise.reject(connectTimeout()) : [{ user: 'allowed' }],
    { log: (line) => lines.push(JSON.parse(line)) });
  assert.equal(calls, 2);
  assert.deepEqual(result, { status: 200, mutations: 1, user: 'allowed' });
  assert.equal(lines.length, 1);
  assert.deepEqual(Object.keys(lines[0]).sort(),
    ['attempt', 'elapsed_ms', 'error_code', 'phase', 'request_id', 'runtime_region'].sort());
  assert.equal(lines[0].error_code, 'CONNECT_TIMEOUT');
  assert.equal(lines[0].request_id, requestId);
  assert.equal(lines[0].runtime_region, 'eu-central-1');
});

test('exhausted connect failure is distinct from 401, with zero mutation', async () => {
  let calls = 0, mutations = 0;
  const lines = [];
  try {
    await withAuthDbConnectRecovery(() => { calls++; throw connectTimeout(); },
      { ...ctx, log: (line) => lines.push(JSON.parse(line)) });
    mutations++;
    assert.fail('authentication must not dispatch');
  } catch (error) {
    assert.ok(error instanceof AuthDbUnavailableError);
    assert.equal(error.code, 'AUTH_BACKEND_UNAVAILABLE');
    assert.equal(error.requestId, requestId);
  }
  assert.equal(calls, 2);
  assert.equal(mutations, 0);
  assert.deepEqual(lines.map((line) => [line.phase, line.attempt, line.error_code]),
    [['AUTH_DB_CONNECT', 1, 'CONNECT_TIMEOUT'], ['AUTH_DB_CONNECT', 2, 'CONNECT_TIMEOUT']]);
});

test('authorization and SQL errors never retry', async () => {
  for (const error of [Object.assign(new Error('denied'), { code: 'P0001' }),
    new Error('business CONNECT_TIMEOUT'), Object.assign(new Error('auth failure'), { code: '28P01' })]) {
    let calls = 0;
    await assert.rejects(withAuthDbConnectRecovery(() => { calls++; throw error; }, ctx), (caught) => caught === error);
    assert.equal(calls, 1);
  }
});

test('a finite deadline returns controlled infrastructure failure without dispatch', async () => {
  let calls = 0;
  await assert.rejects(withAuthDbConnectRecovery(() => { calls++; return new Promise(() => {}); },
    { ...ctx, deadlineMs: 15, log: () => {} }), AuthDbUnavailableError);
  assert.equal(calls, 1);
});
