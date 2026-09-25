import test from 'node:test';
import assert from 'node:assert/strict';
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
      tag, className, text, children: [], title: '',
      append(...children) { for (const child of children) child.parentNode = this; this.children.push(...children); },
      querySelector(selector) { return this.children.find((child) => `.${child.className}` === selector) || null; },
      remove() { this.parentNode.children = this.parentNode.children.filter((child) => child !== this); },
      setAttribute(name, value) { this[name] = value; },
    };
  },
  pill(text, kind) { return { text, kind }; },
  setTimeout() {},
};
const { railMapCoord, railMapMissingGeoSummary, railMapSyncMissingGeoNotice, mapPanel } = vm.runInNewContext(
  [
    generatedFunction('railMapFinite'),
    generatedFunction('railMapCoord'),
    generatedFunction('railMapMissingGeoSummary'),
    generatedFunction('railMapSyncMissingGeoNotice'),
    generatedFunction('mapPanel'),
    '({railMapCoord,railMapMissingGeoSummary,railMapSyncMissingGeoNotice,mapPanel})',
  ].join('\n'), sandbox,
);

const wagons = [
  ...['50810837', '50821149', '50853928', '58170051', '58227752'].map((wagonNumber) => ({
    wagonNumber, station: 'Илецк I', stationCode: '666906',
    coordinates: { lat: 51.171194, lng: 54.985952 },
  })),
  ...['58214776', '58253568', '76626902', '78249349'].map((wagonNumber) => ({
    wagonNumber, station: 'Жылга', stationCode: '699900', coordinates: null,
  })),
];

test('nine positions retain a visible count when four station coordinates are absent', () => {
  assert.equal(wagons.length, 9);
  assert.equal(wagons.filter(railMapCoord).length, 5);
  const missing = railMapMissingGeoSummary(wagons);
  assert.equal(missing.count, 4);
  assert.equal(missing.label, '4 вагона без подтверждённой геопозиции');
  assert.match(missing.details, /Жылга \(699900\): 58214776/);

  const panel = mapPanel({}, wagons, { mapData: { wagonPositions: wagons } });
  const notice = panel.children.find((child) => child.className === 'rona-rail-v7-geo-missing');
  assert.equal(notice.text, missing.label);
  assert.equal(notice.role, 'status');
  assert.match(source, /\.rona-rail-v7-real \.rona-rail-v7-geo-missing\{position:absolute;z-index:9/);
});

test('confirmed station GEO produces two clusters and removes the missing-geo notice', () => {
  const geocoded = wagons.map((wagon) => wagon.stationCode === '699900'
    ? { ...wagon, coordinates: { lat: 41.721370697021, lng: 69.017505 } }
    : wagon);
  assert.equal(geocoded.length, 9);
  assert.equal(geocoded.filter(railMapCoord).length, 9);
  assert.equal(new Set(geocoded.map((wagon) => wagon.stationCode)).size, 2);
  assert.equal(railMapMissingGeoSummary(geocoded).count, 0);
  const panel = mapPanel({}, geocoded, { mapData: { wagonPositions: geocoded } });
  assert.equal(panel.children.some((child) => child.className === 'rona-rail-v7-geo-missing'), false);
});

test('explicit null or empty latitude and longitude cannot become a false 0,0 marker', () => {
  assert.equal(railMapCoord({ coordinates: { lat: null, lng: null } }), null);
  assert.equal(railMapCoord({ coordinates: { lat: '', lng: ' ' } }), null);
  assert.equal(railMapMissingGeoSummary([{ coordinates: { lat: null, lng: null } }]).count, 1);
});

test('Client map redraw updates the missing count when an asynchronous projection changes', () => {
  const geocoded = wagons.map((wagon) => wagon.stationCode === '699900'
    ? { ...wagon, coordinates: { lat: 41.721370697021, lng: 69.017505 } }
    : wagon);
  const panel = mapPanel({}, geocoded, { mapData: { wagonPositions: geocoded } });
  const canvas = panel.children.find((child) => child.className === 'rona-rail-v4-map-canvas');
  assert.equal(panel.querySelector('.rona-rail-v7-geo-missing'), null);

  const state = { canvas, wagons };
  railMapSyncMissingGeoNotice(state);
  assert.equal(panel.querySelector('.rona-rail-v7-geo-missing').textContent,
    '4 вагона без подтверждённой геопозиции');
  state.wagons = geocoded;
  railMapSyncMissingGeoNotice(state);
  assert.equal(panel.querySelector('.rona-rail-v7-geo-missing'), null);
  assert.match(source, /state=\{canvas:canvas,viewport:viewport/);
  assert.match(generatedFunction('railMapDraw'), /railMapSyncMissingGeoNotice\(state\)/);
});
