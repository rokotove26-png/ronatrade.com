import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=p=>readFileSync(p,'utf8');
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const meta=JSON.parse(read('governance/analytics-r5-owner-screenshot-repair-20261011.json'));
const migration=read('supabase/migrations/20261011004000_analytics_r5_restore_connected_observations.sql');
const rollback=read('ops/rollback/analytics-r5-connected-observations-rollback.sql');
const admin=read('functions/portal/analytics-canonical-live-hydration.js');
const client=read('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts');

const sourceSamples={
  DT:['2026-09-17','2026-09-18','2026-09-23','2026-09-24','2026-09-25','2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-06','2026-10-08'],
  LPG:['2026-09-17','2026-09-18','2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-29','2026-10-01','2026-10-05','2026-10-06','2026-10-07']
};
const gap=(now,prev)=>(Date.parse(now+'T00:00:00Z')-Date.parse(prev+'T00:00:00Z'))/86400000;
const geometry=(dates,threshold)=>{
  const ids=dates.map((d,i)=>i&&gap(d,dates[i-1])>threshold?1:0).reduce((a,step)=>{
    a.push((a.at(-1)||0)+step);return a;
  },[]);
  const edges=ids.slice(1).filter((id,i)=>id===ids[i]).length;
  return {segments:new Set(ids).size,edges,points:dates.length,sourceGap:dates.some((d,i)=>i&&gap(d,dates[i-1])>1)};
};

test('source locks: Admin R4 and Client V20 visual remain byte-for-byte',()=>{
  assert.equal(meta.approval,'OWNER_IN_CHAT');
  assert.equal(meta.scope,'ADMIN_CLIENT_ANALYTICS_R5_CONNECTED_SPARSE_OBSERVATIONS');
  assert.equal(blob(migration),meta.technical_source_locks.migration_blob);
  assert.equal(blob(rollback),meta.technical_source_locks.rollback_blob);
  assert.equal(blob(admin),meta.technical_source_locks.owner_r4_renderer_blob);
  assert.equal(meta.technical_source_locks.canonical_unmodified_md5,'a7f0ff21a938e0554684b3ef90c9d005');
  const latest=JSON.parse(read('governance/analytics-rolling30-owner-approval-v2-20261011.json'));
  assert.equal(blob(client),latest.source_locks.client_edge_after_blob_sha);
  assert.equal(meta.technical_source_locks.client_edge_version,106);
});

test('R5 source correction is ONLY a confirmed-observation line segmentation change',()=>{
  for(const phrase of [
    '2e008e1a13061963baa0ef5f956da381',
    'R5_SOURCE_LOCK_MISMATCH_ABORT',
    'as_of_date-prev_date>10',
    "((SELECT segment_count FROM agg)>1 OR EXISTS (SELECT 1 FROM ordered WHERE prev_date IS NOT NULL AND as_of_date-prev_date>1))",
    "AND f.as_of_date >= (now() at time zone 'Europe/Moscow')::date - 29",
    "'noInterpolation',true",
    'historyIncludesAllGapSegments'
  ])assert.ok(migration.includes(phrase),phrase);
  assert.ok(!/\b(DELETE\s+FROM|UPDATE\s+portal_private|INSERT\s+INTO|TRUNCATE\s+TABLE)\b/i.test(migration));
  assert.ok(!migration.includes('EXECUTE canonical')&&!migration.includes('DROP FUNCTION'));
  assert.ok(rollback.includes('5a0fdacc196efc889cb8c047f0164330'));
  assert.ok(rollback.includes('as_of_date-prev_date>1'));
  assert.ok(!rollback.includes('as_of_date-prev_date>10'));
});

test('real screenshot repro: original >1 rule incorrectly fragments DT and LPG',()=>{
  assert.deepEqual(geometry(sourceSamples.DT,1),{points:11,edges:6,segments:5,sourceGap:true});
  assert.deepEqual(geometry(sourceSamples.LPG,1),{points:12,edges:7,segments:5,sourceGap:true});
});

test('R5 correction: 11 and 12 verified dates remain, line edges 10 and 11',()=>{
  assert.deepEqual(geometry(sourceSamples.DT,10),{points:11,edges:10,segments:1,sourceGap:true});
  assert.deepEqual(geometry(sourceSamples.LPG,10),{points:12,edges:11,segments:1,sourceGap:true});
  for(const data of Object.values(sourceSamples)){
    assert.ok(data.every(d=>d>='2026-09-12'&&d<='2026-10-11'));
    assert.ok(data.every((d,i)=>i===0||d>data[i-1]));
    // A line between neighboring *source observations* does not add a
    // fabricated observation on an unobserved calendar day.
    assert.equal(new Set(data).size,data.length);
  }
});

test('existing Admin R4 chart draws only verified circle points and straight source edges',()=>{
  for(const phrase of [
    'function adminCompactChart(root,product,key)',
    'if(Number(ids[i])!==Number(ids[i-1]))continue',
    "p.setAttribute('aria-label',label)",
    "root.dataset.ronaGapInterpolation='OFF'",
    "svg.dataset.ronaAdminSingleOwner='20261010-admin-r3-exclusive-chart-owner-r4'",
    "svg.querySelectorAll('path.rmc-area,path.rmc-line-depth,path.rmc-line-glow,path.rmc-line').forEach(n=>n.remove())"
  ])assert.ok(admin.includes(phrase),phrase);
  assert.ok(read('scripts/qa-admin-analytics-r5-connected-30d-browser.mjs').includes("target-1"));
});

test('long source outage still breaks the line while normal weekends remain joinable',()=>{
  const x=['2026-09-12','2026-09-15','2026-09-27','2026-09-28'];
  assert.deepEqual(geometry(x,10),{points:4,edges:2,segments:2,sourceGap:true});
  assert.equal(geometry(['2026-10-01','2026-10-02','2026-10-05'],10).edges,2);
});
