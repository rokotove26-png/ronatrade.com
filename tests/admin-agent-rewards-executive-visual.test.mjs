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
      taxesAndPaymentsStatus:'TO_VERIFY_PLAN_TAX_STATUS',fxStatus:'TO_VERIFY_PLAN_FX_STATUS'
    },
    cashFlow:{status:'APPROVED_CASH_FLOW_DDS',currency:'USD',cashReceived:5000,counterpartyCashOut:3000,bankFees:20,netCashFlow:1980,realizedFxReference:10},
    cashPaymentLines:[{paymentId:'VISUAL-QA-PAYMENT',counterparty:'Поставщик',amount:3000,currency:'USD',nativeAmount:3000,nativeCurrency:'USD',authorityStatus:'APPROVED_PAYMENT_FACT'}],
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
        return {version:window.__RONA_AGENT_REWARDS_PRESENTATION__,names,values,sections,
          gridColumns:grid.gridTemplateColumns,nameFont,valueFont,columns:cols.map(el=>el.getBoundingClientRect().toJSON()),
          technicalCount:technical.length,hasHiddenTech:!!source&&!source.open,
          summary:first?.textContent,displayTechnical:source?.open??null,
          inputExists:!!inp,inputDisabled:inp?.disabled,inputCurrency:unit?.textContent,
          width:root.getBoundingClientRect().width,scrollWidth:root.scrollWidth,visibleRewardRow:!!root.querySelector('.rona-ar-reward-focus')
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
      assert.equal(result.values[1],'400,0 USD','Owner-derived fixed term is NOT paid amount at '+width);
      assert.equal(result.values[3],'1 980,0 USD'.replace(/\u00a0/g,' '),'Fact value must retain canonical numeric formatting');
      assert.deepEqual(result.sections,['Ожидаемый результат','ДДС по сделке','Фактический результат']);
      assert(result.technicalCount>=1&&result.hasHiddenTech,'Source code must be disclosed, not displayed by default');
      assert.equal(result.summary,'Источник и статус');
      assert(result.nameFont>=12&&result.valueFont>=14,'Financial primary type is too small at '+width);
      assert(result.visibleRewardRow,'Reward rows must have visible priority at '+width);
      assert(result.inputExists&&result.inputCurrency==='USD','Currency displayed beside editable numeric amount');
      assert.equal(result.inputDisabled,true,'Unauthorized test must not unlock owner correction');
      assert(result.width<=width+1,'Root panel must fit browser viewport');
      if(width>=1600)assert(result.columns[1].x>result.columns[0].x,'Wide view: 3 comparable columns');
      if(width>=1070&&width<=1550)assert(result.columns[2].y>result.columns[0].y,'Medium view: owner receives readable second row');
      if(width<1070)assert(result.columns[1].y>result.columns[0].y,'Narrow view: one column');
      await page.locator('.rona-ar-disclosure summary').first().click();
      const isOpen=await page.locator('.rona-ar-disclosure').first().evaluate(n=>n.open);
      assert(isOpen,'Source details must be keyboard/mouse accessible');
      assert.deepEqual(errors,[],'No runtime exceptions at '+width);
      assert(!calls.some(v=>!v.startsWith('GET ')),'Read-only visual QA must never POST anything');
      await page.close()
    }
  }finally{await browser.close()}
});
