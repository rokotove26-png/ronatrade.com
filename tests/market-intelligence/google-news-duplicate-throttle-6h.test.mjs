import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20260928160000_google_news_duplicate_throttle_6h.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928160000_google_news_duplicate_throttle_6h.rollback.sql',
  'utf8'
);

assert.match(migration,/collect_public_market_news_v1/);
assert.match(migration,/last_seen_at<=now\(\)-interval '6 hours'/);
assert.match(migration,/on conflict\(channel_username,message_id,sha256\) do update/);
assert.match(migration,/telegram_market_documents\.last_seen_at<=now\(\)-interval '6 hours'/);
assert.match(migration,/ingest_source='OPEN_WEB_GNEWS'/);
assert.match(migration,/v_duplicates:=v_duplicates\+1/);
assert.match(migration,/v_accepted:=v_accepted\+1/);
assert.doesNotMatch(migration,/delete\s+from/i);
assert.doesNotMatch(migration,/drop\s+table/i);
assert.match(rollback,/set last_seen_at=now\(\),updated_at=now\(\) where id=v_existing;/);
assert.match(rollback,/on conflict\(channel_username,message_id,sha256\) do update set last_seen_at=now\(\),updated_at=now\(\);/);

console.log('GOOGLE NEWS DUPLICATE THROTTLE 6H CONTRACT PASS');
