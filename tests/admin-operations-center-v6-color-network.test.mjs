import assert from 'node:assert/strict';
import { test } from 'node:test';
import { patchAdminOperationsCommandCenterV6 } from '../functions/portal/admin-operations-command-center-v6.js';

const SOURCE='function renderAdminHome(){}\nfunction renderPrices(){}';

test('Operations Center V6 keeps one owner and exposes eight functional gauges', () => {
  const generated=patchAdminOperationsCommandCenterV6(SOURCE);
  assert.equal((generated.match(/function renderAdminHome\(\)\{/g)||[]).length,1);
  assert.equal((generated.match(/gauge\('/g)||[]).length,8);
  assert.match(generated,/data-rona-color-network':'v6/);
  assert.match(generated,/NET-07','Клиенты в сети',networkClientCount/);
  assert.match(generated,/NET-08','Агенты в сети',networkAgentCount/);
  assert.match(generated,/adminHomeNavigate\(target\)/);
  assert.match(generated,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(generated,/finance_event_submit/i);
});

test('network counters use only current Admin bootstrap identities', () => {
  const generated=patchAdminOperationsCommandCenterV6(SOURCE);
  assert.match(generated,/Array\.isArray\(d\.clients\)\?d\.clients:\[\]/);
  assert.match(generated,/Array\.isArray\(d\.agents\)\?d\.agents:\[\]/);
  assert.match(generated,/agent_person_id\|\|x\?\.agent_id/);
  assert.doesNotMatch(generated,/fetch\(|ownerApi\(|mutate\(/);
});
