import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { onRequest as railCurrent } from '../functions/portal/rail-current-v81-maplibre-ui.js';

const response = await railCurrent({});
assert.equal(response.status, 200, await response.clone().text());
const source = await response.text();

function generatedFunction(name) {
  const line = source.split('\n').find((part) => part.startsWith(`function ${name}(`));
  assert.ok(line, `${name} is present in the rendered Admin and Client map`);
  return line;
}

const sandbox = {
  ensureRailRealMapStyle() {},
  el(tag, className, text) {
    return {
      tag, className, text, textContent: text || '', children: [], title: '',
      append(...children) { for (const child of children) child.parentNode = this; this.children.push(...children); },
      querySelector(selector) { return this.children.find((child) => `.${child.className}` === selector) || null; },
      remove() { this.parentNode.children = this.parentNode.children.filter((child) => child !== this); },
      setAttribute(name, value) { this[name] = value; },
    };
  },
  pill(text, kind) { return { text, kind }; },
  setTimeout() {},
};

const { railMapCoord, railMapMissingGeoSummary, mapPanel } = vm.runInNewContext(
  [
    generatedFunction('railMapFinite'),
    generatedFunction('railMapCoord'),
    generatedFunction('railMapMissingGeoSummary'),
    generatedFunction('mapPanel'),
    '({railMapCoord,railMapMissingGeoSummary,mapPanel})',
  ].join('\n'),
  sandbox,
);

const currentPositions = [
  ...['50810837', '50821149', '50853928', '58170051', '58227752'].map((wagonNumber) => ({
    wagonNumber,
    station: 'Арыс I',
    stationCode: '698004',
    coordinates: { lat: 42.417985, lng: 68.793848 },
  })),
  ...['58214776', '58253568', '76626902', '78249349'].map((wagonNumber) => ({
    wagonNumber,
    station: 'Сарыагаш',
    stationCode: '698305',
    coordinates: null,
  })),
];

test('reproduces the current Admin mismatch: nine table positions but only five mappable wagons', () => {
  assert.equal(currentPositions.length, 9);
  assert.equal(currentPositions.filter(railMapCoord).length, 5);
  const missing = railMapMissingGeoSummary(currentPositions);
  assert.equal(missing.count, 4);
  assert.equal(missing.label, '4 вагона без подтверждённой геопозиции');
  assert.match(missing.details, /Сарыагаш \(698305\): 58214776/);
});

test('confirmed Saryagash station GEO makes all nine current wagons mappable in the same snapshot', () => {
  const geocoded = currentPositions.map((wagon) => wagon.stationCode === '698305'
    ? { ...wagon, coordinates: { lat: 41.466347, lng: 69.147477 } }
    : wagon);

  assert.equal(geocoded.filter(railMapCoord).length, 9);
  assert.equal(new Set(geocoded.map((wagon) => wagon.stationCode)).size, 2);
  assert.equal(railMapMissingGeoSummary(geocoded).count, 0);

  const panel = mapPanel({}, geocoded, { mapData: { wagonPositions: geocoded } });
  assert.equal(panel.children.some((child) => child.className === 'rona-rail-v7-geo-missing'), false);
});

test('migration source-locks ESR 698305 to corroborated station coordinates', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migrations/20260928140000_rail_station_geo_saryagash_698305_v1.sql', import.meta.url),
    'utf8',
  );

  assert.match(migration, /'698305', 'Сарыагаш'/);
  assert.match(migration, /41\.466347, 69\.147477/);
  assert.match(migration, /https:\/\/www\.alta\.ru\/railway\/station\/69830\//);
  assert.match(migration, /https:\/\/railwayz\.info\/photolines\/station\/21583/);
  assert.match(migration, /RAIL_SARYAGASH_698305_GEO_SOURCE_CONFLICT/);
});
