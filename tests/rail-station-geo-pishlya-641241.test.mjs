import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(
  'supabase/migrations/20260922123500_rail_station_geo_pishlya_641241_v1.sql',
  'utf8'
);

test('Pishlya geo is keyed by ESR 641241, not by station-name similarity',()=>{
  assert.ok(migration.includes("'641241'"));
  assert.ok(migration.includes("'Пишля'"));
  assert.ok(migration.includes("'identityBasis','ESR_CODE'"));
  assert.ok(migration.includes("'stationNameAuthority','DISPLAY_ONLY'"));
  assert.doesNotMatch(migration,/where\s+.*station_name\s*=|where\s+.*station_name\s+like/i);
});

test('known truncated and normalized labels are display aliases only',()=>{
  for(const marker of ["'Пишля (об'","'Пишля (обп)'","'обгонный пункт Пишля'"]) {
    assert.ok(migration.includes(marker),marker);
  }
});

test('production QA requires all 9 current wagons to be geocoded in exactly two station groups',()=>{
  for(const marker of [
    'v_total<>9',
    'v_geocoded<>9',
    'v_pishlya<>5',
    'v_kazaly<>4',
    'v_group_count<>2'
  ]) assert.ok(migration.includes(marker),marker);
});
