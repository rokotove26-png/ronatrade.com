import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {certifiedAgentTerms} from '../supabase/functions/rona-agent-reward-workflow/generic-agent-terms.ts';
import {approvedActIssue} from '../supabase/functions/rona-agent-reward-workflow/acts.ts';

const make=(mode,amount,overrides={})=>({
 term:{document_reference:'ДС № 4 от 15.07.2026',commission_mode:mode,
   commission_rate:0.25,commission_fixed_amount:400,currency:'USD',...(overrides.term||{})},
 finance:{approvedAgentShare:0.25,approvedBasisType:'NET_PROFIT',
   approvedBasisAmount:2000,approvedBasisCurrency:'USD',
   approvedBasisSourceRef:'FINANCE_NET_PROFIT_VERIFIED',
   approvedQuantityTonnes:100,approvedQuantitySourceRef:'VERIFIED_FACTORY_QUANTITY',
   ...(overrides.finance||{})},
 legal:{facsimileApproved:true,...(overrides.legal||{})},currency:'USD',amount
});
const code=error=>new RegExp(error);
test('Certified FIXED, PER_TONNE, and PERCENT modes use actual authoritative terms',()=>{
 const fixed=certifiedAgentTerms(make('FIXED',400));
 assert.equal(fixed.mode,'FIXED');assert.equal(fixed.approvedAmount,400);
 const tonne=certifiedAgentTerms(make('PER_TONNE',650,{term:{commission_rate:6.5}}));
 assert.equal(tonne.quantity,100);assert.equal(tonne.approvedAmount,650);
 const pct=certifiedAgentTerms(make('PERCENT',500));
 assert.equal(pct.rate,0.25);assert.equal(pct.basisAmount,2000);
 assert.equal(pct.sourceRef,'FINANCE_NET_PROFIT_VERIFIED');
});
test('Certified source guards reject forged terms, unsupported basis, and absent Finance/Legal FX evidence',()=>{
 assert.throws(()=>certifiedAgentTerms(make('FIXED',450)),code('ACT_CERTIFIED_AMOUNT_TERM_MISMATCH'));
 assert.throws(()=>certifiedAgentTerms(make('PER_TONNE',650,{
   term:{commission_rate:6.5},finance:{approvedQuantitySourceRef:null}
 })),code('ACT_CERTIFIED_QUANTITY_SOURCE_REQUIRED'));
 assert.throws(()=>certifiedAgentTerms(make('PERCENT',500,{
   finance:{approvedAgentShare:0.3}
 })),code('ACT_CERTIFIED_PERCENT_TERM_MISMATCH'));
 assert.throws(()=>certifiedAgentTerms(make('PERCENT',500,{
   finance:{approvedBasisSourceRef:null}
 })),code('ACT_CERTIFIED_BASIS_SOURCE_REQUIRED'));
 assert.throws(()=>certifiedAgentTerms(make('PERCENT',500,{
   finance:{approvedBasisAmount:-2000}
 })),code('ACT_CERTIFIED_NEGATIVE_BASIS_POLICY_REQUIRED'));
 assert.throws(()=>certifiedAgentTerms(make('PERCENT',550,{
   finance:{approvedBasisCurrency:'EUR',approvedActConversionRate:1.1,
     approvedActConversionSourceRef:null}
 })),code('ACT_CERTIFIED_FX_SOURCE_REQUIRED'));
 assert.throws(()=>certifiedAgentTerms(make('PERCENT',550,{
   finance:{approvedBasisCurrency:'EUR',approvedActConversionRate:1.1,
     approvedActConversionSourceRef:'CENTRAL_BANK_RATE'}
 })),code('ACT_CERTIFIED_FX_LEGAL_APPROVAL_REQUIRED'));
 const fx=certifiedAgentTerms(make('PERCENT',550,{
   finance:{approvedBasisCurrency:'EUR',approvedActConversionRate:1.1,
     approvedActConversionSourceRef:'CENTRAL_BANK_RATE'},
   legal:{approvedActCurrencyAndFxTreatment:true}
 }));
 assert.equal(fx.exchangeRate,1.1);
 assert.throws(()=>certifiedAgentTerms(make('PERCENT',500,{
   finance:{approvedBasisType:'SHIPMENT_MARGIN',approvedShipmentMargin:2000,
     approvedMarginCurrency:'USD',factoryLoadingDocumentRef:null,guReturnDocumentRef:'GU'}
 })),code('ACT_CERTIFIED_FACTORY_DOCUMENT_REQUIRED'));
});
test('Universal Act request retains audited Owner, current source, approvals, and exactly two pages',()=>{
 const acts=readFileSync(new URL('../supabase/functions/rona-agent-reward-workflow/acts.ts',import.meta.url),'utf8');
 const edge=readFileSync(new URL('../supabase/functions/rona-agent-reward-workflow/index.ts',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../functions/portal/agent-rewards-v1-ui.js',import.meta.url),'utf8');
 const render=readFileSync(new URL('../functions/portal/agent-reward-act-pdf-engine.js',import.meta.url),'utf8');
 assert.match(acts,/on a.id=r.assignment_id and a.client_key=d.client_key/);
 assert.match(acts,/b.deal_key=r.deal_key and b.assignment_id=r.assignment_id/);
 assert.match(acts,/!reviews.approved/);
 assert.match(acts,/metadata->>'requestId'/);
 assert.match(acts,/if\(canonicalAutomatic\)\{/);
 assert.match(acts,/financialAppendix:appendix/);
 assert.match(acts,/sourceMode:'FINANCE_LEGAL_CERTIFIED_ACT_V1'/);
 assert.match(edge,/metadata->>'requestId'/);
 assert.match(ui,/if\(pdf.pageCount!==2\)/);
 assert.match(ui,/const issue=docButton\('Сформировать и скачать акт'/);
 assert.doesNotMatch(render,/if\(d.dealId==='DEAL-2026-004'\)/);
 assert.match(render,/appendTermsCanvas\(d.financialAppendix/);
 assert.match(render,/RONA_AGENT_ACT_TERMS_APPENDIX_V1/);
});
