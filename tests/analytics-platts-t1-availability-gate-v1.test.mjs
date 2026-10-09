import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync('supabase/migrations/20261009133000_analytics_platts_t1_availability_gate_v1.sql','utf8');
const rollback=readFileSync('supabase/rollbacks/20261009133000_analytics_platts_t1_availability_gate_v1_rollback.sql','utf8');
const BUSINESS_TIMEZONE='Europe/Moscow';
function sourceDate(instant){
  const d=new Date(instant);
  const local=new Intl.DateTimeFormat('en-CA',{timeZone:BUSINESS_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
  const part=k=>local.find(x=>x.type===k)?.value;
  const date=part('year')+'-'+part('month')+'-'+part('day');
  const day=new Date(date+'T12:00:00Z');
  const isodow=((day.getUTCDay()+6)%7)+1;
  const subtract=(day,num)=>{const out=new Date(day);out.setUTCDate(out.getUTCDate()-num);return out};
  const prior=isodow===1?subtract(day,3):isodow===6?subtract(day,1):isodow===7?subtract(day,2):subtract(day,1);
  let expected=prior;
  if(isodow>=2&&isodow<=5&&Number(part('hour'))*60+Number(part('minute'))<15*60){
    const priorWeekday=((prior.getUTCDay()+6)%7)+1;
    expected=subtract(prior,priorWeekday===1?3:1);
  }
  return expected.toISOString().slice(0,10);
}
test('source-locked migration preserves canonical publisher and source authority',()=>{
  assert.match(migration,/CREATE OR REPLACE FUNCTION portal_private\.refresh_market_intelligence_analytics_core_v1\(/);
  assert.match(migration,/portal_private\.platts_expected_source_day_v1\(now\(\)\)/);
  assert.match(migration,/data_status='CONFIRMED' and processing_state='INGESTED'/);
  assert.match(migration,/p\.audience/i);
  assert.match(migration,/v_m\.latest_date<v_expected_platts/);
  assert.match(migration,/v_item_freshness/);
  assert.match(migration,/APPROVED_WITH_CONDITIONS/);
  assert.match(migration,/do not apply until confirmed derived-content licensing/);
  assert.match(rollback,/DROP FUNCTION IF EXISTS portal_private\.platts_expected_source_day_v1/);
  assert.match(rollback,/v_expected_platts := case extract\(isodow/);
});
const cases=[
  ['2026-10-09T11:59:00Z','2026-10-07'], // Friday 14:59 Moscow
  ['2026-10-09T12:00:00Z','2026-10-08'], // Friday 15:00
  ['2026-10-09T12:01:00Z','2026-10-08'],
  ['2026-10-10T11:59:00Z','2026-10-09'], // Saturday no early exception
  ['2026-10-11T11:59:00Z','2026-10-09'], // Sunday no early exception
  ['2026-10-12T11:59:00Z','2026-10-09'], // Monday no early exception
  ['2026-10-13T11:59:00Z','2026-10-09'],
  ['2026-10-13T12:00:00Z','2026-10-12']
];
for(const [at,expected] of cases)test('T+1 expected confirmed trade date at '+at,()=>assert.equal(sourceDate(at),expected));
test('cutoff algorithm is source-independent, not a quote synthesizer',()=>{
  assert.match(migration,/last_regular_business_day/);
  assert.match(migration,/local_time < TIME '15:00'/);
  assert.doesNotMatch(migration,/INSERT\s+INTO\s+portal_private\.market_intelligence_facts/i);
  assert.doesNotMatch(migration,/UPDATE\s+portal_private\.market_intelligence_facts/i);
});
