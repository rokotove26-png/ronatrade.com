import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20260928161000_google_news_duplicate_lookup_index.sql',
  'utf8'
);
const rollback=fs.readFileSync(
  'supabase/rollback/20260928161000_google_news_duplicate_lookup_index.rollback.sql',
  'utf8'
);

assert.match(migration,/create index if not exists telegram_market_documents_gnews_caption_norm_idx/i);
assert.match(migration,/lower\(regexp_replace\(btrim\(telegram_caption\),'\\s\+',' ','g'\)\)/i);
assert.match(migration,/where ingest_source='OPEN_WEB_GNEWS'/i);
assert.doesNotMatch(migration,/delete\s+from/i);
assert.doesNotMatch(migration,/drop\s+table/i);
assert.doesNotMatch(migration,/alter\s+table/i);
assert.match(rollback,/drop index if exists portal_private\.telegram_market_documents_gnews_caption_norm_idx/i);

console.log('GOOGLE NEWS DUPLICATE LOOKUP INDEX CONTRACT PASS');
