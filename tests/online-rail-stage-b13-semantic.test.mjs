import test from 'node:test';
import assert from 'node:assert/strict';

function evaluateCurrentAndAudit(candidates){
  const trusted=candidates.filter(x=>x.positionStatus==='TRUSTED');
  if(trusted.length===0){
    return {current:null,audit:[...candidates]};
  }

  const domains=new Set(trusted.map(x=>x.domain));
  if(domains.size>1){
    return {
      current:{
        deal:trusted[0].deal,
        wagon:trusted[0].wagon,
        positionStatus:'CROSS_DOMAIN_AMBIGUOUS',
        station:null,
        operation:null,
        eventId:null,
        document:null,
      },
      audit:[...candidates],
    };
  }

  const chosen=[...trusted].sort((a,b)=>b.order.localeCompare(a.order))[0];
  return {
    current:{
      deal:chosen.deal,
      wagon:chosen.wagon,
      positionStatus:'TRUSTED',
      station:chosen.station,
      operation:chosen.operation,
      eventId:chosen.id,
      document:chosen.doc,
    },
    audit:candidates.filter(x=>x.id!==chosen.id),
  };
}

function correctionAllowed(oldEvent,newEvent,existingSuccessor=null){
  if(oldEvent.id===newEvent.id)return false;
  if(oldEvent.wagon!==newEvent.wagon)return false;
  if(!oldEvent.deal || oldEvent.deal!==newEvent.deal)return false;
  if(!oldEvent.doc || oldEvent.doc!==newEvent.doc)return false;
  if(existingSuccessor && existingSuccessor!==newEvent.id)return false;
  if(!newEvent.provenance)return false;
  return true;
}

const allowedResolutionAuthorities=new Set([
  'OWNER_EXPLICIT_INSTRUCTION',
  'RAIL_LOGISTICS_VERIFIED_DECISION',
]);
const allowedCorrectionAuthorities=new Set([
  'OWNER_EXPLICIT_CORRECTION',
  'RAIL_LOGISTICS_VERIFIED_EXPEDITOR_CORRECTION',
]);

test('B1.5 scenario 1: TRUSTED A + TO_VERIFY B keeps TRUSTED A current and B in audit',()=>{
  const rows=[
    {id:'trusted-a',deal:'D',wagon:'99000001',doc:'DOC-A',domain:'LOCAL:A',order:'2026-09-18T04:51:00',positionStatus:'TRUSTED',station:'Анисовка',operation:'V0057'},
    {id:'pending-b',deal:'D',wagon:'99000001',doc:'DOC-B',domain:'LOCAL:B',order:'2026-09-19T04:51:00',positionStatus:'TO_VERIFY',station:'Могилев I',operation:'P0005'},
  ];
  const result=evaluateCurrentAndAudit(rows);
  assert.equal(result.current.positionStatus,'TRUSTED');
  assert.equal(result.current.eventId,'trusted-a');
  assert.equal(result.current.station,'Анисовка');
  assert.notEqual(result.current.positionStatus,'CROSS_DOMAIN_AMBIGUOUS');
  assert.deepEqual(result.audit.map(x=>x.id),['pending-b']);
});

test('B1.5 scenario 2: TRUSTED A + TRUSTED B across domains is CROSS_DOMAIN_AMBIGUOUS',()=>{
  const rows=[
    {id:'trusted-a',deal:'D',wagon:'99000002',doc:'DOC-A',domain:'LOCAL:A',order:'2026-09-18T04:51:00',positionStatus:'TRUSTED',station:'Анисовка',operation:'V0057'},
    {id:'trusted-b',deal:'D',wagon:'99000002',doc:'DOC-B',domain:'UTC',order:'2026-09-18T02:00:00Z',positionStatus:'TRUSTED',station:'Могилев I',operation:'P0005'},
  ];
  const result=evaluateCurrentAndAudit(rows);
  assert.equal(result.current.positionStatus,'CROSS_DOMAIN_AMBIGUOUS');
  assert.equal(result.current.station,null);
  assert.equal(result.current.operation,null);
  assert.equal(result.current.eventId,null);
  assert.equal(result.current.document,null);
  assert.equal(result.audit.length,2);
});

test('B1.5 scenario 3: TO_VERIFY A + UNRESOLVED B has no trusted current and both remain audit',()=>{
  const rows=[
    {id:'pending-a',deal:'D',wagon:'99000003',doc:'DOC-A',domain:'LOCAL:A',order:'2026-09-18T04:51:00',positionStatus:'TO_VERIFY',station:'Анисовка',operation:'V0057'},
    {id:'unresolved-b',deal:'D',wagon:'99000003',doc:'DOC-B',domain:'LOCAL:B',order:'2026-09-19T04:51:00',positionStatus:'UNRESOLVED',station:'Могилев I',operation:'P0005'},
  ];
  const result=evaluateCurrentAndAudit(rows);
  assert.equal(result.current,null);
  assert.deepEqual(result.audit.map(x=>x.id),['pending-a','unresolved-b']);
});

test('same station in two TRUSTED domains is still CROSS_DOMAIN_AMBIGUOUS',()=>{
  const rows=[
    {id:'a',deal:'D',wagon:'99000004',doc:'DOC-A',domain:'LOCAL:FILE-A',order:'2026-09-18T04:51:00',positionStatus:'TRUSTED',station:'Анисовка',operation:'V0057'},
    {id:'b',deal:'D',wagon:'99000004',doc:'DOC-A',domain:'LOCAL:FILE-B',order:'2026-09-18T04:51:00',positionStatus:'TRUSTED',station:'Анисовка',operation:'V0057'},
  ];
  const result=evaluateCurrentAndAudit(rows);
  assert.equal(result.current.positionStatus,'CROSS_DOMAIN_AMBIGUOUS');
  assert.equal(result.current.station,null);
});

test('single TRUSTED domain across active documents produces one comparable current result and retains non-current trusted audit',()=>{
  const rows=[
    {id:'older',deal:'D',wagon:'99000005',doc:'A',domain:'UTC',order:'2026-09-18T01:00:00Z',positionStatus:'TRUSTED',station:'S1',operation:'P1'},
    {id:'newer',deal:'D',wagon:'99000005',doc:'B',domain:'UTC',order:'2026-09-18T02:00:00Z',positionStatus:'TRUSTED',station:'S2',operation:'P2'},
  ];
  const result=evaluateCurrentAndAudit(rows);
  assert.equal(result.current.positionStatus,'TRUSTED');
  assert.equal(result.current.eventId,'newer');
  assert.equal(result.current.station,'S2');
  assert.deepEqual(result.audit.map(x=>x.id),['older']);
});

test('correction scope requires same wagon, effective Deal and effective rail document',()=>{
  const oldEvent={id:'old',wagon:'99000006',deal:'D',doc:'DOC-1',provenance:true};
  assert.equal(correctionAllowed(oldEvent,{id:'new',wagon:'99000006',deal:'D',doc:'DOC-1',provenance:true}),true);
  assert.equal(correctionAllowed(oldEvent,{id:'new',wagon:'99000007',deal:'D',doc:'DOC-1',provenance:true}),false);
  assert.equal(correctionAllowed(oldEvent,{id:'new',wagon:'99000006',deal:'D2',doc:'DOC-1',provenance:true}),false);
  assert.equal(correctionAllowed(oldEvent,{id:'new',wagon:'99000006',deal:'D',doc:'DOC-2',provenance:true}),false);
});

test('correction may change event identity/time-domain but cannot fork an already superseded event',()=>{
  const oldEvent={id:'old',wagon:'99000008',deal:'D',doc:'DOC-1',domain:'LOCAL:A',eventIdentity:'A',provenance:true};
  const newEvent={id:'new',wagon:'99000008',deal:'D',doc:'DOC-1',domain:'LOCAL:B',eventIdentity:'B',provenance:true};
  assert.equal(correctionAllowed(oldEvent,newEvent),true);
  assert.equal(correctionAllowed(oldEvent,newEvent,'another-new'),false);
});

test('business authority values are closed sets; service_role and SYSTEM_ADMIN are not authorities',()=>{
  assert.equal(allowedResolutionAuthorities.has('OWNER_EXPLICIT_INSTRUCTION'),true);
  assert.equal(allowedResolutionAuthorities.has('RAIL_LOGISTICS_VERIFIED_DECISION'),true);
  assert.equal(allowedCorrectionAuthorities.has('OWNER_EXPLICIT_CORRECTION'),true);
  assert.equal(allowedCorrectionAuthorities.has('RAIL_LOGISTICS_VERIFIED_EXPEDITOR_CORRECTION'),true);
  assert.equal(allowedResolutionAuthorities.has('service_role'),false);
  assert.equal(allowedResolutionAuthorities.has('SYSTEM_ADMIN'),false);
  assert.equal(allowedCorrectionAuthorities.has('service_role'),false);
  assert.equal(allowedCorrectionAuthorities.has('SYSTEM_ADMIN'),false);
});

test('only unambiguous TRUSTED current is grouping/projection eligible',()=>{
  const ambiguous={positionStatus:'CROSS_DOMAIN_AMBIGUOUS',station:null,domainCount:2};
  const trusted={positionStatus:'TRUSTED',station:'Анисовка',domainCount:1};
  const groupEligible=x=>x.positionStatus==='TRUSTED'&&x.station!==null;
  const projectionEligible=x=>x.positionStatus==='TRUSTED'&&x.domainCount===1;
  assert.equal(groupEligible(ambiguous),false);
  assert.equal(projectionEligible(ambiguous),false);
  assert.equal(groupEligible(trusted),true);
  assert.equal(projectionEligible(trusted),true);
});
