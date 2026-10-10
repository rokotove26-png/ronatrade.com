import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const edge=readFileSync('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts','utf8');
const runtime=readFileSync('assets/portal-runtime/client-market-intelligence-v1.js','utf8');
const attach=readFileSync('scripts/attach-client-market-intelligence-v1.mjs','utf8');
const approval=JSON.parse(readFileSync('governance/client-analytics-buyer-facing-insight-v20-20261010.json','utf8'));
const gitBlobSha=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');

test('V20 consumer output describes observable market and buyer contract; never RONA procurement strategy',()=>{
  const block=edge.slice(edge.indexOf('// Consumer-oriented presentation:'),edge.indexOf('sourceProducts[key] = output;'));
  for(const phrase of [
    'const productLabel = key === "AI92"',
    'key === "AI95" ? "АИ-95"', 'key === "DT" ? "ДТ" : "СУГ"',
    'const movement = absoluteChange > 0',
    'const forecastText = "Прогнозный ориентир на " + target',
    'formatAmount(Number(output.forecast.low))',
    'formatAmount(Number(output.forecast.base))',
    'formatAmount(Number(output.forecast.high))',
    'Планируя закупку, учитывайте сценарный диапазон',
    'и цену, опубликованную для вашего договора',
    'не определяет договорную цену',
    'buyerGuidance + commercialFactorFor(key,lastAsOf)'
  ])assert.ok(block.includes(phrase),phrase);
  assert.ok(!block.includes('candidate.commentary'));
  assert.ok(!block.includes('newsId +'));
});

test('only separately VERIFIED and client-published market news headline is echoed, no internal CD commentary',()=>{
  const factor=edge.slice(edge.indexOf('const commercialFactorFor'),edge.indexOf('// A published forecast permission'));
  assert.ok(factor.includes('candidate.headline'));
  assert.ok(!factor.includes('candidate.commentary'));
  assert.ok(factor.includes('Новость опубликована после последнего наблюдения'));
  assert.ok(factor.includes('Влияние новости на движение выбранного индикатора не подтверждено'));
  for(const phrase of [
    'cd.approved_by=\'AI-COMMERCIAL-DIRECTOR\'',
    'cd.verified is true',
    'pi.distribution_allowed=true',
    'publication_client_targets',
    'cd.analyst_commentary=pi.metadata->>\'analyst_commentary\'',
    "pi.metadata->>'client_visible'='true'",
    'headline: text(row.headline)',
    'commercial_commentary: _hidden',
    'commercial_related_products: _tags',
    'authorizedClientKeys(c)'
  ])assert.ok(edge.includes(phrase),phrase);
});

test('client-only footer hidden by one scoped style without altering AN2 commentary node',()=>{
  assert.ok(runtime.includes('#page-analytics #rona-analytics-v2 .an2-comment + .rona-owner-muted{display:none!important}'));
  assert.ok(runtime.includes("const original=root.querySelector(':scope > #rona-analytics-v2')"));
  assert.ok(!runtime.includes('root.replaceChildren('));
  assert.ok(runtime.includes('20261010-client-analytics-buyer-facing-insight-v20'));
  assert.ok(attach.includes('client-market-intelligence-v1.js?v=20261010-client-analytics-buyer-facing-insight-v20'));
});

test('V20 governance lock pins exact two successors to V19; rollback and source freeze preserved',()=>{
  const v19=JSON.parse(readFileSync('governance/client-analytics-single-owner-clean-conclusion-v19-20261010.json','utf8'));
  assert.equal(approval.approval,'OWNER_IN_CHAT');
  assert.equal(approval.scope,'CLIENT_ANALYTICS_BUYER_FACING_INSIGHT_V20');
  assert.equal(approval.requirements.wildcard_exception,false);
  assert.equal(approval.requirements.exact_blob_enforcement,true);
  assert.deepEqual(approval.requirements.four_fuels,['AI92','AI95','DT','LPG']);
  for(const [path,body] of [
    ['assets/portal-runtime/client-market-intelligence-v1.js',runtime],
    ['scripts/attach-client-market-intelligence-v1.mjs',attach]
  ]){
    assert.equal(approval.exact_post_blobs[path].supersedes_authorized_post_blob_sha,v19.exact_post_blobs[path].authorized_post_blob_sha);
    assert.equal(approval.exact_post_blobs[path].authorized_post_blob_sha,gitBlobSha(body));
  }
  assert.equal(approval.rollback.release_commit,'8e11b9bacf8af2853acf9d497ec2c7bc72205ac3');
});
