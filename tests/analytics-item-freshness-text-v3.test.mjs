import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql=await readFile('supabase/migrations/20261007225800_analytics_item_freshness_text_v3.sql','utf8');

test('Analytics human-readable text uses per-item freshness',()=>{
  for(const token of [
    "v_item_freshness_note text;",
    "when v_item_freshness='STALE_SOURCE' then 'Источник продукта устарел:",
    "Данные не достраиваются и не подменяются.",
    "v_item_freshness_note||' '||v_telegram_note",
    "последний доступный композит "
  ]) assert.ok(sql.includes(token),'missing item freshness text contract: '+token);
  assert.ok(sql.includes("'PUBLIC_DISPLAY_FACT_MTD_FORWARD_V4'"));
});

test('Freshness text patch stays data-only and visual-freeze safe',()=>{
  assert.equal(/update\s+portal_private\.market_intelligence_facts/i.test(sql),false);
  assert.equal(/update\s+portal_private\.owner_price_snapshots/i.test(sql),false);
  assert.equal(sql.includes('document.'),false);
  assert.equal(sql.includes('style.'),false);
});
