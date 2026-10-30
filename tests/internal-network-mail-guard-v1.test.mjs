import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const gateway = readFileSync('supabase/functions/rona-mcp-gateway/gateway-base.mjs','utf8');
const getFunction = (name) => {
  const match = gateway.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[^\\n]*\\}'));
  assert.ok(match, 'missing function '+name);
  return match[0];
};
const gate = runInNewContext(
  getFunction('isInternalRonaMailRecipient') + '\n' +
  getFunction('hasInternalRonaMailRecipients') + '\n' +
  'hasInternalRonaMailRecipients'
);

test('Corporate mail gate blocks internal To, Cc, Bcc and mixed recipients', () => {
  assert.equal(gate(['manager@ronaoil.com'], [], []),true);
  assert.equal(gate(['partner@outside.com'], ['finance@ronaoil.com'], []),true);
  assert.equal(gate(['partner@outside.com'], [], ['RAIL_SPEC@RONAOIL.COM']),true);
  assert.equal(gate(['partner@outside.com'], [], []),false);
  assert.equal(gate(['partner@notronaoil.com'], [], []),false);
  assert.equal(gate([], [], []),false);
});

test('MAIL_SEND refuses all internal recipients before idempotency and outbound dispatch', () => {
  const gateIndex = gateway.indexOf("if(hasInternalRonaMailRecipients(to,cc,bcc))return{error:'INTERNAL_NETWORK_ONLY_MAIL_RECIPIENT_DENIED'};");
  const prepareIndex = gateway.indexOf("const prepared=await sql.begin(async tx=>",gateway.indexOf("if(name==='mail_send')"));
  assert.ok(gateIndex > gateway.indexOf("if(name==='mail_send')"));
  assert.ok(prepareIndex > gateIndex);
  assert.match(gateway,/const mailbox=roleMailbox\(cfg\),to=cleanMailList/);
  assert.match(gateway,/if\(!mailbox\|\|!to\|\|!cc\|\|!bcc/);
});

test('External send retains fixed role binding, privacy and existing idempotency', () => {
  assert.match(gateway,/function roleMailbox\(cfg\)/);
  assert.match(gateway,/function roleArgInjected\(args\)/);
  assert.match(gateway,/IDEMPOTENCY_KEY_REUSE_CONFLICT/);
  assert.match(gateway,/if\(name==='mail_send'\)/);
  assert.match(gateway,/const RAIL_MAILBOX='rail_spec@ronaoil\.com';/);
  assert.match(gateway,/const FINANCE_MAILBOX='finance@ronaoil\.com';/);
  assert.match(gateway,/if\(\['COMMERCIAL_DIRECTOR','OPERATIONS_DIRECTOR','LEGAL','RAIL_LOGISTICS','ASSISTANT'\]\.includes\(cfg\.business_role\)\)common\.push\(\{name:'mail_send'/);
});
