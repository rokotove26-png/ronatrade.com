import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../../functions/portal/deals-current-state-ui.js';

async function runtime(){
  const response=await onRequest();
  const script=await response.text();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-rona-deals-basis'),'owner-approved-basis-provenance-v2');
  new Function(script);
  return script;
}

test('Deals never presents a published station basis as verified final destination without a signed deal addendum',async()=>{
  const script=await runtime();
  assert.match(script,/function basisReferenceNeedsApproval\(d\)/);
  assert.match(script,/function basisText\(d\)\{if\(basisReferenceNeedsApproval\(d\)\)return'Базис уточняется'/);
  assert.match(script,/По прайсу: /);
  assert.match(script,/назначение: /);
  assert.doesNotMatch(script,/DEAL-2026-01[2-6]/);
  assert.match(script,/d\.delivery_basis_owner_confirmed===true/);
});

test('Basis source predicate is generic, respects business status and signed-document evidence',async()=>{
  const script=await runtime();
  const m=script.match(/function basisReferenceNeedsApproval\(d\)[\s\S]*?\}function basisCell\(d\)/);
  assert.ok(m,'basis review predicate must be in generated runtime');
  const source=m[0].slice(0,-'function basisCell(d)'.length);
  const docs=new Map();
  const predicate=new Function('docsFor',source+';return basisReferenceNeedsApproval;')(id=>docs.get(id)||[]);
  const base={deal_id:'DEAL-X',business_status:'REGISTERED',delivery_basis:'CPT Сарыагаш',destination:'Узбекистан / Хамза'};
  assert.equal(predicate(base),true,'unconfirmed reference and delivery station differ');
  assert.equal(predicate({...base,delivery_basis_owner_confirmed:true}),false,'explicit Owner basis confirmation overrides destination-only inference');
  assert.equal(predicate({...base,delivery_basis_owner_confirmed:false}),true,'unconfirmed source must still display review');
  assert.equal(predicate({...base,destination:'Сарыагаш'}),false,'same named destination, no basis mismatch');
  assert.equal(predicate({...base,business_status:'EXECUTING'}),false,'do not relabel executing deals');
  docs.set('DEAL-X',[{document_kind:'SIGNED_ADDENDUM'}]);
  assert.equal(predicate(base),false,'signed deal-specific terms override provisional price-list reference');
  docs.clear();
  assert.equal(predicate({...base,delivery_basis:''}),false,'empty basis retains existing missing-basis warning');
  assert.equal(predicate({...base,delivery_basis:'DAP ст. Хамза, Incoterms 2020',destination:'Хамза'}),false);
});

test('Canonical Deals read source and previous navigation invalidation stay in force',async()=>{
  const script=await runtime();
  assert.match(script,/api\('\/admin\/deals-current-v4'\)/);
  assert.match(script,/NAVIGATION_INVALIDATED_NO_INTERVAL_V2/);
  assert.match(script,/__RONA_DEALS_CURRENT_PENDING_INVALIDATION__/);
  assert.match(script,/post_rail_completion_attention/);
});

test('V3/V4 read model reports source mode and matching owner approval, not a hardcoded Deal ID',()=>{
 const fs=requireNodeFile();
 assert.match(fs,/a\.source_price_mode/);
 assert.match(fs,/as delivery_basis_owner_confirmed/);
 assert.match(fs,/ba\.evidence->>''approved_basis''=a\.delivery_basis/);
 assert.match(fs,/nullif\(ba\.evidence->>''owner_directive_source''/);
 assert.doesNotMatch(fs,/DEAL-2026-01[2-6]/);
});

function requireNodeFile(){
 return readFileSync(new URL('../../supabase/migrations/20261019193100_owner_deal_basis_provenance_projection_v1.sql',import.meta.url),'utf8');
}
