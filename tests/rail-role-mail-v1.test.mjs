import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gateway = readFileSync('supabase/functions/rona-mcp-gateway/gateway-base.mjs','utf8');
const bridge = readFileSync('supabase/functions/rona-role-mail-bridge/index.ts','utf8');

test('Rail role gets read tools only through the fixed role gate',()=>{
  assert.match(gateway,/if\(\['COMMERCIAL_DIRECTOR','OPERATIONS_DIRECTOR','FINANCE','RAIL_LOGISTICS','ASSISTANT'\]\.includes\(cfg\.business_role\)\)tools\.push\(/);
  for(const tool of ['mail_sync_status','mail_recent','mail_search','mail_read']) {
    assert.match(gateway,new RegExp("name:'"+tool+"'"));
  }
});

test('Rail outbound mail uses existing audited and idempotent send gate',()=>{
  assert.match(gateway,/if\(\['COMMERCIAL_DIRECTOR','OPERATIONS_DIRECTOR','RAIL_LOGISTICS','ASSISTANT'\]\.includes\(cfg\.business_role\)\)common\.push\(\{name:'mail_send'/);
  assert.doesNotMatch(gateway,/if\(\[[^\]]*'FINANCE'[^\]]*\]\.includes\(cfg\.business_role\)\)common\.push\(\{name:'mail_send'/);
  assert.match(gateway,/IDEMPOTENCY_KEY_REUSE_CONFLICT/);
  assert.match(gateway,/if\(name==='mail_send'\)\{/);
  assert.match(gateway,/requested_by/i);
});

test('Rail mailbox is mapped from immutable server-side role',()=>{
  assert.match(gateway,/const RAIL_MAILBOX='rail_spec@ronaoil\.com';/);
  assert.match(gateway,/cfg\.business_role==='RAIL_LOGISTICS'\?RAIL_MAILBOX/);
  assert.match(gateway,/function roleMailbox\(cfg\)/);
  assert.match(gateway,/ROLE_ARGUMENT_FORBIDDEN/);
  assert.match(gateway,/function roleArgInjected\(/);
});

test('Existing internal bridge allows only configured role inboxes',()=>{
  assert.match(bridge,/"rail_spec@ronaoil\.com"/);
  assert.match(bridge,/function mailboxOf\(body:any\)/);
  assert.match(bridge,/if\(!ALLOWED\.has\(m\)\)/);
  assert.match(bridge,/safeEqual\(supplied,expected\)/);
  assert.match(gateway,/x-rona-mail-internal-key/);
});

test('Mail tools do not expand Finance outbound scope',()=>{
  assert.match(gateway,/const FINANCE_MAILBOX='finance@ronaoil\.com';/);
  assert.match(gateway,/cfg\.business_role==='FINANCE'\?FINANCE_MAILBOX/);
  assert.match(gateway,/if\(\['COMMERCIAL_DIRECTOR','OPERATIONS_DIRECTOR','RAIL_LOGISTICS','ASSISTANT'\]\.includes\(cfg\.business_role\)\)common\.push\(\{name:'mail_send'/);
});
