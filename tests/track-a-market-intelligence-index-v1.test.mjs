import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const sql=readFileSync(
  new URL('../supabase/migrations/20260920153100_market_intelligence_source_candidate_partial_index_v1.sql',import.meta.url),
  'utf8'
);

test('migration creates only the scoped Market Intelligence candidate partial index',()=>{
  assert.match(sql,/create\s+index\s+if\s+not\s+exists\s+telegram_market_documents_mi_candidate_time_idx/i);
  assert.match(sql,/on\s+portal_private\.telegram_market_documents\s*\(message_timestamp\s+desc\)/i);
  assert.match(sql,/where\s+extraction_state\s+in\s*\('TEXT_EXTRACTED','TEXT_AND_TABLES_EXTRACTED'\)/i);
  for(const marker of [
    'Platts European Marketscan',
    'Евразийский рынок СУГ',
    'Petromarket Prices',
    'Argus European Products',
    'Eurobob oxy'
  ]) assert.ok(sql.includes(marker),marker);
});

test('migration is read-path only and does not change Market Intelligence business semantics',()=>{
  assert.doesNotMatch(sql,/\b(update|insert\s+into|delete\s+from|truncate|alter\s+table|drop\s+|create\s+table|create\s+or\s+replace\s+function)\b/i);
  assert.doesNotMatch(sql,/auto_publish_price|publication|cron\./i);
});
