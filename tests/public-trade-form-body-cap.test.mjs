import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const src=readFileSync(
  new URL('../supabase/functions/rona-mail-auth-test/index.ts',import.meta.url),
  'utf8'
);

test('public trade form has a bounded streaming body reader',()=>{
  assert.match(src,/const MAX_BODY_BYTES = 32 \* 1024/);
  assert.match(src,/req\.body\?\.getReader\(\)/);
  assert.match(src,/total > MAX_BODY_BYTES/);
  assert.match(src,/reader\.cancel\(\)/);
  assert.doesNotMatch(src,/await req\.json\(\)/);
});

test('oversize request fails with 413 before business processing',()=>{
  const read=src.indexOf('const parsed = await readJsonLimited(req)');
  const normalize=src.indexOf('const payload = normalizePayload(parsed.body)');
  assert.ok(read>=0 && normalize>=0 && read<normalize);
  assert.match(src,/parsed\.error === "REQUEST_TOO_LARGE" \? 413 : 400/);
});

test('existing destination, validation, idempotency and mail bridge contracts remain',()=>{
  for(const marker of [
    'office_kg@ronaoil.com',
    'PUBLIC_TRADE_FORM',
    'on conflict (idempotency_key) do nothing',
    'x-rona-mail-internal-key',
    'process-outbox',
    'RATE_LIMITED'
  ]) assert.ok(src.includes(marker),marker);
});
