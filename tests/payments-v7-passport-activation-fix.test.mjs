import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  paymentsV7PassportActivationPrelude,
  paymentsV7PassportActivationRuntime,
} from '../functions/portal/main-ui/payments-v7-passport-activation-fix.js';

const listeners = new Map();
const oldTechnicalBody = { kind: 'OLD_TECHNICAL_PASSPORT_BODY' };
const recoveredBody = { kind: 'RECOVERED_FUNDING_FIRST_BODY' };
const passport = { contract: 'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2', funding_currency: 'USD' };
const selectedDeal = {
  deal_key: 'future-key-renderer-activation',
  deal_id: 'FUTURE-DEAL-RENDERER-X91',
  payment_passport: passport,
};
const otherDeal = {
  deal_key: 'other-future-key',
  deal_id: 'FUTURE-DEAL-OTHER-X92',
  payment_passport: { contract: 'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2' },
};

const article = {
  dataset: { dealKey: selectedDeal.deal_key, dealId: selectedDeal.deal_id },
};
const summary = { tag: 'summary', parentElement: null };
const details = {
  open: true,
  dataset: {},
  children: [summary, oldTechnicalBody],
  closest(selector) { return selector === '.rona-payments-v7-deal' ? article : null; },
  querySelector(selector) { return selector === ':scope > summary' || selector === 'summary' ? summary : null; },
  append(node) { this.children.push(node); },
};
summary.parentElement = details;
const clickTarget = {
  closest(selector) { return selector === '.rona-payments-v7-passport > summary' ? summary : null; },
};

const document = {
  createElement(tag) {
    return {
      tag,
      nodeType: 1,
      children: [],
      dataset: {},
      append(...items) { this.children.push(...items); },
      setAttribute(key, value) { this[key] = value; },
      addEventListener() {},
    };
  },
  createTextNode(text) { return { nodeType: 3, text: String(text) }; },
  addEventListener(type, handler) { listeners.set(type, handler); },
};

const sandbox = {
  console,
  Intl,
  Number,
  Array,
  String,
  Object,
  document,
  window: {
    __RONA_OWNER_AI_SYNC_SNAPSHOT__: {
      paymentsV7Projection: {
        contract: 'ADMIN_PAYMENTS_V7',
        deals: [otherDeal, selectedDeal],
      },
    },
  },
  setTimeout(fn) { fn(); return 1; },
  rendererCalls: [],
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(paymentsV7PassportActivationPrelude, sandbox);
vm.runInContext(`
function paymentsV7OwnerPassport(deal){
  const value=deal?.payment_passport;
  return value?.contract==='ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2'?value:null;
}
function paymentsV7OwnerPassportBodyRecovered(deal, paymentPassport){
  rendererCalls.push({deal,paymentPassport});
  return recoveredBody;
}
this.recoveredBody=recoveredBody;
this.paymentsV7OwnerPassportBody=paymentsV7OwnerPassportBodyRecovered;
`, vm.createContext({ ...sandbox, recoveredBody }));

// Re-create one shared context so the named recovered renderer and activation handler use the same globals.
const runtimeSandbox = {
  ...sandbox,
  recoveredBody,
  paymentsV7OwnerPassport(deal) {
    const value = deal?.payment_passport;
    return value?.contract === 'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2' ? value : null;
  },
  paymentsV7OwnerPassportBody: function paymentsV7OwnerPassportBodyRecovered(deal, paymentPassport) {
    sandbox.rendererCalls.push({ deal, paymentPassport });
    return recoveredBody;
  },
};
runtimeSandbox.globalThis = runtimeSandbox;
vm.createContext(runtimeSandbox);
vm.runInContext(paymentsV7PassportActivationPrelude + '\n' + paymentsV7PassportActivationRuntime, runtimeSandbox);

const click = listeners.get('click');
assert.equal(typeof click, 'function');
click({ target: clickTarget });

assert.equal(sandbox.rendererCalls.length, 1);
assert.equal(sandbox.rendererCalls[0].deal, selectedDeal);
assert.equal(sandbox.rendererCalls[0].paymentPassport, passport);
assert.deepEqual(details.children, [summary, recoveredBody]);
assert.equal(details.dataset.passportRenderer, 'paymentsV7OwnerPassportBodyRecovered');
assert.equal(details.dataset.passportRendererContract, 'PAYMENTS_V7_PASSPORT_RENDERER_ACTIVATION_V1');
assert.equal(details.children.includes(oldTechnicalBody), false);

// Genericity: production Deal IDs and expected monetary values must not be embedded in activation source.
const activationSource = paymentsV7PassportActivationPrelude + paymentsV7PassportActivationRuntime;
assert.doesNotMatch(activationSource, /DEAL-2026-00(?:4|5|6|9)/);
assert.doesNotMatch(activationSource, /229862\.96|168000|42000|6387\.04|33750|7320|439862\.96|47457\.04/);
assert.match(activationSource, /__RONA_OWNER_AI_SYNC_SNAPSHOT__\?\.paymentsV7Projection/);
assert.match(activationSource, /paymentsV7OwnerPassport\(deal\)/);
assert.match(activationSource, /paymentsV7OwnerPassportBodyRecovered/);

console.log('PASSPORT_RENDERER_ACTIVATION=PASS');
console.log('SELECTED_DEAL_FROM_CURRENT_PROJECTION=PASS');
console.log('PAYMENT_PASSPORT_TO_RECOVERED_RENDERER=PASS');
console.log('OLD_TECHNICAL_BODY_REPLACED_ON_OPEN=PASS');
console.log('FUTURE_DEAL_GENERIC=PASS');
console.log('NO_HARDCODE=PASS');
