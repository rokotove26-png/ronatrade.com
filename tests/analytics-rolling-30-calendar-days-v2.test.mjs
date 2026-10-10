import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=(p)=>readFileSync(p,'utf8');
const blob=(s)=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const approval=JSON.parse(read('governance/analytics-rolling30-owner-approval-v2-20261011.json'));
const sql=read('supabase/migrations/20261011000000_analytics_rolling_30_calendar_days_v1.sql');
const edge=read('supabase/functions/rona-portal-api/client-market-intelligence-effective-client-v1.ts');

function actualDateHelpers(latestTradeDate,clockUtc){
  const begin=edge.indexOf('    const moscowParts = Object.fromEntries(');
  const end=edge.indexOf('    for (const key of ["AI92", "AI95", "DT", "LPG"])',begin);
  assert.ok(begin>0 && end>begin,'date predicate must come before client product projection');
  const section=edge.slice(begin,end).replaceAll(': string','').replaceAll(': boolean','');
  const FixedDate=class extends Date{
    constructor(...args){super(args.length?args[0]:Date.parse(clockUtc));}
    static now(){return Date.parse(clockUtc);}
  };
  const anchorIso=latestTradeDate.slice(6)+'-'+latestTradeDate.slice(3,5)+'-'+latestTradeDate.slice(0,2);
  return new Function('Date','source','text','anchorIso',
    section+'\nreturn {inLast30,shortDayInLast30,marketFloorMs,marketTodayMs};'
  )(FixedDate,{latestTradeDate},v=>String(v??'').trim(),anchorIso);
}

test('exact approved artifacts and unchanged Admin R4 / client V20 visuals',()=>{
  assert.equal(approval.approval,'OWNER_IN_CHAT');
  assert.equal(blob(sql),approval.source_locks.sql_migration_blob_sha);
  assert.equal(blob(edge),approval.source_locks.client_edge_after_blob_sha);
  assert.equal(blob(read('functions/portal/analytics-canonical-live-hydration.js')),
    'a7407d85d8cffca79a44a43465c211ca858d37a0');
  assert.equal(blob(read('functions/portal/api/v1/admin/analytics.js')),
    '7934b365c8586b423d25a761cb035fb52b74b7f0');
  const v20=JSON.parse(read('governance/client-analytics-buyer-facing-insight-v20-20261010.json'));
  for(const [path,v] of Object.entries(v20.exact_post_blobs))
    assert.equal(blob(read(path)),v.authorized_post_blob_sha,path);
});

test('two exact source-locked SQL-only function replacements and no data mutation',()=>{
  for(const s of [
    '8ad47e1c97b748017369e0cb870f4bda',
    'ae96b04c319334197eb9d81fcb84f09e',
    "((now() at time zone 'Europe/Moscow')::date - 29) as source_month",
    "((now() at time zone 'Europe/Moscow')::date - 29) as source_month",
    "AND f.as_of_date >= (now() at time zone 'Europe/Moscow')::date - 29",
    "as_of_date-prev_date>1",
    "and as_of_date between (now() at time zone 'Europe/Moscow')::date - 29",
    'ROLLING30_STATIC_SOURCE_LOCK_MISMATCH',
    'CREATE OR REPLACE FUNCTION portal_private.market_intelligence_daily_monitor_v1'
  ])assert.ok(sql.includes(s),s);
  assert.ok(!/\b(insert\s+into|update\s+portal_private|delete\s+from|truncate\s+table)\b/i.test(sql));
  assert.ok(!sql.includes('DROP FUNCTION'));
  assert.ok(!sql.includes('EXECUTE canonical'));
  assert.ok(!sql.includes('EXECUTE daily'));
});

test('gasoline client revalidates cross-month source rows using Moscow rolling range',()=>{
  assert.ok(edge.includes("(now() at time zone 'Europe/Moscow')::date - 29"));
  assert.ok(edge.includes("sd.source_family='PLATTS'"));
  assert.ok(edge.includes("sd.processing_state='INGESTED'"));
  assert.ok(edge.includes("verifiedGasolineRows.every("));
  assert.ok(edge.includes('dates.every((date: unknown) => shortDayInLast30(text(date)))'));
  assert.ok(edge.includes('observedDates.every((v: unknown) => inLast30(text(v)))'));
  assert.ok(edge.includes('(key === "AI92" || key === "AI95") &&'));
  assert.ok(edge.includes('if (output.forecast) output.forecast.reference = output.values.at(-1) ?? null;'));
  assert.ok(edge.includes('permissionToForecast(key)'));
  assert.ok(edge.includes('authorizedClientKeys(c)'));
});

test('last 30 days inclusive and 31st day excluded across September/October',()=>{
  const h=actualDateHelpers('08.10.2026','2026-10-10T23:01:00Z'); // Moscow October 11
  assert.equal(new Date(h.marketFloorMs).toISOString().slice(0,10),'2026-09-12');
  assert.equal(new Date(h.marketTodayMs).toISOString().slice(0,10),'2026-10-11');
  for(const d of ['2026-09-12','2026-10-08','2026-10-11'])
    assert.equal(h.inLast30(d),true,d);
  for(const d of ['2026-09-11','2026-08-28','2026-10-12','2026-02-30','not-a-date'])
    assert.equal(h.inLast30(d),false,d);
  assert.equal(h.shortDayInLast30('12.09'),true);
  assert.equal(h.shortDayInLast30('11.09'),false);
  assert.equal(h.shortDayInLast30('08.10'),true);
  assert.equal(h.shortDayInLast30('09.10'),false,'future of source anchor must not appear');
  assert.equal(h.shortDayInLast30('31.02'),false,'do not normalize invalid dates');
});

test('year boundary keeps real December, rejects stale December and future January',()=>{
  const h=actualDateHelpers('05.01.2027','2027-01-05T13:00:00Z');
  assert.equal(h.inLast30('2026-12-07'),true);
  assert.equal(h.inLast30('2026-12-06'),false);
  assert.equal(h.shortDayInLast30('31.12'),true);
  assert.equal(h.shortDayInLast30('06.12'),false);
  assert.equal(h.shortDayInLast30('05.01'),true);
  assert.equal(h.shortDayInLast30('06.01'),false);
});

test('leap day is a real observation date only when it exists',()=>{
  const h=actualDateHelpers('01.03.2028','2028-03-01T11:00:00Z');
  assert.equal(h.inLast30('2028-02-29'),true);
  assert.equal(h.shortDayInLast30('29.02'),true);
  assert.equal(h.shortDayInLast30('30.02'),false);
});

test('no unapproved daily fallback and no interpolation over missing dates',()=>{
  assert.ok(sql.includes("as_of_date-prev_date>1"));
  assert.ok(edge.includes('daily?.noInterpolation === true'));
  assert.ok(edge.includes('daily?.notMonthlyMaturityCurve === true'));
  assert.ok(edge.includes('observedDates.length === dailyDates.length'));
  assert.ok(edge.includes('const dailyApproved = (key === "DT" || key === "LPG")'));
  assert.ok(edge.includes('output.dates = dailyDates.map('));
  assert.ok(!edge.includes('Date.now() - 85*86400000'));
});
