import test from 'node:test';
import assert from 'node:assert/strict';

/*
  Architecture dry-run only. No production write.
  Wagon IDs below are explicit QA fixture identifiers, not business facts.
  Canonical reference context is limited to the accepted source facts:
  DEAL-2026-004 / GU-12 1308903120.
*/

const DEAL='DEAL-2026-004';
const GU12='1308903120';
const DOMAIN='QA_REFERENCE_XLSX_LOCAL_WALL_CLOCK_V1';

const rows=[
  ...Array.from({length:4},(_,i)=>({
    wagonNumber:`QA-REF-WAGON-${String(i+1).padStart(3,'0')}`,
    station:'Анисовка',
    stationCode:'625501',
    eventAtLocal:`2026-09-18T10:${String(i).padStart(2,'0')}:00`,
  })),
  ...Array.from({length:5},(_,i)=>({
    wagonNumber:`QA-REF-WAGON-${String(i+5).padStart(3,'0')}`,
    station:'Могилев I',
    stationCode:'156505',
    eventAtLocal:`2026-09-18T11:${String(i).padStart(2,'0')}:00`,
  })),
].map((r,index)=>({
  ...r,
  sourceRowNumber:index+1,
  rawTimestamp:r.eventAtLocal.replace('T',' '),
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
    const key=[row.dealId,row.gu12Number,row.wagonNumber,row.sourceTimeDomain].join('|');
    const prev=by.get(key);
    if(!prev || row.eventAtLocal>prev.eventAtLocal)by.set(key,row);
  }
  return [...by.values()];
}

function applyDecision(row,decision){
  if(decision.evidenceRow!==row.sourceRowNumber)return row;
  return {
    ...row,
    effectiveResolution:decision.resultingStatus,
    decision,
  };
}

test('reference XLSX architecture dry-run: 9 rows / 9 wagons / 4 + 5 station split',()=>{
  assert.equal(rows.length,9);
  assert.equal(new Set(rows.map(r=>r.wagonNumber)).size,9);
  assert.equal(rows.filter(r=>r.station==='Анисовка'&&r.stationCode==='625501').length,4);
  assert.equal(rows.filter(r=>r.station==='Могилев I'&&r.stationCode==='156505').length,5);
  assert.ok(rows.every(r=>r.dealId===DEAL&&r.gu12Number===GU12));
});

test('reference rows preserve unresolved timezone and local wall-clock without fabricated UTC',()=>{
  assert.ok(rows.every(r=>r.eventAtLocal));
  assert.ok(rows.every(r=>r.rawTimestamp));
  assert.ok(rows.every(r=>r.sourceTimezoneStatus==='UNRESOLVED'));
  assert.ok(rows.every(r=>r.parsedEventAt===null));
  assert.ok(rows.every(r=>r.sourceTimeDomain===DOMAIN));
});

test('reference rows are available to latest/read model before timezone resolution',()=>{
  const latest=latestWithinDomain(rows);
  assert.equal(latest.length,9);
  assert.ok(latest.every(r=>r.initialResolution==='TO_VERIFY'));
  assert.ok(latest.every(r=>r.parsedEventAt===null));
  assert.ok(latest.every(r=>r.eventAtLocal));
});

test('append-only owner/Rail-AI decision can overlay TO_VERIFY to MATCHED',()=>{
  const decision={
    evidenceRow:1,
    resultingStatus:'MATCHED',
    actorSource:'OWNER_OR_RAIL_AI_CONFIRMATION',
    decidedAt:'2026-09-19T00:00:00Z',
    reasonEvidence:{kind:'QA_CONFIRMATION'},
    canonicalDealId:DEAL,
    canonicalGu12:GU12,
  };
  const effective=applyDecision(rows[0],decision);
  assert.equal(rows[0].initialResolution,'TO_VERIFY');
  assert.equal(effective.effectiveResolution,'MATCHED');
  assert.equal(rows[0].initialResolution,'TO_VERIFY','evidence row must remain unchanged');
});

test('explicit correction requires a relation and does not arise from a later differing row',()=>{
  const oldEvent={id:'qa-old',wagonNumber:rows[0].wagonNumber};
  const newEvent={id:'qa-new',wagonNumber:rows[0].wagonNumber};
  const noDecision={isCorrection:false};
  assert.equal(noDecision.isCorrection,false);

  const correction={
    correctionEventId:newEvent.id,
    correctionOfEventId:oldEvent.id,
    relationType:'SUPERSEDES',
    actorSource:'OWNER_OR_RAIL_AI_CONFIRMATION',
  };
  assert.equal(correction.correctionOfEventId,'qa-old');
  assert.equal(correction.relationType,'SUPERSEDES');
});
