import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile('supabase/functions/rona-env-capability-probe-20260817/index.ts','utf8');

test('Market source processor retries Groq 400 without response_format',()=>{
  assert.ok(source.includes("VERSION='1.0.2'"));
  assert.ok(source.includes('if(r.status===400)'));
  assert.ok(source.includes('delete fallback.response_format'));
  assert.ok(source.includes('MI_MODEL_HTTP_400_FALLBACK_FAILED'));
  assert.ok(source.includes('MODEL_HTTP_${r.status}'));
});

test('Market source processor keeps custom authorization and source locking',()=>{
  assert.ok(source.includes('authorize_commercial_director_market_news_v1'));
  assert.ok(source.includes("source_kind='TELEGRAM_MARKET_DOCUMENT'"));
  assert.ok(source.includes('market_intelligence_processed_sources'));
  assert.ok(source.includes('market_intelligence_source_documents'));
  assert.ok(source.includes('market_intelligence_facts'));
});
