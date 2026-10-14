import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../functions/portal/agent-rewards-v1-ui.js';

const file=readFileSync(new URL('../functions/portal/agent-rewards-v1-ui.js',import.meta.url),'utf8');

test('Executive presentation changes no financial authority, formulas, API or session handling',async()=>{
  const js=await(await onRequest()).text();
  assert.match(js,/__RONA_AGENT_REWARDS_PRESENTATION__='executive-finance-v1'/);
  assert.match(js,/function financeMetaNode\(value/);
  assert.match(js,/function renderDealPulse\(root,deal\)/);
  assert.match(js,/function renderFxReference\(root,deal\)/);
  assert.match(js,/renderFxReference\(root,deal\)/);
  assert.match(js,/r\.dataset\.financeMeaning=financeMeaning\(label\)/);
  assert.doesNotMatch(js,/Реализованный FX · справочно/);
  assert.match(js,/РАСЧЁТ · агентское вознаграждение/);
  assert.match(js,/Расчётное вознаграждение не означает произведённую выплату/);
  assert.match(js,/function termReward\(deal/);
  assert.match(js,/Math\.max\(0,basis\)\*num\(t\.rate\)/);
  assert.match(js,/function ownerModel\(deal,fact\)/);
  assert.match(js,/netCashFlow\+openSettlementAdjustment/);
  assert.match(js,/await saveCorrection\(deal\.dealId,deal\.assignmentId,payload,ta\.value\)/);
  assert.match(js,/payload=\{paymentLineAmounts:m\.paymentLineAmounts,openSettlementAdjustment:m\.openSettlementAdjustment\}/);
  assert.match(file,/minimumFractionDigits:1,maximumFractionDigits:1/);
  assert.match(file,/function ownerCorrectionApproved\(deal\)/);
  assert.match(file,/send\.disabled=true/);
  assert.match(file,/\.rona-ar-canonical-head \.rona-visual-title\{position:relative;margin:0;color:#f7fbff;font-size:clamp\(31px,3\.25vw,48px\)/);
  assert.doesNotMatch(js,/function.*new.*finance.*schema|fetch\(['"]https?:\/\//i);
});

test('Real executable Agent Rewards UI: agent-first hierarchy, sources hidden on demand, legibility and responsive grid',async()=>{
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
    settlementPositions:[]
  };
  const data={ok:true,data:{deals:[deal]}};
  const markup='<!doctype html><html lang="ru"><head><meta charset="utf-8"/></head><body>'
    +'<main id="page-agent-settlements" class="page active" style="padding:20px"></main>'
    +'</body></html>';
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [1750,1440,950,650]){
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
      await page.waitForFunction(()=>document.querySelector('.rona-ar-metric-value')?.textContent.includes('500,0'),{timeout:10000});
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
        const source=technical.find(n=>n.textContent.includes('APPROVED_FINANCE_MANAGEMENT_PLAN'));
        const first=source?.querySelector('summary');
        const inp=root.querySelector('[data-owner-key="openSettlementAdjustment"]');
        const unit=root.querySelector('.rona-ar-input-currency');
        const sections=cols.map(el=>el.querySelector('.rona-ar-col-title')?.textContent);
        const planRows=[...root.querySelectorAll('.rona-ar-col.plan .rona-ar-row')];
        const planNet=planRows.find(el=>el.querySelector('.rona-ar-name')?.textContent==='Итого чистая прибыль');
        const ownerActual=root.querySelector('[data-owner-computed="actualFinancialResult"] .rona-ar-value');
        const ownerReward=root.querySelector('[data-owner-computed="agentReward"] .rona-ar-value');
        const agreementWarning=root.querySelector('.rona-ar-col.owner .rona-ar-agent-contract-flag');
        const factGroupNames=[...root.querySelectorAll('.rona-ar-col.fact .rona-ar-exp-name')].map(n=>n.textContent);
        const ownerGroupNames=[...root.querySelectorAll('.rona-ar-col.owner .rona-ar-exp-name')].map(n=>n.textContent);
        const groupInputs=[...root.querySelectorAll('.rona-ar-col.owner [data-owner-payment-group-key]')];
        const expenseTotal=[...root.querySelectorAll('.rona-ar-col.plan .rona-ar-row')].find(el=>el.querySelector('.rona-ar-name')?.textContent.startsWith('Расходы постатейно'));
        const fx=root.querySelector('[data-rona-ar-fx-reference="1"]');
        const fxValue=fx?.querySelector('.rona-ar-fx-value');
        const fxTableRows=[...root.querySelectorAll('.rona-ar-pnl-grid .rona-ar-row')]
          .filter(n=>n.textContent.includes('Реализованный FX'));
        const valColor=sel=>{
          const n=root.querySelector(sel);
          return n?getComputedStyle(n).color:null
        };
        const meaning=sel=>root.querySelector(sel)?.dataset.financeMeaning||null;
        return {version:window.__RONA_AGENT_REWARDS_PRESENTATION__,names,values,sections,
          gridColumns:grid.gridTemplateColumns,nameFont,valueFont,columns:cols.map(el=>el.getBoundingClientRect().toJSON()),
          hiddenRows:{
            planFx:planRows.filter(el=>el.querySelector('.rona-ar-name')?.textContent==='Курсовая разница').length,
            ownerAgentBasis:root.querySelectorAll('.rona-ar-col.owner [data-owner-computed="agentBasis"]').length,
            planNetValue:planNet?.querySelector('.rona-ar-value')?.textContent,
            ownerActual:ownerActual?.textContent,ownerReward:ownerReward?.textContent,
            contractWarnings:root.querySelectorAll('.rona-ar-col.owner .rona-ar-agent-contract-flag').length,
            warningText:agreementWarning?.textContent||null,
            warningTooltip:agreementWarning?.title||null
          },
          technicalCount:technical.length,hasHiddenTech:!!source&&!source.open,
          summary:first?.textContent,displayTechnical:source?.open??null,
          inputExists:!!inp,inputDisabled:inp?.disabled,inputCurrency:unit?.textContent,
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
          fxPrecedesTables:!!fx&&!!fx.nextElementSibling?.classList.contains('rona-ar-pnl-grid'),
          fxAfterSummary:!!fx&&!!fx.previousElementSibling?.classList.contains('rona-ar-summary-note'),
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
      assert.deepEqual(result.names,[
        'PLAN · агентское вознаграждение',
        'РАСЧЁТ · агентское вознаграждение',
        'PLAN · прибыль RONA',
        'FACT · чистый ДДС'
      ],'Reward first, then owner calculation, profit and cash at '+width);
      assert.equal(result.values[0],'500,0 USD','Plan reward retains exact canonical input at '+width);
      assert.equal(result.values[1],width===650?'400,0 USD':'198,0 USD',
        'Owner calculation uses full actual financial result for confirmed percentage terms at '+width);
      assert.equal(result.hiddenRows.planFx,0,'Plan FX row must not appear at '+width);
      assert.equal(result.hiddenRows.ownerAgentBasis,0,'Separate agent basis row must not appear at '+width);
      assert.equal(result.hiddenRows.planNetValue,'+1 760,0 USD',
        'Hiding Plan FX must not silently change authoritative net profit formula at '+width);
      assert.equal(result.hiddenRows.ownerActual,'+1 980,0 USD',
        'Approved actual financial result is the agent calculation basis at '+width);
      assert.equal(result.hiddenRows.ownerReward,width===650?'+400,0 USD':'+198,0 USD',
        'Owner agent reward must use actual result without subtracting realized FX at '+width);
      assert.equal(result.hiddenRows.contractWarnings,width===650?0:1,
        'Special signed FX-exclusion terms must not silently lose warning at '+width);
      if(width!==650){
        assert.equal(result.hiddenRows.warningText,'Условие FX · сверить договор');
        assert.match(result.hiddenRows.warningTooltip||'',/Внутренняя база — фактический финансовый результат/);
      }
      assert.equal(result.values[3],'1 980,0 USD'.replace(/\u00a0/g,' '),'Fact value must retain canonical numeric formatting');
      assert.deepEqual(result.sections,['Ожидаемый результат','ДДС по сделке','Фактический результат']);
      assert(result.technicalCount>=1&&result.hasHiddenTech,'Source code must be disclosed, not displayed by default');
      assert.equal(result.summary,'Источник и статус');
      assert(result.nameFont>=12&&result.valueFont>=14,'Financial primary type is too small at '+width);
      assert(result.visibleRewardRow,'Reward rows must have visible priority at '+width);
      assert(result.inputExists&&result.inputCurrency==='USD','Currency displayed beside editable numeric amount');
      assert.equal(result.inputDisabled,true,'Unauthorized test must not unlock owner correction');
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
      assert.match(result.ledger.ownerInputTooltip||'',/Незакрытые расчёты/,'Owner correction retains its accessible label at '+width);
      assert.equal(result.fxCount,1,'One FX reference strip, not duplicate rows, at '+width);
      assert.equal(result.fxInsideTables,0,'FX strip must be OUTSIDE finance tables at '+width);
      assert.equal(result.fxRows,0,'Neither FACT nor Owner table may contain realized FX at '+width);
      assert(result.fxPrecedesTables&&result.fxAfterSummary,'FX strip must follow KPI group and precede table columns at '+width);
      assert.match(result.fxNote,/Повторно к Чистому ДДС и финансовому результату не прибавляется/);
      assert.equal(result.fxMeaning,'Валютная справка · реализованный FX');
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
      if(width>=1600)assert(result.columns[1].x>result.columns[0].x,'Wide view: 3 comparable columns');
      if(width>=1070&&width<=1550)assert(result.columns[2].y>result.columns[0].y,'Medium view: owner receives readable second row');
      if(width<1070)assert(result.columns[1].y>result.columns[0].y,'Narrow view: one column');
      await page.locator('.rona-ar-disclosure summary').first().click();
      const isOpen=await page.locator('.rona-ar-disclosure').first().evaluate(n=>n.open);
      assert(isOpen,'Source details must be keyboard/mouse accessible');
      if(width===1440){
        deal.cashFlow.realizedFxReference=null;
        await page.evaluate(()=>window.__RONA_AGENT_REWARDS_FINANCE_REFRESH__());
        await page.waitForFunction(()=>!document.querySelector('[data-rona-ar-fx-reference]'));
        assert.equal(await page.locator('[data-rona-ar-fx-reference]').count(),0,'Absent/unapproved FX must not be fabricated as zero');
        assert.equal(await page.locator('.rona-ar-pnl-grid .rona-ar-row').filter({hasText:'Реализованный FX'}).count(),0,
          'FX reference must not return to table when source becomes unavailable');
        assert.equal(await page.locator('[data-owner-computed="agentReward"] .rona-ar-value').textContent(),
          '+198,0 USD','Internal owner reward basis does not require separate realized-FX reference');
      }
      assert.deepEqual(errors,[],'No runtime exceptions at '+width);
      assert(!calls.some(v=>!v.startsWith('GET ')),'Read-only visual QA must never POST anything');
      await page.close()
    }
  }finally{await browser.close()}
});
