import test from 'node:test';
import assert from 'node:assert/strict';

/*
  Architecture dry-run only. NO production write.
  8-digit wagon numbers below are explicit QA identifiers, not production facts.
  Reference business facts are source-locked separately and are not invented.
*/

const SHA='bc7429db2fbc411cb43607c54f87b824d4c8ad928353914c6e94c935870d5cc5';
const SHEET='дисл';
const DEAL='DEAL-2026-004';
const GU12='1308903120';
const DESTINATION='742705';
const DOMAIN=`EXPEDITOR_XLSX_FILE_SHA256:${SHA}:LOCAL_WALL_CLOCK_UNRESOLVED_V1`;

function canonicalRow({rowNumber,wagon,operation,rawTimestamp,stationCode,stationName}){
  return {
    schemaVersion:'RAIL_XLSX_SOURCE_ROW_V1',
    sheetName:SHEET,
    rowNumber,
    cells:[
      {columnIndex:1,header:'номер вагона',rawType:'STRING',rawValue:wagon},
      {columnIndex:2,header:'код операции',rawType:'STRING',rawValue:operation},
      {columnIndex:3,header:'дата операции',rawType:'STRING',rawValue:rawTimestamp},
      {columnIndex:4,header:'код станции совершения операции',rawType:'STRING',rawValue:stationCode},
      {columnIndex:5,header:'станция совершения операции',rawType:'STRING',rawValue:stationName},
      {columnIndex:6,header:'код станции назначения',rawType:'STRING',rawValue:DESTINATION},
      {columnIndex:7,header:'optional raw-only code',rawType:'NUMBER',rawValue:0},
    ],
  };
}

const rows=[
  ...Array.from({length:4},(_,i)=>({
    wagonNumber:String(99000001+i),
    station:'Анисовка',
    stationCode:'625501',
    operation:'V0057',
    rawTimestamp:'1809260451',
    eventAtLocal:'2026-09-18T04:51:00',
  })),
  ...Array.from({length:5},(_,i)=>({
    wagonNumber:String(99000005+i),
    station:'Могилев I',
    stationCode:'156505',
    operation:'P0005',
    rawTimestamp:'1709262012',
    eventAtLocal:'2026-09-17T20:12:00',
  })),
].map((r,index)=>({
  ...r,
  sourceFileSha256:SHA,
  sourceSheetName:SHEET,
  sourceRowNumber:index+2,
  sourceRow:canonicalRow({
    rowNumber:index+2,
    wagon:r.wagonNumber,
    operation:r.operation,
    rawTimestamp:r.rawTimestamp,
    stationCode:r.stationCode,
    stationName:r.station,
  }),
  destinationStationCode:DESTINATION,
  parsedEventAt:null,
  sourceTimezone:null,
  sourceTimezoneStatus:'UNRESOLVED',
  sourceTimeDomain:DOMAIN,
  initialResolution:'TO_VERIFY',
  dealId:DEAL,
  gu12Number:GU12,
}));

function latestWithinDomain(input){
  const by=new Map();
  for(const row of input){
    const key=[row.dealId,row.wagonNumber,row.sourceTimeDomain].join('|');
    const prev=by.get(key);
    if(!prev || row.eventAtLocal>prev.eventAtLocal)by.set(key,row);
  }
  return [...by.values()];
}

function duplicateShaGate(seen,sha){
  if(seen.has(sha))return 'DUPLICATE_FILE_SHA_BLOCKED';
  seen.add(sha);
  return 'ACCEPTED';
}

test('reference SHA/sheet/domain are fixed',()=>{
  assert.equal(SHA,'bc7429db2fbc411cb43607c54f87b824d4c8ad928353914c6e94c935870d5cc5');
  assert.equal(SHEET,'дисл');
  assert.equal(DOMAIN,`EXPEDITOR_XLSX_FILE_SHA256:${SHA}:LOCAL_WALL_CLOCK_UNRESOLVED_V1`);
});

test('reference case remains 9 rows / 9 wagons / 4 Anisovka + 5 Mogilev I',()=>{
  assert.equal(rows.length,9);
  assert.equal(new Set(rows.map(r=>r.wagonNumber)).size,9);
  assert.ok(rows.every(r=>/^[0-9]{8}$/.test(r.wagonNumber)));
  assert.equal(rows.filter(r=>r.station==='Анисовка'&&r.stationCode==='625501').length,4);
  assert.equal(rows.filter(r=>r.station==='Могилев I'&&r.stationCode==='156505').length,5);
  assert.ok(rows.every(r=>r.destinationStationCode==='742705'));
  assert.ok(rows.every(r=>r.dealId===DEAL&&r.gu12Number===GU12));
});

test('reference railway times stay local/unresolved and UTC stays null',()=>{
  assert.ok(rows.slice(0,4).every(r=>r.rawTimestamp==='1809260451'&&r.eventAtLocal==='2026-09-18T04:51:00'));
  assert.ok(rows.slice(4).every(r=>r.rawTimestamp==='1709262012'&&r.eventAtLocal==='2026-09-17T20:12:00'));
  assert.ok(rows.every(r=>r.sourceTimezoneStatus==='UNRESOLVED'));
  assert.ok(rows.every(r=>r.parsedEventAt===null));
  assert.ok(rows.every(r=>r.sourceTimeDomain===DOMAIN));
  assert.ok(rows.every(r=>r.initialResolution==='TO_VERIFY'));
});

test('canonical source row includes exact sheet+row locator and preserves raw numeric zero',()=>{
  for(const row of rows){
    assert.equal(row.sourceRow.schemaVersion,'RAIL_XLSX_SOURCE_ROW_V1');
    assert.equal(row.sourceRow.sheetName,SHEET);
    assert.equal(row.sourceRow.rowNumber,row.sourceRowNumber);
    assert.equal(row.sourceRow.cells.at(-1).rawValue,0);
    assert.equal(row.sourceRow.cells.at(-1).rawType,'NUMBER');
  }
});

test('no leading-zero reconstruction is performed by the reference fixture',()=>{
  const rawNumeric='1234567';
  assert.equal(rawNumeric.length,7);
  assert.notEqual(rawNumeric.padStart(8,'0'),rawNumeric);
  assert.equal(/^[0-9]{8}$/.test(rawNumeric),false);
});

test('reference rows remain available before timezone resolution',()=>{
  const latest=latestWithinDomain(rows);
  assert.equal(latest.length,9);
  assert.ok(latest.every(r=>r.initialResolution==='TO_VERIFY'));
  assert.ok(latest.every(r=>r.parsedEventAt===null));
  assert.ok(latest.every(r=>r.eventAtLocal));
});

test('duplicate-file SHA gate remains importer/import-batch responsibility',()=>{
  const seen=new Set();
  assert.equal(duplicateShaGate(seen,SHA),'ACCEPTED');
  assert.equal(duplicateShaGate(seen,SHA),'DUPLICATE_FILE_SHA_BLOCKED');
});

test('optional business codes remain RAW_ONLY; V0057/P0005 are not operational statuses',()=>{
  assert.ok(rows.every(r=>['V0057','P0005'].includes(r.operation)));
  assert.ok(rows.every(r=>!['REGISTERED','LOADED','IN_TRANSIT','ARRIVED','UNLOADED'].includes(r.operation)));
});
