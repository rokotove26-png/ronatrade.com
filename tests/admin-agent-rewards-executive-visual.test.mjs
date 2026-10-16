import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../functions/portal/agent-rewards-v1-ui.js';

const file=readFileSync(new URL('../functions/portal/agent-rewards-v1-ui.js',import.meta.url),'utf8');

test('Executive presentation changes no financial authority, formulas, API or session handling',async()=>{
  const js=await(await onRequest()).text();
  assert.match(js,/__RONA_AGENT_REWARDS_PRESENTATION__='executive-finance-v1'/);
  assert.doesNotMatch(js,/function financeMetaNode\(value/);
  assert.match(js,/function settlementDetailsDialog\(deal,trigger\)/);
  assert.match(js,/dialog\.showModal\(\)/);
  assert.match(js,/function renderDealPulse\(root,deal\)/);
  assert.match(js,/function renderFxReference\(root,deal\)/);
  assert.match(js,/renderFxReference\(root,deal\)/);
  assert.match(js,/r\.dataset\.financeMeaning=financeMeaning\(label\)/);
  assert.doesNotMatch(js,/Реализованный FX · справочно/);
  assert.match(js,/РАСЧЁТ · агентское вознаграждение/);
  assert.doesNotMatch(js,/Вознаграждение не означает выплату/);
  assert.match(js,/function termReward\(deal/);
  assert.match(js,/Math\.max\(0,basis\)\*num\(t\.rate\)/);
  assert.match(js,/function ownerModel\(deal,fact\)/);
  assert.match(js,/Math\.max\(0,openSettlementAdjustment\)/);
  assert.match(js,/await saveCorrection\(deal\.dealId,deal\.assignmentId,payload,''\)/);
  assert.match(js,/ACT_PDF_TWO_PAGES_REQUIRED/);
  assert.match(js,/loadAgentActPdfEngine/);
  assert.match(js,/if\(pdf.pageCount!==2\)/);
  assert.match(js,/ownerSignedDs1ForManagement\(deal\)\&\&model.reward/);
  assert.match(js,/script\.onerror=/);
  assert.match(js,/pdf\.pageCount!==2/);
  assert.match(js,/payload=\{paymentLineAmounts:m\.paymentLineAmounts,openSettlementAdjustment:m\.openSettlementAdjustment\}/);
  assert.match(js,/paymentLineAmounts\[part\.paymentId\]=corrected/);
  assert.doesNotMatch(js,/Акт сверки · СГ-Транс/);
  assert.match(file,/minimumFractionDigits:1,maximumFractionDigits:1/);
  assert.match(file,/function ownerCorrectionApproved\(deal\)/);
  assert.match(file,/send\.disabled=true/);
  assert.match(file,/\.rona-ar-canonical-head \.rona-visual-title\{position:relative;margin:0;color:#f7fbff;font-size:clamp\(31px,3\.25vw,48px\)/);
  assert.doesNotMatch(js,/function.*new.*finance.*schema|fetch\(['"]https?:\/\//i);
});

test('Real executable Agent Rewards UI: clean financial hierarchy, functional details dialog and responsive grid',async()=>{
  const {chromium}=await import('playwright');
  const script=await(await onRequest()).text();
  const deal={
    assignmentId:'VISUAL-QA-ONLY',dealId:'VISUAL-QA-DEAL',clientName:'Контрагент',agentName:'Агент',
    businessStatus:'ACTIVE',financialCurrency:'USD',receiptCurrency:'USD',quantityTonnes:500,
    agentTerm:{mode:'FIXED',status:'ACTIVE',lifecycleState:'ACTIVE',authorityState:'CONFIRMED',fixedAmount:400,currency:'USD'},
    planInputs:{
      revenue:5000,expenseKnownTotal:3000,expenseLines:[{label:'Транспортировка',amount:3000,currency:'USD'}],
      taxesAndPayments:250,fxDifference:10,agentReward:500,agentRewardStatus:'APPROVED_FINANCE_MANAGEMENT_PLAN',
      expenseStatus:'APPROVED_FINANCE_MANAGEMENT_PLAN',revenueStatus:'APPROVED_FINANCE_MANAGEMENT_PLAN',
      taxesAndPaymentsStatus:'TO_VERIFY_PLAN_TAX_STATUS',fxStatus:'TO_VERIFY_PLAN_FX_STATUS',
      transportBreakdownStatus:'APPROVED_BREAKDOWN_WITH_TARIFF_CONFLICT',
      transportBreakdown:{currency:'USD',components:[{label:'Тарифный компонент',amount:3000,currency:'USD'}],conflict:{scope:'RONA_VISUAL_QA',plan_rate:14,rail_matrix_rate:17,unit:'USD/t'}}
    },
    cashFlow:{status:'APPROVED_CASH_FLOW_DDS',currency:'USD',cashReceived:5000,counterpartyCashOut:3000,bankFees:20,netCashFlow:1980,realizedFxReference:10},
    financeSourceReconciliation:{status:'RECONCILED_CURRENT_FINANCE_V8',sourceVersion:'VISUAL_QA_AUTHORITY'},
    cashPaymentLines:[
      {paymentId:'VISUAL-QA-PAYMENT',counterparty:'Поставщик',canonicalCounterpartyId:'SUPPLIER:VISUAL-QA',counterpartyResolutionStatus:'RESOLVED',
        amount:1800,currency:'USD',nativeAmount:1800,nativeCurrency:'USD',authorityStatus:'AUTHORITATIVE_FINANCE_PAYMENT'},
      {paymentId:'VISUAL-QA-PAYMENT-2',counterparty:'Поставщик',canonicalCounterpartyId:'SUPPLIER:VISUAL-QA',counterpartyResolutionStatus:'RESOLVED',
        amount:1200,currency:'USD',nativeAmount:1200,nativeCurrency:'USD',authorityStatus:'AUTHORITATIVE_FINANCE_PAYMENT'}
    ],
    ownerResultBridge:{recognition_status:'APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE',open_settlement_adjustment:{amount:0}},
    ownerCorrectionAuthority:{status:'NOT_APPROVED',contract:'PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT'},
    settlementPositions:[
      {balance_type:'ADVANCE',status:'TO_VERIFY_SOURCE',counterparty:'QA Advance',balance_amount:55,currency:'USD'},
      {balance_type:'PAYABLE',status:'TO_VERIFY',counterparty:'QA Supplier',balance_amount:300,currency:'USD'},
      {balance_type:'RECEIVABLE',status:'CONFIRMED',counterparty:'QA Receivable',balance_amount:120,currency:'USD'},
      {balance_type:'UNKNOWN_SOURCE_KIND',status:'TO_VERIFY',counterparty:'QA Uncategorized',balance_amount:999,currency:'USD'}
    ]
  };
  const data={ok:true,data:{deals:[deal]}};
  const markup='<!doctype html><html lang="ru"><head><meta charset="utf-8"/></head><body>'
    +'<main id="page-agent-settlements" class="page active" style="padding:20px"></main>'
    +'</body></html>';
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [1920,1440,1280,1100,950,650]){
      deal.cashFlow.realizedFxReference=width===950?-10:10;
      deal.agentTerm=width===650
        ?{mode:'FIXED',status:'ACTIVE',lifecycleState:'ACTIVE',authorityState:'CONFIRMED',fixedAmount:400,currency:'USD'}
        :{mode:'PERCENT',status:'ACTIVE',lifecycleState:'ACTIVE',authorityState:'CONFIRMED',
           rate:0.1,currency:'USD',reference:'EXCLUDING FX'};
      deal.planInputs.transportBreakdownStatus=width===950?'APPROVED_BREAKDOWN':'APPROVED_BREAKDOWN_WITH_TARIFF_CONFLICT';
      deal.planInputs.transportBreakdown=width===950?{components:[{label:'Тарифный компонент',amount:3000,currency:'USD'}]}:{components:[{label:'Тарифный компонент',amount:3000,currency:'USD'}],conflict:{scope:'RONA_VISUAL_QA',plan_rate:14,rail_matrix_rate:17,unit:'USD/t'}};
      const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
      const errors=[];const calls=[];
      page.on('pageerror',err=>errors.push(err.message));
      await page.route('http://rona.visual/portal/admin',route=>route.fulfill({status:200,contentType:'text/html',body:markup}));
      await page.route('http://rona.visual/portal/owner-api**',route=>{
        calls.push(route.request().method()+' '+route.request().url());
        route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
      });
      await page.goto('http://rona.visual/portal/admin',{waitUntil:'load'});
      await page.addScriptTag({content:script});
      await page.waitForSelector('.rona-ar-pulse .rona-ar-metric:nth-child(4)',{timeout:10000});
      await page.waitForFunction(()=>document.querySelector('.rona-ar-pulse .rona-ar-metric-value')?.textContent!=='TO_VERIFY',{timeout:10000});
      const result=await page.evaluate(()=>{
        const root=document.querySelector('#page-agent-settlements .rona-ar');
        const tiles=[...root.querySelectorAll('.rona-ar-pulse .rona-ar-metric')];
        const names=tiles.map(t=>t.querySelector('.rona-ar-metric-label')?.textContent);
        const values=tiles.map(t=>t.querySelector('.rona-ar-metric-value')?.textContent);
        const cols=[...root.querySelectorAll('.rona-ar-pnl-grid>.rona-ar-col')];
        const grid=getComputedStyle(root.querySelector('.rona-ar-pnl-grid'));
        const nameFont=parseFloat(getComputedStyle(root.querySelector('.rona-ar-name')).fontSize);
        const valueFont=parseFloat(getComputedStyle(root.querySelector('.rona-ar-value')).fontSize);
        const technical=[...root.querySelectorAll('.rona-ar-disclosure')];
        const inp=root.querySelector('[data-owner-key="openSettlementAdjustment"]');
        const adjustmentGroup=root.querySelector('.rona-ar-col.owner .rona-ar-owner-adjustment');
        const detailsButton=adjustmentGroup?.querySelector('.rona-ar-details-btn');
        const dialog=root.querySelector('dialog.rona-ar-settlement-dialog');
        const unit=root.querySelector('.rona-ar-input-currency');
        const sections=cols.map(el=>el.querySelector('.rona-ar-col-title')?.textContent);
        const planRows=[...root.querySelectorAll('.rona-ar-col.plan .rona-ar-row')];
        const planNet=planRows.find(el=>el.querySelector('.rona-ar-name')?.textContent==='Чистая прибыль');
        const ownerActual=root.querySelector('[data-owner-computed="actualFinancialResult"] .rona-ar-value');
        const ownerReward=root.querySelector('[data-owner-computed="agentReward"] .rona-ar-value');
        const financialLabels=['Доходы','Расходы','Прибыль до налогообложения','Налоги и платежи (10%)','Чистая прибыль','Агентское вознаграждение','Прибыль RONA'];
        const pnlByColumn=Object.fromEntries(['plan','fact','owner'].map(k=>{
          const rootCol=root.querySelector('.rona-ar-col.'+k);
          const items=[...rootCol.querySelectorAll('.rona-ar-row')].map(el=>({
            label:el.querySelector('.rona-ar-name')?.firstChild?.textContent||'',
            value:el.querySelector('.rona-ar-value')?.textContent||null
          }));
          return [k,items.filter(v=>financialLabels.includes(v.label))]
        }));
        const agreementWarning=root.querySelector('.rona-ar-col.owner .rona-ar-agent-contract-flag');
        const factGroupNames=[...root.querySelectorAll('.rona-ar-col.fact .rona-ar-exp-name')].map(n=>n.textContent);
        const ownerGroupNames=[...root.querySelectorAll('.rona-ar-col.owner .rona-ar-exp-name')].map(n=>n.textContent);
        const groupInputs=[...root.querySelectorAll('.rona-ar-col.owner [data-owner-payment-group-key]')];
        const expenseTotal=[...root.querySelectorAll('.rona-ar-col.plan .rona-ar-row')].find(el=>el.querySelector('.rona-ar-name')?.textContent.startsWith('Расходы'));
        const fx=root.querySelector('[data-rona-ar-fx-reference="1"]');
        const fxValue=fx?.querySelector('.rona-ar-fx-value');
        const fxTableRows=[...root.querySelectorAll('.rona-ar-pnl-grid .rona-ar-row')]
          .filter(n=>n.textContent.includes('Реализованный FX'));
        const valColor=sel=>{
          const n=root.querySelector(sel);
          return n?getComputedStyle(n).color:null
        };
        const meaning=sel=>root.querySelector(sel)?.dataset.financeMeaning||null;
        const cockpit=root.querySelector('.rona-ar-workspace');
        const waterfall=root.querySelector('.rona-ar-waterfall');
        const evidence=root.querySelector('.rona-ar-evidence');
        const insightItems=[...root.querySelectorAll('.rona-ar-cascade-row')];
        const delta=root.querySelector('.rona-ar-compare-cell.delta .rona-ar-compare-value');
        const payoutRows=[...root.querySelectorAll('.rona-ar-evidence-row')];
        return {version:window.__RONA_AGENT_REWARDS_PRESENTATION__,names,values,sections,
          cockpit:{
            version:root.dataset.ronaAgentRewardsCockpit,
            workspaces:root.querySelectorAll('.rona-ar-workspace').length,
            navCount:root.querySelectorAll('.rona-ar-directory').length,
            selectedCount:root.querySelectorAll('.rona-ar-deal[aria-pressed="true"]').length,
            insightCount:root.querySelectorAll('[data-rona-ar-insights="source-only-v1"]').length,
            insightPanels:root.querySelectorAll('.rona-ar-insight-card').length,
            waterfallSteps:insightItems.map(n=>n.dataset.ronaArCascadeStep),
            waterfallBars:root.querySelectorAll('.rona-ar-cascade-bar').length,
            waterfallNet:root.querySelector('.rona-ar-cascade-row.subtotal:nth-child(5) .rona-ar-cascade-value')?.textContent,
            delta:delta?.textContent,
            evidenceText:evidence?.textContent||'',
            evidenceRows:payoutRows.length,
            navWidth:cockpit?.querySelector('.rona-ar-directory')?.getBoundingClientRect().width||0,
            rightWidth:cockpit?.querySelector('.rona-ar-focus')?.getBoundingClientRect().width||0,
            horizontalOverflow:Math.max(document.documentElement.scrollWidth,root.scrollWidth)
          },
          gridColumns:grid.gridTemplateColumns,nameFont,valueFont,columns:cols.map(el=>el.getBoundingClientRect().toJSON()),
          pnlByColumn,financialLabels,
          hiddenRows:{
            planFx:planRows.filter(el=>el.querySelector('.rona-ar-name')?.textContent==='Курсовая разница').length,
            ownerAgentBasis:root.querySelectorAll('.rona-ar-col.owner [data-owner-computed="agentBasis"]').length,
            planNetValue:planNet?.querySelector('.rona-ar-value')?.textContent,
            ownerActual:ownerActual?.textContent,ownerReward:ownerReward?.textContent,
            contractWarnings:root.querySelectorAll('.rona-ar-col.owner .rona-ar-agent-contract-flag').length,
            warningText:agreementWarning?.textContent||null,
            warningTooltip:agreementWarning?.title||null
          },
          technicalCount:technical.length,
          inputExists:!!inp,inputDisabled:inp?.disabled,inputCurrency:unit?.textContent,
          details:{
            buttonCount:root.querySelectorAll('.rona-ar-col.owner .rona-ar-owner-adjustment .rona-ar-details-btn').length,
            insideAdjustmentRow:detailsButton?.closest('.rona-ar-row')===inp?.closest('.rona-ar-row'),
            dialogCount:root.querySelectorAll('dialog.rona-ar-settlement-dialog').length,
            initiallyClosed:!!dialog&&!dialog.open,
            inlineFactBalances:root.querySelectorAll('.rona-ar-col.fact .rona-ar-balances').length,
            oldBottomBalances:root.querySelectorAll('.rona-ar>.rona-ar-balances').length
          },
          surface:{
            columnMetaCount:root.querySelectorAll('.rona-ar-col-meta').length,
            metricMetaCount:root.querySelectorAll('.rona-ar-metric-meta').length,
            summaryNoteCount:root.querySelectorAll('.rona-ar-summary-note').length,
            adjustmentNoteCount:root.querySelectorAll('.rona-ar-owner-adjustment-note').length,
            commentFieldCount:root.querySelectorAll('.rona-ar-owner-note textarea').length,
            technicalBannerCount:root.querySelectorAll('.rona-ar-finance-banner').length,
            fxDescriptionCount:root.querySelectorAll('.rona-ar-fx-description').length
          },
          width:root.getBoundingClientRect().width,scrollWidth:root.scrollWidth,visibleRewardRow:!!root.querySelector('.rona-ar-reward-focus'),
          grouping:{
            factNames:factGroupNames,ownerNames:ownerGroupNames,
            ownerInputCount:groupInputs.length,
            groupKey:groupInputs[0]?.dataset.ownerPaymentGroupKey||null,
            factPaidTotal:root.querySelector('.rona-ar-col.fact .rona-ar-row:nth-child(2) .rona-ar-value')?.textContent||null,
            sourceIdsTooltip:root.querySelector('.rona-ar-col.owner .rona-ar-exp-name')?.title||null
          },
          ledger:{
            hintCount:root.querySelectorAll('.rona-ar-pnl-grid .rona-ar-row .rona-ar-hint').length,
            expenseSubtitleCount:root.querySelectorAll('.rona-ar-pnl-grid .rona-ar-exp-sub').length,
            tariffSections:root.querySelectorAll('.rona-ar-pnl-grid .rona-ar-transport').length,
            tariffHeadings:[...root.querySelectorAll('.rona-ar-pnl-grid *')].filter(el=>el.textContent==='Транспортировка · тарифный состав').length,
            tariffConflict:root.querySelectorAll('.rona-ar-col.plan .rona-ar-tariff-flag').length,
            tariffFlagText:root.querySelector('.rona-ar-col.plan .rona-ar-tariff-flag')?.textContent||null,
            planExpenseAmount:expenseTotal?.querySelector('.rona-ar-value')?.textContent||null,
            planExpenseTooltip:expenseTotal?.querySelector('.rona-ar-name')?.title||null,
            planExpenseDetail:root.querySelectorAll('.rona-ar-col.plan .rona-ar-exp-name').length,
            actualPaidTooltip:root.querySelector('.rona-ar-col.fact .rona-ar-exp-name')?.title||null,
            ownerInputTooltip:root.querySelector('.rona-ar-col.owner [data-owner-key="openSettlementAdjustment"]')?.getAttribute('aria-label')||null
          },
          fxCount:root.querySelectorAll('[data-rona-ar-fx-reference="1"]').length,
          fxAmount:fxValue?.textContent,fxColor:fxValue?getComputedStyle(fxValue).color:null,
          fxMeaning:fx?.querySelector('.rona-ar-fx-label')?.textContent,
          fxNote:fx?.querySelector('.rona-ar-fx-description')?.textContent,
          fxPrecedesTables:!!fx&&!!root.querySelector('.rona-ar-scenarios')&&!!(fx.compareDocumentPosition(root.querySelector('.rona-ar-scenarios')) & Node.DOCUMENT_POSITION_FOLLOWING),
          fxAfterPulse:!!fx&&!!fx.previousElementSibling?.classList.contains('rona-ar-pulse'),
          fxInsideTables:root.querySelectorAll('.rona-ar-pnl-grid [data-rona-ar-fx-reference]').length,
          fxRows:fxTableRows.length,
          colors:{
            factReceipt:valColor('.rona-ar-col.fact .rona-ar-row[data-finance-meaning="inflow"] .rona-ar-value'),
            factOutflow:valColor('.rona-ar-col.fact .rona-ar-row[data-finance-meaning="outflow"] .rona-ar-value'),
            ownerAgent:valColor('.rona-ar-col.owner .rona-ar-row[data-finance-meaning="agent"] .rona-ar-value'),
            planRevenue:valColor('.rona-ar-col.plan .rona-ar-row[data-finance-meaning="inflow"] .rona-ar-value'),
            factResult:valColor('.rona-ar-col.fact .rona-ar-row[data-finance-meaning="result"] .rona-ar-value'),
            expenseDetail:valColor('.rona-ar-col.fact .rona-ar-exp-amount')
          },
          rowMeanings:{
            receipt:meaning('.rona-ar-col.fact .rona-ar-row[data-finance-meaning="inflow"]'),
            outflow:meaning('.rona-ar-col.fact .rona-ar-row[data-finance-meaning="outflow"]'),
            agent:meaning('.rona-ar-col.owner .rona-ar-row[data-finance-meaning="agent"]')
          }
        }
      });
      assert.equal(result.version,'executive-finance-v1');
      assert.equal(result.cockpit.version,'executive-cockpit-v1');
      assert.equal(result.cockpit.workspaces,1);
      assert.equal(result.cockpit.navCount,1);
      assert.equal(result.cockpit.selectedCount,1);
      assert.equal(result.cockpit.insightCount,1);
      assert.equal(result.cockpit.insightPanels,1,'No duplicate technical evidence panel');
      assert.deepEqual(result.cockpit.waterfallSteps,['income','expense','subtotal','expense','subtotal','agent','final']);
      assert.equal(result.cockpit.waterfallBars,7,'All seven initial financial waterfall steps are strictly source-derived');
      assert.equal(result.cockpit.waterfallNet,'+1 782,0 USD');
      assert.equal(result.cockpit.delta,'-18,0 USD','Comparison is OWNER net less PLAN net, not a fabricated payables number');
      assert.equal(result.cockpit.evidenceText,'','No technical source panel');
       assert.equal(result.cockpit.evidenceRows,0);
      assert(result.cockpit.navWidth>180 && result.cockpit.rightWidth>180,'Both master and detail panels must be usable');
      assert(result.cockpit.horizontalOverflow<=width+1,'No horizontal overflow in executive cockpit at '+width);
      if(width>=1600)assert(result.cockpit.rightWidth>result.cockpit.navWidth,'Large screens prioritize deal analysis');

      assert.deepEqual(result.names,[
        'PLAN · агентское вознаграждение',
        'РАСЧЁТ · агентское вознаграждение',
        'PLAN · прибыль RONA',
        'ФАКТИЧЕСКИЙ РЕЗУЛЬТАТ · чистая прибыль'
      ],'Management KPIs reflect net profit, not pre-tax DDS, at '+width);
      for(const [column,rows] of Object.entries(result.pnlByColumn)){
        assert.deepEqual(rows.map(x=>x.label),result.financialLabels,
          'Same seven main financial calculation labels in PLAN, FACT and OWNER at '+width+' column '+column);
      }
      const management=(column,label)=>result.pnlByColumn[column].find(x=>x.label===label)?.value;
      assert.equal(management('plan','Доходы'),'5 000,0 USD');
      assert.equal(management('plan','Расходы'),'3 000,0 USD');
      assert.equal(management('plan','Прибыль до налогообложения'),'+2 000,0 USD');
      assert.equal(management('plan','Налоги и платежи (10%)'),'200,0 USD');
      assert.equal(management('plan','Чистая прибыль'),'+1 800,0 USD');
      assert.equal(management('fact','Доходы'),'5 000,0 USD');
      assert.equal(management('fact','Расходы'),'3 020,0 USD');
      assert.equal(management('fact','Прибыль до налогообложения'),'+1 980,0 USD');
      assert.equal(management('fact','Налоги и платежи (10%)'),'198,0 USD');
      assert.equal(management('fact','Чистая прибыль'),'+1 782,0 USD');
      assert.equal(management('owner','Налоги и платежи (10%)'),'198,0 USD');
      assert.equal(management('owner','Чистая прибыль'),'+1 782,0 USD');
      assert.equal(management('owner','Агентское вознаграждение'),width===650?'+400,0 USD':'+178,2 USD');
      assert.equal(management('fact','Агентское вознаграждение'),width===650?'400,0 USD':'178,2 USD');
      assert.equal(management('fact','Прибыль RONA'),width===650?'+1 382,0 USD':'+1 603,8 USD');
      assert.equal(result.values[0],width===650?'400,0 USD':'180,0 USD','Plan reward is recalculated using after-tax net profit, not stale approved plan amount at '+width);
      assert.equal(result.values[1],width===650?'400,0 USD':'178,2 USD',
        'Owner calculation uses full actual financial result for confirmed percentage terms at '+width);
      assert.equal(result.hiddenRows.planFx,0,'Plan FX row must not appear at '+width);
      assert.equal(result.hiddenRows.ownerAgentBasis,0,'Separate agent basis row must not appear at '+width);
      assert.equal(result.hiddenRows.planNetValue,'+1 800,0 USD',
        'PLAN net is pre-tax 2000 less 10% management provision (no re-added FX or historical tax input) at '+width);
      assert.equal(result.hiddenRows.ownerActual,'+1 980,0 USD',
        'Approved actual financial result is the agent calculation basis at '+width);
      assert.equal(result.hiddenRows.ownerReward,width===650?'+400,0 USD':'+178,2 USD',
        'OWNER agent reward must use net profit after 10% provision, not pre-tax profit at '+width);
      assert.equal(result.hiddenRows.contractWarnings,0,'FX contract review must not be a visible OWNER badge at '+width);
      assert.equal(result.hiddenRows.warningText,null);
      assert.equal(result.hiddenRows.warningTooltip,null);
      assert.equal(result.values[3],'1 782,0 USD','Initial KPI must match OWNER net profit at '+width);
      assert.deepEqual(result.sections,['Ожидаемый результат','Расчёт по фактическому ДДС','Фактический результат']);
      assert.equal(result.technicalCount,0,'No technical source disclosure in the financial layout at '+width);
      for(const [item,count] of Object.entries(result.surface)){
        assert.equal(count,0,'No unnecessary '+item+' rendered at '+width);
      }
      assert(result.nameFont>=12&&result.valueFont>=14,'Financial primary type is too small at '+width);
      assert(result.visibleRewardRow,'Reward rows must have visible priority at '+width);
      assert(result.inputExists&&result.inputCurrency==='USD','Currency displayed beside editable numeric amount');
      assert.equal(result.inputDisabled,true,'Unauthorized test must not unlock owner correction');
      assert.equal(result.details.buttonCount,1,'Exactly one Details action in OWNER adjustment at '+width);
      assert.equal(result.details.insideAdjustmentRow,true,'Details action belongs inside OWNER adjustment line at '+width);
      assert.equal(result.details.dialogCount,1,'Render exactly one separate details dialog at '+width);
      assert.equal(result.details.initiallyClosed,true,'Details must start closed at '+width);
      assert.equal(result.details.inlineFactBalances,0,'No inline settlement balances inside FACT at '+width);
      assert.equal(result.details.oldBottomBalances,0,'No detached settlement block at '+width);
      assert.deepEqual(result.grouping.factNames,['Поставщик'],'FACT must show one canonical counterparty, not two payment rows at '+width);
      assert.deepEqual(result.grouping.ownerNames,['Поставщик'],'Owner must have only one editable aggregate per canonical counterparty at '+width);
      assert.equal(result.grouping.ownerInputCount,1,'One input per canonical supplier at '+width);
      assert.equal(result.grouping.groupKey,'ENTITY:SUPPLIER:VISUAL-QA','Canonical ID must be grouping key, not display name at '+width);
      assert.match(result.grouping.sourceIdsTooltip||'',/VISUAL-QA-PAYMENT-2/,'Original source payment IDs retained for audit drilldown');
      assert.equal(result.ledger.hintCount,0,'No tiny comments underneath financial line items at '+width);
      assert.equal(result.ledger.expenseSubtitleCount,0,'No tiny metadata below expense or payment details at '+width);
      assert.equal(result.ledger.tariffSections,0,'Tariff breakdown section must not render at '+width);
      assert.equal(result.ledger.tariffHeadings,0,'Tariff composition heading must be fully removed at '+width);
      assert.equal(result.ledger.tariffConflict,width===950?0:1,'Tariff warning must appear only when actual source reports conflict at '+width);
      if(width!==950)assert.equal(result.ledger.tariffFlagText,'Тарифное расхождение');
      assert.equal(result.ledger.planExpenseAmount,'3 000,0 USD','Source-locked approved expense total must not change at '+width);
      assert.equal(result.ledger.planExpenseTooltip,'APPROVED_FINANCE_MANAGEMENT_PLAN','Nonvisual source details must be retained in a label tooltip at '+width);
      assert.equal(result.ledger.planExpenseDetail,1,'The original approved transportation expense article remains in the plan at '+width);
      assert.match(result.ledger.actualPaidTooltip||'',/VISUAL-QA-PAYMENT/,'Payment provenance remains accessible by hover at '+width);
      assert.match(result.ledger.ownerInputTooltip||'',/Корректировка расходов \(доходов\)/,'Owner correction retains its accessible label at '+width);
      assert.equal(result.surface.adjustmentNoteCount,0,'OWNER correction must have no standalone note at '+width);
      assert.equal(result.fxCount,1,'One FX reference strip, not duplicate rows, at '+width);
      assert.equal(result.fxInsideTables,0,'FX strip must be OUTSIDE finance tables at '+width);
      assert.equal(result.fxRows,0,'Neither FACT nor Owner table may contain realized FX at '+width);
      assert(result.fxPrecedesTables&&result.fxAfterPulse,'Compact FX amount follows KPI group and precedes tables at '+width);
      assert.equal(result.fxNote,undefined,'No technical FX explanation at '+width);
      assert.equal(result.fxMeaning,'Курс');
      assert.equal(result.fxAmount,(width===950?'-10,0 USD':'+10,0 USD'),'FX amount must be read from approved FACT without recomputation');
      assert.equal(result.fxColor,width===950?'rgb(255, 156, 172)':'rgb(145, 227, 193)','FX sign color must describe benefit/loss at '+width);
      assert.deepEqual(result.rowMeanings,{receipt:'inflow',outflow:'outflow',agent:'agent'});
      assert.equal(result.colors.factReceipt,'rgb(141, 231, 197)','Confirmed receipt = teal green at '+width);
      assert.equal(result.colors.factOutflow,'rgb(219, 200, 173)','Positive expense amount must NOT be green at '+width);
      assert.equal(result.colors.expenseDetail,'rgb(219, 200, 173)','Expense breakdown shares outflow palette at '+width);
      assert.equal(result.colors.ownerAgent,'rgb(217, 197, 255)','Agent amount = violet at '+width);
      assert.equal(result.colors.planRevenue,'rgb(169, 209, 253)','Planned income = blue, not confirmed green at '+width);
      assert.equal(result.colors.factResult,'rgb(133, 237, 198)','Positive cash result = green at '+width);
      assert(result.width<=width+1,'Root panel must fit browser viewport');

      // V2 compares three source-locked scenarios side by side, but details are full width.
      assert.equal(await page.locator('.rona-ar-scenarios-table thead th').count(),4,'Four comparison columns at '+width);
      assert.equal(await page.locator('.rona-ar-scenarios-table tbody tr').count(),7,'Seven financial rows at '+width);
      assert.equal(await page.locator('.rona-ar-precision .rona-ar-col:not([hidden])').count(),1,'One visible detail at '+width);
      assert.equal(await page.locator('.rona-ar-col.owner').isVisible(),true,'Owner is default editor at '+width);
      assert.equal(await page.locator('.rona-ar-col.plan').isVisible(),false);
      assert.equal(await page.locator('.rona-ar-col.fact').isVisible(),false);
      const comparisonText=await page.locator('.rona-ar-scenarios-table').textContent();
      assert.match(comparisonText,/1 800,0 USD/,'PLAN results retained at '+width);
      assert.match(comparisonText,/1 782,0 USD/,'FACT results retained at '+width);
      if(width===1440||width===1100){
        const tabs=page.locator('.rona-ar-scenario-switch');
        await tabs.getByRole('button',{name:'01 · План'}).click();
        assert.equal(await page.locator('.rona-ar-col.plan').isVisible(),true);
        assert.equal(await page.locator('.rona-ar-col.owner').isVisible(),false);
        await tabs.getByRole('button',{name:'02 · ДДС'}).click();
        assert.equal(await page.locator('.rona-ar-col.fact').isVisible(),true);
        await tabs.getByRole('button',{name:'03 · Собственник'}).click();
        assert.equal(await page.locator('.rona-ar-col.owner').isVisible(),true);
      }
      const detailsButton=page.locator('.rona-ar-col.owner .rona-ar-owner-adjustment .rona-ar-details-btn');
      const settlementDialog=page.locator('.rona-ar-settlement-dialog');
      await detailsButton.click();
      assert.equal(await settlementDialog.evaluate(n=>n.open),true,'Details opens a native modal at '+width);
      assert.equal(await settlementDialog.locator('.rona-ar-settlement-dialog-title').textContent(),'Детали корректировки');
      assert.equal(await settlementDialog.locator('.rona-ar-balance-row').count(),3,'Only classified source-backed balance rows in Details at '+width);
      const detailTypes=await settlementDialog.locator('.rona-ar-balance-row .rona-ar-chip').allTextContents();
      assert.deepEqual(detailTypes,['Аванс','КЗ','ДЗ'],'Types derive from balance_type, never TO_VERIFY status at '+width);
      const detailsText=await settlementDialog.textContent();
      assert.match(detailsText,/QA Supplier/);
      assert.match(detailsText,/300,0 USD/);
      assert.doesNotMatch(detailsText,/ПРОВЕРИТЬ|Требует проверки|САЛЬДО|QA Uncategorized/);
      assert.equal(await settlementDialog.locator('.rona-ar-balance-row .rona-ar-balance-status').count(),0,
        'No technical verification state under balances at '+width);
      assert.equal(await settlementDialog.locator('.rona-ar-balances-note').count(),0,'No explanatory footnotes in Details at '+width);
      const modalFits=await settlementDialog.evaluate(d=>{const r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1});
      assert.equal(modalFits,true,'Modal must fit viewport at '+width);
      if(width===1440)await settlementDialog.locator('.rona-ar-details-close').click();
      else await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('.rona-ar-settlement-dialog')?.open);
      assert.equal(await detailsButton.evaluate(n=>document.activeElement===n),true,'Focus returns to Details button at '+width);
      if(width===1440){
        deal.cashFlow.realizedFxReference=null;
        await page.evaluate(()=>window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__());
        await page.waitForFunction(()=>!document.querySelector('[data-rona-ar-fx-reference]'));
        assert.equal(await page.locator('[data-rona-ar-fx-reference]').count(),0,'Absent/unapproved FX must not be fabricated as zero');
        assert.equal(await page.locator('.rona-ar-pnl-grid .rona-ar-row').filter({hasText:'Реализованный FX'}).count(),0,
          'FX reference must not return to table when source becomes unavailable');
        assert.equal(await page.locator('[data-owner-computed="agentReward"] .rona-ar-value').textContent(),
          '+178,2 USD','Internal owner reward remains based on after-tax profit without realized FX');
      }
      if(width===1440){
        // Positive displayed adjustment = extra expense; negative displayed adjustment = income.
        // Persisted Finance source sign stays the opposite, preserving historical audit.
        deal.ownerCorrectionAuthority.status='APPROVED_FOR_OWNER_CORRECTION';
        await page.evaluate(()=>window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__());
        const adjust=page.locator('[data-owner-key="openSettlementAdjustment"]');
        await page.waitForFunction(()=>!document.querySelector('[data-owner-key="openSettlementAdjustment"]').disabled);
        await adjust.fill('200');
        const afterPositive=await page.evaluate(()=>{
          const labels=['Доходы','Расходы','Прибыль до налогообложения','Налоги и платежи (10%)','Чистая прибыль','Агентское вознаграждение'];
          const rows=[...document.querySelectorAll('.rona-ar-col.owner .rona-ar-row')];
          return Object.fromEntries(labels.map(label=>{
            const row=rows.find(x=>x.querySelector('.rona-ar-name')?.firstChild?.textContent===label);
            return[label,row?.querySelector('.rona-ar-value')?.textContent||null]
          }))
        });
        assert.equal(afterPositive['Доходы'],'5 000,0 USD');
        assert.equal(afterPositive['Расходы'],'3 220,0 USD');
        assert.equal(afterPositive['Прибыль до налогообложения'],'+1 780,0 USD');
        assert.equal(afterPositive['Налоги и платежи (10%)'],'178,0 USD');
        assert.equal(afterPositive['Чистая прибыль'],'+1 602,0 USD');
        assert.equal(afterPositive['Агентское вознаграждение'],'+160,2 USD');
        assert.equal(await page.locator('.rona-ar-metric.owner-net-profit .rona-ar-metric-value').textContent(),'1 602,0 USD',
          'Top net-profit KPI must track OWNER result during positive draft expense');
        assert.equal(await page.locator('.rona-ar-metric.owner-calculated-reward .rona-ar-metric-value').textContent(),'160,2 USD',
          'Agent KPI uses matching OWNER after-tax basis');
        assert.equal(await page.locator('.rona-ar-cascade-row.final .rona-ar-cascade-value').textContent(),'+1 441,8 USD',
          'Financial cascade tracks the same unsaved OWNER draft as management KPI');
        assert.equal(await page.locator('[data-rona-owner-scenario="netProfit"]').textContent(),'+1 602,0 USD','Unsaved positive edit updates compare table');
        assert.equal(await page.locator('.rona-ar-compare-cell.delta .rona-ar-compare-value').textContent(),'-198,0 USD',
          'Owner-versus-plan comparison is live and does not create an external payable');
        await adjust.fill('-50');
        const afterNegative=await page.evaluate(()=>{
          const labels=['Доходы','Расходы','Прибыль до налогообложения','Налоги и платежи (10%)','Чистая прибыль','Агентское вознаграждение'];
          const rows=[...document.querySelectorAll('.rona-ar-col.owner .rona-ar-row')];
          return Object.fromEntries(labels.map(label=>{
            const row=rows.find(x=>x.querySelector('.rona-ar-name')?.firstChild?.textContent===label);
            return[label,row?.querySelector('.rona-ar-value')?.textContent||null]
          }))
        });
        assert.equal(afterNegative['Доходы'],'5 050,0 USD');
        assert.equal(afterNegative['Расходы'],'3 020,0 USD');
        assert.equal(afterNegative['Прибыль до налогообложения'],'+2 030,0 USD');
        assert.equal(afterNegative['Налоги и платежи (10%)'],'203,0 USD');
        assert.equal(afterNegative['Чистая прибыль'],'+1 827,0 USD');
        assert.equal(afterNegative['Агентское вознаграждение'],'+182,7 USD');
        assert.equal(await page.locator('.rona-ar-metric.owner-net-profit .rona-ar-metric-value').textContent(),'1 827,0 USD',
          'Negative adjustment must update OWNER net profit KPI immediately');
        assert.equal(await page.locator('.rona-ar-metric.owner-calculated-reward .rona-ar-metric-value').textContent(),'182,7 USD',
          'Corrected OWNER basis must update agent KPI');
        assert.equal(await page.locator('[data-rona-owner-scenario="netProfit"]').textContent(),'+1 827,0 USD','Unsaved negative edit updates compare table');
        // Previously saved +125 source means income; it must display -125
        // without changing the approved source amount or recalculated profit.
        deal.ownerCorrection={
          version:1,createdAt:'2026-10-14T00:00:00Z',
          payload:{openSettlementAdjustment:125,paymentLineAmounts:{}}
        };
        await page.evaluate(()=>window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__());
        const storedSign=await page.evaluate(()=>({
          visible:document.querySelector('[data-owner-key="openSettlementAdjustment"]')?.value,
          income:[...document.querySelectorAll('.rona-ar-col.owner .rona-ar-row')]
            .find(x=>x.querySelector('.rona-ar-name')?.firstChild?.textContent==='Доходы')
            ?.querySelector('.rona-ar-value')?.textContent,
          expenses:[...document.querySelectorAll('.rona-ar-col.owner .rona-ar-row')]
            .find(x=>x.querySelector('.rona-ar-name')?.firstChild?.textContent==='Расходы')
            ?.querySelector('.rona-ar-value')?.textContent
        }));
        assert.equal(storedSign.visible,'-125.0','Source +125 must display as -125 income adjustment');
        assert.equal(storedSign.income,'5 125,0 USD','Historical saved income must be unchanged');
        assert.equal(storedSign.expenses,'3 020,0 USD','Historical saved income must not become an expense');
        assert.equal(await page.locator('.rona-ar-metric.owner-net-profit .rona-ar-metric-value').textContent(),'1 894,5 USD',
          'Persisted OWNER net profit (1980+125-10%) must override unchanged FACT cash KPI');
        assert.match(await page.locator('.rona-ar-deal .rona-ar-deal-result').textContent(),/1 894,5 USD/,
          'Deal selector net profit must also derive from saved OWNER actual result');
        delete deal.ownerCorrection;
        deal.ownerCorrectionAuthority.status='NOT_APPROVED';

        // Regression: 009 has Finance+Ops approved management PLAN, but NO linked
        // signed per-deal payable term. Forecast PLAN only; actual reward stays gated.
        delete deal.agentTerm;
        deal.planAuthority={financeProposalRecordId:'FINANCE-APPROVED-QA',operationsApprovalRecordId:'OPS-APPROVED-QA'};
        deal.planInputs.agentPlan={mode:'PERCENT',rate:0.5,authority:'MANAGEMENT_PLAN_MODEL_ONLY_NOT_EXTERNAL_PAYABLE_AUTHORITY'};
        deal.planInputs.agentRewardStatus='APPROVED_FINANCE_PLAN_PERCENT';
        await page.evaluate(()=>window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__());
        assert.equal(await page.locator('.rona-ar-metric.agent-primary .rona-ar-metric-value').textContent(),'900,0 USD',
          '009 management PLAN must use authorized projected 50% only, not a made-up payable');
        assert.equal(await page.locator('.rona-ar-col.plan .rona-ar-reward-focus .rona-ar-value').textContent(),'900,0 USD');
        assert.equal(await page.locator('.rona-ar-col.owner .rona-ar-reward-focus .rona-ar-value').textContent(),'Расчёт ожидает проверки',
          'A missing deal term must be described precisely, not as no agent/contract');
        assert.equal(await page.locator('.rona-ar-metric.owner-calculated-reward .rona-ar-metric-value').textContent(),'Расчёт ожидает проверки');
        assert.equal(await page.locator('.rona-ar-col.fact .rona-ar-reward-focus .rona-ar-value').textContent(),'Расчёт ожидает проверки');
        assert.equal(await page.locator('.rona-ar-evidence').count(),0,'Do not show technical evidence panel for any deal');
        assert.match(await page.locator('.rona-ar-cascade-row.agent .rona-ar-cascade-value').textContent(),/Расчёт ожидает проверки/);
        assert.equal(await page.locator('.rona-ar-cascade-row.agent .rona-ar-cascade-bar').count(),0,
          'Never plot an external agent liability without a verified term');

        // Regression: 010 has a Finance-approved NONE plan because DS4 was
        // invalidated. Respect the zero PLAN forecast, but never invent a current term.
        deal.planInputs.agentPlan={mode:'NONE',rate:0,authority:'DS4_INVALIDATED_BY_CURRENT_DS5'};
        deal.planInputs.agentRewardStatus='APPROVED_PLAN_NO_CURRENT_EFFECTIVE_TERM';
        await page.evaluate(()=>window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__());
        assert.equal(await page.locator('.rona-ar-metric.agent-primary .rona-ar-metric-value').textContent(),'0,0 USD',
          '010 approved current Finance PLAN shows zero only as a management plan');
        assert.equal(await page.locator('.rona-ar-col.owner .rona-ar-reward-focus .rona-ar-value').textContent(),'Расчёт ожидает проверки',
          '010 external agent calculation must stay gated without current effective DS');

        // Regression: 011 has a signed DS5 50% term, but payable awaits closing.
        // Internal management after-tax estimate must calculate before final closure.
        deal.agentTerm={mode:'PERCENT',status:'ACTIVE',lifecycleState:'ACTIVE',
          authorityState:'CONFIRMED',rate:0.5,reference:'50% margin after FINAL LOADING AND CLOSING DOCUMENTS'};
        deal.businessStatus='REGISTERED';
        deal.planInputs.agentPlan={mode:'PERCENT',rate:0.5,authority:'SIGNED_CURRENT_DS5_PLAN_PROJECTION_NOT_PAYABLE_STATE'};
        deal.planInputs.agentRewardStatus='APPROVED_FINANCE_PLAN_PERCENT';
        await page.evaluate(()=>window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__());
        assert.equal(await page.locator('.rona-ar-metric.agent-primary .rona-ar-metric-value').textContent(),'900,0 USD');
        assert.equal(await page.locator('.rona-ar-metric.owner-calculated-reward .rona-ar-metric-value').textContent(),'891,0 USD',
          '011 provisional 50% OWNER estimate calculates before closing, not an external payable');
        assert.equal(await page.locator('.rona-ar-col.owner .rona-ar-reward-focus .rona-ar-value').textContent(),'+891,0 USD');
        assert.equal(await page.locator('.rona-ar-col.owner .rona-ar-reward-focus .rona-ar-name').getAttribute('title'),
          'Вознаграждение по действующему ДС',
          'Show a readable basis in the Owner UI, never internal status codes');
        assert.equal(await page.locator('.rona-ar-btn.send').isDisabled(),true,
          'A management projection must never enable an external payable or agent send');
        assert.equal(await page.locator('.rona-ar-evidence').count(),0,'Technical explanation panel must remain hidden');
        assert.equal(await page.locator('.rona-ar-evidence').count(),0,'Technical explanation panel must remain hidden');
        assert.equal(await page.locator('.rona-ar-cascade-row.agent .rona-ar-cascade-bar').count(),1,
          'Internally calculable management estimate remains visually distinguishable from payable authority');
      }
      if(width===950){
        const formerRevenue=deal.planInputs.revenue,oldCash=deal.cashFlow.cashReceived,
          oldDds=deal.cashFlow.netCashFlow;
        deal.planInputs.revenue=100;
        deal.cashFlow.cashReceived=100;
        deal.cashFlow.netCashFlow=-2920;
        await page.evaluate(()=>window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__());
        const negative=await page.evaluate(()=>{
          return Object.fromEntries(['plan','fact','owner'].map(k=>{
            const rows=[...document.querySelectorAll('.rona-ar-col.'+k+' .rona-ar-row')];
            const value=label=>rows.find(r=>r.querySelector('.rona-ar-name')?.firstChild?.textContent===label)?.querySelector('.rona-ar-value')?.textContent||'';
            return[k,{preTax:value('Прибыль до налогообложения'),tax:value('Налоги и платежи (10%)'),net:value('Чистая прибыль'),agent:value('Агентское вознаграждение')}]
          }))
        });
        for(const [k,row] of Object.entries(negative)){
          assert.match(row.preTax,/^[−-]/,'Negative pre-tax value must be negative at '+k);
          assert.equal(row.tax,'0,0 USD','Negative profits do not generate fictional tax refunds at '+k);
          assert.match(row.net,/^[−-]/,'Net profit must remain a loss at '+k);
          assert.equal(row.agent,'0,0 USD','No positive agent percentage on a loss at '+k);
        }
        deal.planInputs.revenue=formerRevenue;
        deal.cashFlow.cashReceived=oldCash;
        deal.cashFlow.netCashFlow=oldDds;
      }
      if(width===1920){
        const second=structuredClone(deal);
        second.assignmentId='VISUAL-QA-SECOND';
        second.dealId='VISUAL-QA-SECOND-DEAL';
        second.clientName='Второй контрагент';
        second.agentName='Второй агент';
        delete second.agentTerm;
        data.data.deals.push(second);
        await page.evaluate(()=>window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__());
        assert.equal(await page.locator('.rona-ar-deal').count(),2,'Real sidebar must list both scoped deals');
        const dealSearch=page.locator('.rona-ar-search');
        await dealSearch.fill('Второй контрагент');
        assert.equal(await page.locator('.rona-ar-deal:visible').count(),1,'Search filters clients');
        assert.equal(await page.locator('.rona-ar-deal:visible').first().getAttribute('data-rona-ar-deal-select'),'VISUAL-QA-SECOND::VISUAL-QA-SECOND-DEAL');
        await dealSearch.fill('');
        assert.equal(await page.locator('.rona-ar-deal:visible').count(),2);
        assert.equal(await page.locator('.rona-ar-deal[aria-pressed="true"]').count(),1);
        await page.locator('[data-rona-ar-deal-select="VISUAL-QA-SECOND::VISUAL-QA-SECOND-DEAL"]').click();
        assert.equal(await page.locator('.rona-ar-focus-title').textContent(),'Второй контрагент');
        assert.equal(await page.locator('[data-rona-ar-deal-select="VISUAL-QA-SECOND::VISUAL-QA-SECOND-DEAL"]').getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('.rona-ar-evidence').count(),0,'Technical explanation panel must remain hidden');
        assert.equal(await page.locator('.rona-ar-cascade-row.agent .rona-ar-cascade-bar').count(),0);
        assert.equal(await page.locator('.rona-ar-cascade-row.final .rona-ar-cascade-bar').count(),0,
          'Switching to a deal without a signed term must not show fabricated net payout result');
        await page.locator('[data-rona-ar-deal-select="VISUAL-QA-ONLY::VISUAL-QA-DEAL"]').click();
        assert.equal(await page.locator('.rona-ar-focus-title').textContent(),'Контрагент');
        assert.equal(await page.locator('.rona-ar-deal[aria-pressed="true"]').count(),1);
        data.data.deals.pop()
      }
      assert.deepEqual(errors,[],'No runtime exceptions at '+width);
      assert(!calls.some(v=>!v.startsWith('GET ')),'Read-only visual QA must never POST anything');
      await page.close()
    }
  }finally{await browser.close()}
});


test('One signed DS per deal, no archive or replacement controls, and act tied to saved Owner source across desktop and mobile',async()=>{
  const {chromium}=await import('playwright');
  const script=await(await onRequest()).text();
  const dealId='DEAL-2026-004',assignmentId='11111111-1111-4111-8111-111111111111';
  const deal={
    dealId,assignmentId,clientName:'QA Покупатель',agentName:'Представитель агента',
    agentLegalEntityId:'S-005',agentLegalName:'ООО «ИнКом»',
    businessStatus:'ACTIVE',receiptCurrency:'USD',financialCurrency:'USD',
    cashFlow:{status:'APPROVED_CASH_FLOW_DDS',currency:'USD',cashReceived:5000,
      counterpartyCashOut:3000,bankFees:20,netCashFlow:1980},
    financeSourceReconciliation:{status:'RECONCILED_CURRENT_FINANCE_V8'},
    cashPaymentLines:[{paymentId:'PAYMENT-1',counterparty:'Подтверждённый поставщик',
      canonicalCounterpartyId:'SUPPLIER:QA',counterpartyResolutionStatus:'RESOLVED',
      amount:3000,currency:'USD'}],
    ownerResultBridge:{recognition_status:'APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE',
      open_settlement_adjustment:{amount:0}},
    ownerCorrectionAuthority:{status:'APPROVED_FOR_OWNER_CORRECTION',
      contract:'PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT'},
    ownerCorrection:{version:3,createdAt:'2026-10-14T12:00:00.000Z',
      payload:{paymentLineAmounts:{},openSettlementAdjustment:0}},
    agentTerm:{mode:'PERCENT',rate:0.5,status:'ACTIVE',lifecycleState:'ACTIVE',
      authorityState:'CONFIRMED',reference:'Addendum 2'}
  };
  const doc={
    dealId,assignmentId,agentCompanyId:'S-005',agentLegalName:'ООО «ИнКом»',
    agentName:'Представитель агента',assignmentStatus:'ACTIVE',
    term:null,
    ownerConfirmedTerm:{mode:'PERCENT',rate:0.5,basis:'SHIPMENT_MARGIN',paymentCurrency:'RUB',status:'SIGNED_SOURCE_TEXT_PENDING_FINANCE_LEGAL'},
    sourceReadiness:{termAligned:false,accountingStatus:'OPEN',rule:'DS1_50_PERCENT_SHIPMENT_MARGIN_RUB'},
    currentAddendum:{bindingId:'b1111111-1111-4111-8111-111111111111',
      documentId:'AGENCY-S-005-A1B2C3D4',filename:'Signed_QA.pdf',
      reference:'ДС №1 от 15.07.2026',evidenceStatus:'RECEIVED_NOT_LEGALLY_VERIFIED',ownerApprovedByUpload:true,sha256:'e12c2e1f7527ed58a07e081396be9d2b51401d42558be8b3ba7c7be5e9431bab'},
    ownerCorrection:{sourceId:'c1111111-1111-4111-8111-111111111111',version:3},
    acts:[]
  };
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [1440,390]){
      doc.acts=[];
      const page=await browser.newPage({viewport:{width,height:1000}});
      const errors=[],mutations=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('http://rona.docs/portal/admin',r=>r.fulfill({
        status:200,contentType:'text/html',
        body:'<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><main id="page-agent-settlements" class="page active" style="padding:10px"></main></body></html>'}));
      await page.route('http://rona.docs/portal/owner-api**',r=>{
        const input=r.request().method()==='POST'
          ?JSON.parse(r.request().postData()||'{}'):null;
        const data=input?{accepted:true,dealId,assignmentId,version:3,
          correctedPayload:input.correctedPayload}:{deals:[deal]};
        return r.fulfill({status:200,contentType:'application/json',
          body:JSON.stringify({ok:true,data})});
      });
      await page.route('http://rona.docs/portal/agent-reward-workflow**',async r=>{
        const u=new URL(r.request().url()),action=u.searchParams.get('action')||'state';
        if(action==='request-act'&&r.request().method()==='POST'){
          mutations.push({action});
          const snapshot=JSON.parse(r.request().postData()||'{}').ownerApprovedCalculation;
          assert.equal(snapshot?.contract,'OWNER_SECTION_SAVED_CALCULATION_V1');
          assert.equal(snapshot?.correctionVersion,3);
          assert.equal(snapshot?.dealId,dealId);
          assert.equal(snapshot?.assignmentId,assignmentId);
          assert.equal(snapshot?.reward,990);
          doc.acts=[{id:'a1111111-1111-4111-8111-111111111111',
            ownerCalculationStored:true,ownerCalculationVersion:3,correction_version:3,
            owner_correction_key:doc.ownerCorrection.sourceId,request_status:'REVIEW_REQUESTED',
            review:{finance:{status:'PENDING'},legal:{status:'PENDING'},approved:false},
            documents:[],addendum_key:doc.currentAddendum.bindingId,
            readiness:{readyForFinalAct:false,missing:['FINANCE_TERM_NOT_ALIGNED_WITH_SIGNED_DS','FINANCE_CONCLUSION_REQUIRED','ACCOUNTING_CLOSURE_REQUIRED']}}];
        }
        await r.fulfill({status:200,contentType:'application/json',
          body:JSON.stringify({ok:true,data:action==='request-act'?
            {requestId:doc.acts[0].id,status:'REVIEW_REQUESTED',ownerCalculationStored:true}:
            doc})})
      });
      await page.goto('http://rona.docs/portal/admin');
      await page.addScriptTag({content:script});
      const box=page.locator('.rona-ar-documents');
      await box.getByText('ООО «ИнКом»').waitFor({timeout:12000});
      assert.equal(await box.locator('input[type=file]').count(),0);
      assert.equal(await box.getByRole('button',{name:'Скачать ДС'}).count(),1);
      assert.equal(await box.getByText('ДС загружено и привязано к сделке').count(),1);
      assert.equal(await box.getByRole('button',{name:'Акт сверки · СГ-Транс'}).count(),0);
      assert.doesNotMatch(await page.locator('.rona-ar').innerText(),/Основание и статус расчёта|Важно: расчёт PLAN/);
      assert.equal(await box.getByText('50% от маржи по поставке (ДС №1)').count(),1);
      assert.match(await box.innerText(),/По сохранённому расчёту:/);
      assert.match(await page.locator('.rona-ar-col.owner').innerText(),/990,0\s*USD/);
      assert.doesNotMatch(await box.innerText(),/Предварительно:\s*891/);
      assert.doesNotMatch(await page.locator('.rona-ar').innerText(),
         /ДС не привязано|Основание и статус расчёта/);
      assert.equal(await box.getByRole('button',{name:'Загрузить ДС'}).count(),0);
      assert.equal(await box.getByRole('button',{name:'Подготовить акт'}).count(),0);
      assert.equal(await page.getByRole('button',{name:'Акт выполненных работ',exact:true}).count(),0);
      const notice=page.locator('.rona-admin-dialog-backdrop');
      if(await notice.count())await notice.last().getByRole('button',{name:'Закрыть'}).click();
      const requestSeen=page.waitForRequest(req=>
        req.method()==='POST'&&req.url().includes('action=request-act'),{timeout:10000});
      await page.locator('.rona-ar-col.owner').getByRole('button',{name:'Сохранить корректировку'}).click();
      await requestSeen;
      await box.getByText('Корректировка №3 сохранена.').waitFor({timeout:7000});
      assert.equal(await box.getByRole('button',{name:'Сформировать и скачать акт'}).count(),1);
      assert.deepEqual(mutations.map(x=>x.action),['request-act'],
        'Saving a correction creates an Act request once; missing approval must not trigger false signed-PDF issuance');
      const visible=await box.innerText();
      assert.doesNotMatch(visible,/REVIEW_REQUESTED|Finance: PENDING|Legal: PENDING|OWNER №|TO_VERIFY|sourceId|FINANCE_TERM_NOT_ALIGNED_WITH_SIGNED_DS/);
      assert.equal(await box.getByRole('button',{name:'Загрузить PDF'}).count(),0);
      assert.equal(await box.getByRole('button',{name:'Открыть проект акта · печать в PDF'}).count(),0);
      assert.equal(await box.getByRole('button',{name:'Скачать акт (PDF)'}).count(),0);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert(overflow<=2,'Agent documentation overflows '+width+'px viewport by '+overflow);
      assert.deepEqual(errors,[]);
      await page.close()
    }
  }finally{await browser.close()}
});


test('Owner Finance Console v2 compares source-locked scenarios with live OWNER preview and accessible detail',async()=>{
  const js=await(await onRequest()).text();
  for(const phrase of [
    'function scenarioComparisonRows(deal,ownerDraft=null)',
    'function renderScenarioComparison(root,deal)',
    'function updateScenarioComparisonForDraft(col,deal,draft)',
    'updateScenarioComparisonForDraft(col,deal,preview)',
    'renderScenarioDetails(root,grid)',
    'function installAgentRewardsRefinedStyle()',
    "const searchField=el('label','rona-ar-search-field')",
    "root.dataset.ronaAgentRewardsConsole='owner-finance-v2'",
    'Сравнение финансовых сценариев выбранной сделки'
  ])assert.ok(js.includes(phrase),'Missing '+phrase);
  assert.ok(js.includes('p=planModel(deal),f=cashFactModel(deal),fp=factManagementModel(deal,f)'));
  assert.ok(js.includes('state.searchQuery=search.value'));
});


test('Signed agency DS source isolation: 005 mismatched term, 006 unbound, 010/011 no current term',async()=>{
  const {chromium}=await import('playwright');
  const js=await(await onRequest()).text();
  const assignmentId='11111111-1111-4111-8111-111111111111';
  const cases=[
    {dealId:'DEAL-2026-005',doc:'ДС №2 от 12.08.2026',term:'Agency Contract 351C/2026 / Addendum 3 dated 2026-08-12',
      expect:'Ссылка на расчётное условие указывает Addendum/ДС №3',kpi:'ДС загружено, но условие не совпадает'},
    {dealId:'DEAL-2026-006',doc:null,term:'Agency Contract 351C/2026 / Addendum 3 dated 2026-08-12',
      expect:'Есть расчётное условие, но связанный подписанный агентский документ отсутствует',kpi:'Нет агентского ДС по сделке'},
    {dealId:'DEAL-2026-010',doc:'ДС №4 от 02.09.2026',term:null,
      expect:'Для текущего назначения агента действующее связанное условие вознаграждения отсутствует',kpi:'ДС загружено, но условие не совпадает'},
    {dealId:'DEAL-2026-011',doc:'ДС №5 от 15.09.2026',term:null,
      expect:'Не переносим условие со старого назначения автоматически',kpi:'ДС загружено, но условие не совпадает'}
  ];
  const browser=await chromium.launch({headless:true});
  try{
    for(const item of cases){
      const deal={
        dealId:item.dealId,assignmentId,clientName:'Контрольный клиент',agentName:'Артем Белов',
        agentLegalEntityId:'S-005',businessStatus:'EXECUTING',financialCurrency:'USD',receiptCurrency:'USD',
        planInputs:{revenue:5000,expenseKnownTotal:3000,revenueStatus:'APPROVED_FINANCE_MANAGEMENT_PLAN',
          expenseStatus:'APPROVED_FINANCE_MANAGEMENT_PLAN'},
        cashFlow:{status:'APPROVED_CASH_FLOW_DDS',currency:'USD',
          cashReceived:5000,counterpartyCashOut:3000,bankFees:20,netCashFlow:1980},
        financeSourceReconciliation:{status:'RECONCILED_CURRENT_FINANCE_V8'},
        cashPaymentLines:[{paymentId:'SOURCE-1',counterparty:'Контрагент',canonicalCounterpartyId:'SUPPLIER:QA',
          counterpartyResolutionStatus:'RESOLVED',amount:3000,currency:'USD'}],
        ownerResultBridge:{recognition_status:'APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE',
          open_settlement_adjustment:{amount:0}},
        ownerCorrectionAuthority:{status:'APPROVED_FOR_OWNER_CORRECTION',
          contract:'PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT'},
        ...(item.term?{agentTerm:{mode:'PERCENT',rate:0.5,status:'ACTIVE',lifecycleState:'ACTIVE',
          authorityState:'CONFIRMED',reference:item.term}}:{})
      };
      const doc={
        dealId:item.dealId,assignmentId,agentCompanyId:'S-005',agentLegalName:'ООО «ИнКом»',
        term:item.term?{termId:'11111111-1111-4111-8111-222222222222',
          mode:'PERCENT',rate:0.5,reference:item.term}:null,
        sourceReadiness:{termAligned:false,ownerApprovedByUpload:true,accountingStatus:'OPEN'},
        currentAddendum:item.doc?{bindingId:'11111111-1111-4111-8111-333333333333',
          reference:item.doc,documentId:'AGENCY-S-005-1234ABCD',
          ownerApprovedByUpload:true,sha256:'0'.repeat(64),evidenceStatus:'RECEIVED_NOT_LEGALLY_VERIFIED'}:null,
        ownerCorrection:null,acts:[]
      };
      const page=await browser.newPage({viewport:{width:1100,height:950}});
      const post=[];
      page.on('request',r=>{if(r.method()!=='GET')post.push(r.method()+' '+r.url())});
      await page.route('http://rona.source/portal/admin',r=>r.fulfill({
        status:200,contentType:'text/html',
        body:'<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><main id="page-agent-settlements" class="page active"></main></body></html>'}));
      await page.route('http://rona.source/portal/owner-api**',r=>r.fulfill({
        status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{deals:[deal]}})}));
      await page.route('http://rona.source/portal/agent-reward-workflow**',r=>r.fulfill({
        status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:doc})}));
      await page.goto('http://rona.source/portal/admin');
      await page.addScriptTag({content:js});
      const diagnostic=page.locator('.rona-ar-doc-source-diagnostic');
      await diagnostic.waitFor({timeout:10000});
      assert.match(await diagnostic.textContent(),new RegExp(item.expect),'Exact source reason '+item.dealId);
      assert.match(await page.locator('.rona-ar-metric.owner-calculated-reward .rona-ar-metric-value').textContent(),
        new RegExp(item.kpi),'No unsupported reward at '+item.dealId);
      assert.equal(await page.locator('.rona-ar-scenarios-table [data-rona-owner-scenario="agentReward"]').textContent(),
        'TO_VERIFY','Unknown agent amount is not zero or an old assignment amount');
      assert.deepEqual(post,[],'Source inspection is read only');
      await page.close();
    }
  }finally{await browser.close()}
});
