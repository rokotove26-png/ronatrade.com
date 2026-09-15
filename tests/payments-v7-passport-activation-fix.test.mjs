import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  paymentsV7PassportActivationPrelude,
  paymentsV7PassportActivationRuntime,
} from '../functions/portal/main-ui/payments-v7-passport-activation-fix.js';

const listeners = new Map();
const rendererCalls = [];

function classListFor(node) {
  return {
    add(name) { const set = new Set(String(node.className || '').split(/\s+/).filter(Boolean)); set.add(name); node.className = [...set].join(' '); },
    remove(name) { node.className = String(node.className || '').split(/\s+/).filter((x) => x && x !== name).join(' '); },
    contains(name) { return String(node.className || '').split(/\s+/).includes(name); },
  };
}

function fakeNode(tag) {
  const node = {
    tag,
    nodeType: 1,
    className: '',
    id: '',
    textContent: '',
    attrs: {},
    dataset: {},
    children: [],
    parentElement: null,
    classList: null,
    append(...items) { for (const item of items.flat()) { if (!item) continue; item.parentElement = this; this.children.push(item); } },
    appendChild(item) { if (item) { item.parentElement = this; this.children.push(item); } return item; },
    remove() { if (!this.parentElement) return; this.parentElement.children = this.parentElement.children.filter((child) => child !== this); this.parentElement = null; },
    setAttribute(key, value) {
      this.attrs[key] = String(value);
      if (key === 'id') this.id = String(value);
      if (key === 'class') this.className = String(value);
      if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    },
    addEventListener() {},
    focus() { this.focused = true; },
    matches(selector) {
      if (selector === '.rona-payments-v7-passport > summary') return this.tag === 'summary' && this.parentElement?.classList?.contains('rona-payments-v7-passport');
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      return false;
    },
    closest(selector) {
      let current = this;
      while (current) {
        if (selector === '.rona-payments-v7-passport > summary' && current.tag === 'summary' && current.parentElement?.classList?.contains('rona-payments-v7-passport')) return current;
        if (selector === '[data-passport-modal-close="true"]' && current.dataset?.passportModalClose === 'true') return current;
        if (selector.startsWith('.') && current.classList?.contains(selector.slice(1))) return current;
        current = current.parentElement;
      }
      return null;
    },
    querySelector(selector) { return findNode(this, (item) => selector.startsWith('#') ? item.id === selector.slice(1) : false); },
  };
  node.classList = classListFor(node);
  return node;
}

function findNode(root, predicate) {
  if (!root) return null;
  if (predicate(root)) return root;
  for (const child of root.children || []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

function textOf(value) {
  if (!value) return '';
  if (value.nodeType === 3) return value.text;
  return [value.textContent, ...(value.children || []).map(textOf)].filter(Boolean).join(' | ');
}

const documentElement = fakeNode('html');
const head = fakeNode('head');
const body = fakeNode('body');
documentElement.append(head, body);
const document = {
  documentElement,
  head,
  body,
  createElement: fakeNode,
  createTextNode(text) { return { nodeType: 3, text: String(text), parentElement: null }; },
  addEventListener(type, handler) { listeners.set(type, handler); },
  querySelector(selector) { return selector.startsWith('#') ? findNode(documentElement, (item) => item.id === selector.slice(1)) : null; },
};

const passport = { contract: 'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2', funding_currency: 'USD' };
const selectedDeal = {
  deal_key: 'future-key-renderer-activation',
  deal_id: 'FUTURE-DEAL-RENDERER-X91',
  client_display: 'Future Client',
  financial_status: 'OPEN',
  payment_passport: passport,
};
const otherDeal = {
  deal_key: 'other-future-key',
  deal_id: 'FUTURE-DEAL-OTHER-X92',
  payment_passport: { contract: 'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2' },
};

const article = fakeNode('article');
article.className = 'rona-payments-v7-deal';
article.dataset = { dealKey: selectedDeal.deal_key, dealId: selectedDeal.deal_id };
const details = fakeNode('details');
details.className = 'rona-payments-v7-passport';
details.open = true;
const summary = fakeNode('summary');
const oldTechnicalBody = fakeNode('div');
oldTechnicalBody.textContent = 'OLD_TECHNICAL_PASSPORT_BODY';
details.append(summary, oldTechnicalBody);
article.append(details);
body.append(article);

const recoveredBody = fakeNode('div');
recoveredBody.textContent = 'RECOVERED_FUNDING_FIRST_BODY';
function paymentsV7OwnerPassport(deal) {
  const value = deal?.payment_passport;
  return value?.contract === 'ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2' ? value : null;
}
function paymentsV7OwnerPassportBodyRecovered(deal, paymentPassport) {
  rendererCalls.push({ deal, paymentPassport });
  return recoveredBody;
}
function paymentsV7OwnerDealStatusText(value) { return value === 'OPEN' ? 'Открыта' : 'Статус уточняется'; }

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
  paymentsV7OwnerPassport,
  paymentsV7OwnerPassportBody: paymentsV7OwnerPassportBodyRecovered,
  paymentsV7OwnerDealStatusText,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(paymentsV7PassportActivationPrelude + '\n' + paymentsV7PassportActivationRuntime, sandbox);

const click = listeners.get('click');
assert.equal(typeof click, 'function');
let prevented = false;
click({
  target: summary,
  preventDefault() { prevented = true; },
  stopPropagation() {},
});

assert.equal(prevented, true);
assert.equal(details.open, false);
assert.deepEqual(details.children, [summary]);
assert.equal(details.dataset.passportPresentation, 'MODAL_ONLY');
assert.equal(rendererCalls.length, 1);
assert.equal(rendererCalls[0].deal, selectedDeal);
assert.equal(rendererCalls[0].paymentPassport, passport);

const modal = document.querySelector('#ronaPaymentsV7PassportDesignerModal');
assert.ok(modal);
assert.equal(modal.dataset.passportRenderer, 'paymentsV7OwnerPassportBodyRecovered');
assert.equal(modal.dataset.passportRendererContract, 'PAYMENTS_V7_PASSPORT_DESIGNER_MODAL_V1');
assert.match(textOf(modal), /ПАСПОРТ ПЛАТЕЖА/);
assert.match(textOf(modal), /FUTURE-DEAL-RENDERER-X91/);
assert.match(textOf(modal), /Future Client/);
assert.match(textOf(modal), /Открыта/);
assert.match(textOf(modal), /Закрыть/);
assert.match(textOf(modal), /RECOVERED_FUNDING_FIRST_BODY/);
assert.equal(documentElement.classList.contains('rona-payments-v7-modal-open'), true);

const activationSource = paymentsV7PassportActivationPrelude + paymentsV7PassportActivationRuntime;
assert.doesNotMatch(activationSource, /DEAL-2026-00(?:4|5|6|9)/);
assert.doesNotMatch(activationSource, /229862\.96|168000|42000|6387\.04|33750|7320|439862\.96|47457\.04/);
assert.match(activationSource, /__RONA_OWNER_AI_SYNC_SNAPSHOT__\?\.paymentsV7Projection/);
assert.match(activationSource, /paymentsV7OwnerPassport\(deal\)/);
assert.match(activationSource, /paymentsV7OwnerPassportBodyRecovered/);
assert.match(activationSource, /role:'dialog'/);
assert.match(activationSource, /aria-modal/);
assert.match(activationSource, /max-height:92vh/);
assert.match(activationSource, /overflow:auto/);

console.log('INLINE_PASSPORT_REMOVED=PASS');
console.log('DESIGNER_MODAL=PASS');
console.log('SELECTED_DEAL_FROM_CURRENT_PROJECTION=PASS');
console.log('PAYMENT_PASSPORT_TO_RECOVERED_RENDERER=PASS');
console.log('FUTURE_DEAL_GENERIC=PASS');
console.log('NO_HARDCODE=PASS');
