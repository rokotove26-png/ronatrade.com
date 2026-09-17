import test from 'node:test';
import assert from 'node:assert/strict';
import { stripOwnerBuildIndicator } from '../../scripts/admin-owner-production-diagnostics-policy.mjs';

const creator = "function indicator(){style();let n=document.getElementById('rona-owner-build-indicator');if(!n&&document.body){n=document.createElement('div');n.id='rona-owner-build-indicator';document.body.appendChild(n)}return n}";
const timer = 'style();updateIndicator();setInterval(updateIndicator,1000);';

test('production policy removes the owner build indicator creator and timer', () => {
  const input = `prefix ${creator} middle ${timer} suffix`;
  const output = stripOwnerBuildIndicator(input);

  assert.match(output, /function indicator\(\)\{return null\}/);
  assert.doesNotMatch(output, /n\.id='rona-owner-build-indicator'/);
  assert.doesNotMatch(output, /setInterval\(updateIndicator,1000\)/);
});

test('production policy is idempotent after enforcement', () => {
  const once = stripOwnerBuildIndicator(`${creator}${timer}`);
  assert.equal(stripOwnerBuildIndicator(once), once);
});

test('production policy fails closed when upstream diagnostic runtime changes unexpectedly', () => {
  assert.throws(
    () => stripOwnerBuildIndicator("function indicator(){return document.createElement('div')}"),
    /OWNER_BUILD_INDICATOR_POLICY_UNRECOGNIZED_RUNTIME/,
  );
});
