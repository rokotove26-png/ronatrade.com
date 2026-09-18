import test from 'node:test';
import assert from 'node:assert/strict';

function singleCurrent(candidates){
  const byWagon=new Map();
  for(const c of candidates){
    const key=`${c.deal}|${c.wagon}`;
    const list=byWagon.get(key) ?? [];
    list.push(c);
    byWagon.set(key,list);
  }

  return [...byWagon.values()].map(list=>{
    const domains=new Set(list.map(x=>x.domain));
    if(domains.size>1){
      return {
        deal:list[0].deal,
        wagon:list[0].wagon,
        positionStatus:'CROSS_DOMAIN_AMBIGUOUS',
        station:null,
        operation:null,
        candidates:list,
      };
    }
    const chosen=[...list].sort((a,b)=>b.order.localeCompare(a.order))[0];
    return {
      deal:chosen.deal,
      wagon:chosen.wagon,
      positionStatus:chosen.positionStatus,
      station:chosen.station,
      operation:chosen.operation,
      candidates:list,
    };
  });
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

test('single current returns one row and fails closed across incomparable domains',()=>{
  const rows=[
    {deal:'D',wagon:'99000001',doc:'A',domain:'LOCAL:FILE-A',order:'2026-09-18T04:51:00',positionStatus:'TRUSTED',station:'Анисовка',operation:'V0057'},
    {deal:'D',wagon:'99000001',doc:'B',domain:'UTC',order:'2026-09-18T02:00:00',positionStatus:'TRUSTED',station:'Анисовка',operation:'V0057'},
  ];
  const current=singleCurrent(rows);
  assert.equal(current.length,1);
  assert.equal(current[0].positionStatus,'CROSS_DOMAIN_AMBIGUOUS');
  assert.equal(current[0].station,null);
  assert.equal(current[0].operation,null);
  assert.equal(current[0].candidates.length,2);
});

test('same station in two domains is still CROSS_DOMAIN_AMBIGUOUS',()=>{
  const rows=[
    {deal:'D',wagon:'99000002',doc:'A',domain:'LOCAL:FILE-A',order:'2026-09-18T04:51:00',positionStatus:'TRUSTED',station:'Анисовка',operation:'V0057'},
    {deal:'D',wagon:'99000002',doc:'A',domain:'LOCAL:FILE-B',order:'2026-09-18T04:51:00',positionStatus:'TRUSTED',station:'Анисовка',operation:'V0057'},
  ];
  const current=singleCurrent(rows)[0];
  assert.equal(current.positionStatus,'CROSS_DOMAIN_AMBIGUOUS');
  assert.equal(current.station,null);
});

test('single domain across multiple active rail documents produces one comparable current result',()=>{
  const rows=[
    {deal:'D',wagon:'99000003',doc:'A',domain:'UTC',order:'2026-09-18T01:00:00Z',positionStatus:'TRUSTED',station:'S1',operation:'P1'},
    {deal:'D',wagon:'99000003',doc:'B',domain:'UTC',order:'2026-09-18T02:00:00Z',positionStatus:'TRUSTED',station:'S2',operation:'P2'},
  ];
  const current=singleCurrent(rows)[0];
  assert.equal(current.positionStatus,'TRUSTED');
  assert.equal(current.station,'S2');
  assert.equal(current.operation,'P2');
});

test('correction scope requires same wagon, effective Deal and effective rail document',()=>{
  const oldEvent={id:'old',wagon:'99000004',deal:'D',doc:'DOC-1',provenance:true};
  assert.equal(correctionAllowed(oldEvent,{id:'new',wagon:'99000004',deal:'D',doc:'DOC-1',provenance:true}),true);
  assert.equal(correctionAllowed(oldEvent,{id:'new',wagon:'99000005',deal:'D',doc:'DOC-1',provenance:true}),false);
  assert.equal(correctionAllowed(oldEvent,{id:'new',wagon:'99000004',deal:'D2',doc:'DOC-1',provenance:true}),false);
  assert.equal(correctionAllowed(oldEvent,{id:'new',wagon:'99000004',deal:'D',doc:'DOC-2',provenance:true}),false);
});

test('correction may change event identity/time-domain but cannot fork an already superseded event',()=>{
  const oldEvent={id:'old',wagon:'99000006',deal:'D',doc:'DOC-1',domain:'LOCAL:A',eventIdentity:'A',provenance:true};
  const newEvent={id:'new',wagon:'99000006',deal:'D',doc:'DOC-1',domain:'LOCAL:B',eventIdentity:'B',provenance:true};
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

test('ambiguous wagon is excluded from grouping and projection eligibility',()=>{
  const ambiguous={positionStatus:'CROSS_DOMAIN_AMBIGUOUS',station:null,domainCount:2};
  const trusted={positionStatus:'TRUSTED',station:'Анисовка',domainCount:1};
  const groupEligible=x=>x.positionStatus==='TRUSTED'&&x.station!==null;
  const projectionEligible=x=>x.positionStatus==='TRUSTED'&&x.domainCount===1;
  assert.equal(groupEligible(ambiguous),false);
  assert.equal(projectionEligible(ambiguous),false);
  assert.equal(groupEligible(trusted),true);
  assert.equal(projectionEligible(trusted),true);
});
