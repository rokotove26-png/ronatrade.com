import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const runtimePath='functions/portal/analytics-canonical-live-hydration.js';
const legacyPath='functions/portal/lpg-observation-gap-runtime-v13.js';
const hydrated=readFileSync(runtimePath,'utf8');
const compatibility=readFileSync(legacyPath,'utf8');
const v3=JSON.parse(readFileSync('governance/admin-analytics-source-clarity-r3-owner-scope-20261010.json','utf8'));
const v4=JSON.parse(readFileSync('governance/admin-analytics-exclusive-chart-r4-20261010.json','utf8'));
const blobHash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');

test('Admin R4 is exact R3 successor and keeps protected unchanged business code',()=>{
  assert.equal(v3.exact_post_blob_sha,'7874a3c20d3ab3cf1e7c1e27b47c9a10d256d948');
  assert.equal(v4.scope,'ADMIN_ANALYTICS_R3_EXCLUSIVE_CHART_PROJECTION_R4');
  assert.equal(v4.requirements.exact_blob_enforcement,true);
  assert.equal(v4.requirements.wildcard_exception,false);
  assert.equal(v4.requirements.verified_R3_conclusion_untouched,true);
  assert.equal(v4.requirements.no_database_or_edge_changes,true);
  assert.equal(v4.requirements.canonical_base_runtime_untouched,true);
  assert.equal(v4.requirements.pricing_math_and_authority_untouched,true);
  for(const path of v4.approved_protected_files){
    assert.equal(blobHash(readFileSync(path,'utf8')),v4.exact_post_blobs[path].authorized_post_blob_sha,'source changed outside R4 SHA '+path);
  }
  assert.equal(v4.exact_post_blobs[runtimePath].supersedes_authorized_post_blob_sha,v3.exact_post_blob_sha);
  assert.equal(v4.exact_post_blobs[legacyPath].supersedes_authorized_post_blob_sha,v4.rollback.previous_blobs[legacyPath]);
});

test('R3 admin conclusion is still sourced, with the same financial/physical basis caveats',()=>{
  for(const phrase of [
    'function adminConclusion(product,payload,key,source)',
    'изменение за показанный период',
    'Сценарий на ',
    'их прямое сравнение',
    'BASE отличается от последней котировки',
    'это не подтверждённое изменение спотовой цены',
    "comment.textContent=adminConclusion(product,payload,key,source)"
  ])assert.ok(hydrated.toLowerCase().includes(phrase.toLowerCase()),phrase);
});

test('only adminCompactChart writes Admin LPG/DT points and paths',()=>{
  assert.ok(!hydrated.includes('function markLpgObservationGaps('),'historical hydrator still mutates SVG');
  assert.ok(!hydrated.includes('markLpgObservationGaps(root,product)'),'second source projection still invoked');
  assert.ok(hydrated.includes('function adminCompactChart(root,product,key)'));
  assert.ok(hydrated.includes("svg.dataset.ronaAdminSingleOwner='20261010-admin-r3-exclusive-chart-owner-r4'"));
  assert.ok(hydrated.includes('root.dataset.ronaSourceGapSegments=String(new Set(ids.map(Number)).size)'));
  assert.ok(hydrated.includes('const positionsMatch=pts.every('));
  assert.ok(hydrated.includes('lines.length===expectedLines&&straight'));
  assert.ok(hydrated.includes('if(Number(ids[i])!==Number(ids[i-1]))continue'));
  assert.ok(hydrated.includes("window.addEventListener('rona:analytics-price-model'"));
  assert.ok(hydrated.includes("document.documentElement.dataset.ronaAnalyticsData!=='canonical-daily-live-v3'"));
  assert.ok(compatibility.includes("if(String(window.location?.pathname||'').startsWith('/portal/admin'))return"));
  assert.ok(compatibility.includes('const mo=new MutationObserver(schedule)'),'non-admin painter must remain available');
  assert.ok(compatibility.includes("window.__RONA_LPG_OBSERVATION_GAPS_V13__='source-observation-gaps-v13'"));
});
