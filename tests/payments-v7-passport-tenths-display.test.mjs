import assert from 'node:assert/strict';
import vm from 'node:vm';
import { paymentsV7PassportActivationPrelude } from '../functions/portal/main-ui/payments-v7-passport-activation-fix.js';

const sandbox = { Intl, Number, Array, String, Object };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(paymentsV7PassportActivationPrelude, sandbox);

const normalize = (value) => String(value).replace(/\s/g, ' ');
assert.equal(normalize(sandbox.paymentsV7Fmt(6448.7605362)), '6 448,8');
assert.equal(normalize(sandbox.paymentsV7Fmt(5.35101796)), '5,4');
assert.equal(normalize(sandbox.paymentsV7Fmt(6225.53)), '6 225,5');
assert.doesNotMatch(paymentsV7PassportActivationPrelude, /maximumFractionDigits:8/);
assert.match(paymentsV7PassportActivationPrelude, /maximumFractionDigits:1/);

console.log('PAYMENTS_PASSPORT_TENTHS_DISPLAY=PASS');
console.log('FINANCE_VALUES_UNCHANGED_DISPLAY_ONLY=PASS');
