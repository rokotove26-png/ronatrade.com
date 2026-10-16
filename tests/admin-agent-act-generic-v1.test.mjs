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
 const fixedFx=certifiedAgentTerms(make('FIXED',440,{term:{currency:'EUR'},
   finance:{approvedActConversionRate:1.1,approvedActConversionSourceRef:'CB_RATE'},
   legal:{approvedForeignCurrencyActAllowed:true,approvedActCurrencyAndFxTreatment:true}}));
 assert.equal(fixedFx.basisAmount,400);
 assert.equal(fixedFx.basisCurrency,'EUR');
 assert.equal(fixedFx.approvedAmount,440);

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

test('General certified Act is generated from exact Owner, Finance, Legal and signed Addendum',async()=>{
 const requestId='a1111111-1111-4111-8111-111111111111';
 const correctionId='b1111111-1111-4111-8111-111111111111';
 const owner='c1111111-1111-4111-8111-111111111111';
 const assignment='d1111111-1111-4111-8111-111111111111';
 const dsId='AGENCY-S-006-ABCD1234';
 const termId='e1111111-1111-4111-8111-111111111111';
 const baseRow={
   id:requestId,deal_id:'DEAL-2026-010',deal_key:'f1111111-1111-4111-8111-111111111111',
   assignment_id:assignment,owner_correction_key:correctionId,correction_version:4,
   agent_legal_entity_key:'ENTITY-A',linked_legal_entity:'ENTITY-A',
   requested_by:owner,request_status:'REVIEW_REQUESTED',generated_document_number:'ACT-GENERIC-004',
   term_key:termId,source_snapshot:{},
   finance_snapshot:{approvedActAmount:400,approvedCurrency:'USD',financeSourceRef:'FINANCE:AGENT-ACT-004',
     ownerCorrectionId:correctionId,ownerCorrectionVersion:4,
     approvedTermId:termId,signedAddendumDocumentId:dsId},
   legal_snapshot:{approvedAddendumDocumentId:dsId,approvedActDate:'2026-10-16',
     approvedDocumentNumber:'ACT-GENERIC-004',approvedServiceText:'Привлечение покупателя',
     servicePeriod:'По сделке DEAL-2026-010',issuerSignatoryName:'Руководитель',
     facsimileAuthorizationRef:'OWNER-AUTH-004',approvedIssuerRequisites:'Реквизиты RONA',
     approvedIssuerLegalName:'RONA Trade',approvedSigningPlace:'Бишкек',
     approvedAgentSignatory:'Представитель агента',facsimileApproved:true}
 };
 const term={term_reference:'ДС № 4 от 2026',document_reference:'ДС № 4 от 2026',
   document_id:dsId,commission_mode:'FIXED',commission_fixed_amount:400,
   currency:'USD',legal_name:'Агент 010',tax_identifier:'ИНН-010',
   registered_address:'Юридический адрес агента',registration_country:'Кыргызстан'};
 const makeSql=({approved=true,associated=true,legal=true}={})=>
   async(parts,...values)=>{
     const q=parts.join('?');
     if(q.includes('agent_reward_act_requests_v1 r'))
       return [{...baseRow,linked_legal_entity:associated?'ENTITY-A':'ENTITY-B'}];
     if(q.includes('agent_reward_owner_corrections_v1'))
       return [{id:correctionId}];
     if(q.includes('select record_id,functional_role'))
       return [{record_id:'FINANCE-REVIEW',role:'FINANCE',status:approved?'APPROVED':'PENDING'},
         {record_id:'LEGAL-REVIEW',role:'LEGAL',status:'APPROVED'}];
     if(q.includes('select status,payload'))
       return [{status:'APPROVED',payload:{confirmed:true,mandatory_conditions:[]}},
         {status:'APPROVED',payload:{confirmed:legal,mandatory_conditions:[]}}];
     if(q.includes('mcp_oauth_tokens'))
       return [{owner_portal_user_id:owner}];
     if(q.includes('select t.term_reference'))
       return [term];
     throw Error('Unexpected DB read: '+q.slice(0,100));
   };
 const act=await approvedActIssue(makeSql(),{userId:owner},requestId);
 assert.equal(act.dealId,'DEAL-2026-010');
 assert.equal(act.agentLegalName,'Агент 010');
 assert.equal(act.amount,400);
 assert.equal(act.sourceMode,'FINANCE_LEGAL_CERTIFIED_ACT_V1');
 assert.equal(act.financialAppendix.contract,'RONA_AGENT_ACT_TERMS_APPENDIX_V1');
 assert.equal(act.financialAppendix.agentReward,400);
 assert.equal(act.financialAppendix.correctionVersion,4);
 assert.equal(act.commissionSource.mode,'FIXED');
 assert.equal(act.createsPayable,false);
 await assert.rejects(()=>approvedActIssue(makeSql({approved:false}),{userId:owner},requestId),
   /FINANCE_LEGAL_ACT_REVIEW_REQUIRED/);
 await assert.rejects(()=>approvedActIssue(makeSql({associated:false}),{userId:owner},requestId),
   /ACT_SOURCE_ASSOCIATION_INVALID/);
 await assert.rejects(()=>approvedActIssue(makeSql({legal:false}),{userId:owner},requestId),
   /ACT_FUNCTIONAL_CONCLUSIONS_UNCONFIRMED/);
 await assert.rejects(()=>approvedActIssue(makeSql(),{userId:'OTHER_OWNER'},requestId),
   /ACT_OWNER_IDENTITY_REQUIRED/);
});

test('Rendered Admin offers non-DS1 Agent Act on other deals and does not bypass missing approvals',async()=>{
 const {chromium}=await import('playwright');
 const {onRequest}=await import('../functions/portal/agent-rewards-v1-ui.js');
 const script=await(await onRequest()).text();
 const browser=await chromium.launch({headless:true});
 try{
   for(const [dealId,mode] of [['DEAL-2026-010','FIXED'],['DEAL-2026-011','PERCENT']]){
     const assignmentId='a1111111-1111-4111-8111-111111111111';
     const requestId='b1111111-1111-4111-8111-111111111111';
     const correctionId='c1111111-1111-4111-8111-111111111111';
     const bindingId='d1111111-1111-4111-8111-111111111111';
     const deal={dealId,assignmentId,clientName:'Контрагент для '+dealId,
       agentName:'Агент '+dealId,agentLegalName:'Агент 010',
       businessStatus:'ACTIVE',financialCurrency:'USD',receiptCurrency:'USD',
       cashFlow:{status:'APPROVED_CASH_FLOW_DDS',currency:'USD',cashReceived:5000,
         counterpartyCashOut:3000,bankFees:20,netCashFlow:1980},
       financeSourceReconciliation:{status:'RECONCILED_CURRENT_FINANCE_V8'},
       cashPaymentLines:[{paymentId:'PAYMENT-010',counterparty:'Поставщик',
         canonicalCounterpartyId:'SUPPLIER:010',counterpartyResolutionStatus:'RESOLVED',
         amount:3000,currency:'USD'}],
       ownerResultBridge:{recognition_status:'APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE',
         open_settlement_adjustment:{amount:0}},
       ownerCorrectionAuthority:{status:'APPROVED_FOR_OWNER_CORRECTION',
         contract:'PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT'},
       ownerCorrection:{version:2,createdAt:'2026-10-16T10:00:00Z',
         payload:{paymentLineAmounts:{'PAYMENT-010':3000},openSettlementAdjustment:0}},
       agentTerm:{mode,status:'ACTIVE',lifecycleState:'ACTIVE',authorityState:'CONFIRMED',
         currency:'USD',rate:0.25,fixedAmount:400,reference:'ДС № 4 от 15.07.2026'}
     };
     const doc={dealId,assignmentId,agentCompanyId:'S-010',agentLegalName:'Агент 010',
       term:{mode,rate:0.25},sourceReadiness:{termAligned:true,accountingStatus:'CLOSED'},
       currentAddendum:{bindingId,documentId:'AGENCY-S-010-ABCD1234',
         reference:'ДС № 4 от 15.07.2026',ownerApprovedByUpload:true},
       ownerCorrection:{sourceId:correctionId,version:2},acts:[]};
     const page=await browser.newPage({viewport:{width:1280,height:900}});
     let requested=0,finalized=0;const errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     page.on('dialog',d=>d.dismiss());
     await page.route('http://rona.generic/portal/admin',r=>r.fulfill({
       contentType:'text/html',body:'<!doctype html><html lang="ru"><body><main id="page-agent-settlements" class="page active"></main></body></html>'}));
     await page.route('http://rona.generic/portal/owner-api**',r=>r.fulfill({
       contentType:'application/json',body:JSON.stringify({ok:true,data:{deals:[deal]}})}));
     await page.route('http://rona.generic/portal/agent-reward-workflow**',r=>{
       const action=new URL(r.request().url()).searchParams.get('action')||'state';
       let data=doc;
       if(action==='request-act'){
         requested++;
         const v=JSON.parse(r.request().postData()||'{}').ownerApprovedCalculation;
         assert.equal(v.dealId,dealId);
         assert.equal(v.assignmentId,assignmentId);
         assert.equal(v.correctionVersion,2);
         assert.deepEqual(v.correctedPayload.paymentLineAmounts,{'PAYMENT-010':3000});
         doc.acts=[{id:requestId,owner_correction_key:correctionId,addendum_key:bindingId,
           correction_version:2,ownerCalculationStored:true,ownerCalculationVersion:2,
           ownerSignReady:false,readiness:{missing:['FINANCE_CONCLUSION_REQUIRED']},
           documents:[]}];
         data={requestId,ownerCalculationStored:true};
       }else if(action==='final-act')finalized++;
       return r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
     });
     await page.goto('http://rona.generic/portal/admin');
     await page.addScriptTag({content:script});
     const button=page.locator('.rona-ar-documents')
       .getByRole('button',{name:'Сформировать и скачать акт'});
     await button.waitFor({timeout:12000});
     await button.click();
     await page.waitForFunction(()=>document.querySelectorAll('.rona-admin-dialog-backdrop').length>0,
       {timeout:6000}).catch(()=>null);
     assert.equal(requested,1,mode+' must request this exact deal Act');
     assert.equal(finalized,0,mode+' must not sign without Finance conclusion');
     assert.deepEqual(errors,[]);
     await page.close();
   }
 }finally{await browser.close()}
});
