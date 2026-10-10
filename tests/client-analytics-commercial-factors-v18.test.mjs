import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const edge=readFileSync('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');
const client=readFileSync('assets/portal-runtime/client-market-intelligence-v1.js','utf8');
const governance=JSON.parse(readFileSync('governance/client-analytics-commercial-factors-v18-20261010.json','utf8'));

test('CD commentary needs both VERIFIED client-visible news and a matching approved canonical CD source',()=>{
  for(const token of [
    "p.publication_type::text='NEWS'","p.status::text='PUBLISHED'",
    "p.lifecycle_state::text='ACTIVE'","p.authority_state::text in ('VERIFIED','CONFIRMED')",
    "pi.authority_state::text in ('VERIFIED','CONFIRMED')",
    'pi.distribution_allowed=true',
    'publication_client_targets',
    "cd.news_id=pi.metadata->>'news_id'",
    'cd.verified is true',"cd.publication_status='ОПУБЛИКОВАНО'",
    "cd.approved_by='AI-COMMERCIAL-DIRECTOR'",
    'cd.approved_at is not null and cd.approved_at<=x.server_now',
    "cd.source_url=pi.metadata->>'source_url'",
    "cd.analyst_commentary=pi.metadata->>'analyst_commentary'",
    "pi.metadata->>'client_visible'='true'",
    "coalesce(pi.metadata->>'manual_release_required','false')='false'",
    "cd.source_published_at=portal_private.try_timestamptz_v1(pi.metadata->>'source_published_at')"
  ])assert.ok(edge.includes(token),token);
});
test('each news factor strictly maps to a fuel product, with explicit timing and no asserted causality',()=>{
  for(const phrase of [
    'const commercialFactorFor',
    '["БЕНЗИН","АИ-92"]',
    '["БЕНЗИН","АИ-95"]',
    '["ДИЗЕЛЬ","ДТ"]',
    '["СУГ"]',
    'news.direct || news.related',
    'Новость опубликована после последнего наблюдения',
    'Влияние новости на движение выбранного индикатора не подтверждено.',
    'candidate.headline.replace(/[.!?]+$/u',
    'Планируя закупку, учитывайте сценарный диапазон',
    'commercialFactorFor(key,lastAsOf)'
  ])assert.ok(edge.includes(phrase),phrase);
  assert.ok(!edge.includes('changesCausedByNews=true'));
  assert.ok(!edge.includes('candidate.commentary + "." + timing'));
  assert.ok(edge.includes('headline: text(row.headline)'));
  assert.ok(edge.includes('candidate.source'));
  assert.ok(edge.includes('candidate.published'));
  assert.ok(edge.includes('if (!candidate) return "";'));
});
test('client NEWS feed remains exactly original fields, annotations used only inside Analytics commentary',()=>{
  assert.ok(edge.includes('commercial_commentary: _hidden'));
  assert.ok(edge.includes('commercial_related_products: _tags'));
  assert.ok(edge.includes('payload.news = payload.news.map'));
  assert.ok(edge.includes('return safe;'));
  assert.ok(!edge.includes('payload.raw_market_news'));
});
test('source-only change preserves standard price and frozen visual contracts',()=>{
  assert.equal(governance.scope,'CLIENT_ANALYTICS_COMMERCIAL_FACTORS_V18');
  assert.equal(governance.source_approval_identity,'AI-COMMERCIAL-DIRECTOR');
  assert.equal(governance.prove_historical_causality,false);
  assert.ok(client.includes("textIfDifferent(headline,'Возможные цены RONA Trade')"));
  assert.ok(client.includes("owner.querySelectorAll('.rona-market-chart-metric [data-chart-metric]')"));
  for(const t of ['authorizedClientKeys(c)','market_intelligence_admin_canonical_payload_v1()',
    'permissionToForecast(key)','forecastSourceCurrent'])
    assert.ok(edge.includes(t),t);
});
