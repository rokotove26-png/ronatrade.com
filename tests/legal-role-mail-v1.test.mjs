import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const gateway = readFileSync('supabase/functions/rona-mcp-gateway/gateway-base.mjs','utf8');
const bridge = readFileSync('supabase/functions/rona-role-mail-bridge/index.ts','utf8');
const start = gateway.indexOf("const COMMERCIAL_MAILBOX=");
const end = gateway.indexOf('function cleanMailAddress(', start);
assert.ok(start>=0 && end>start, 'exact role-mailbox definition must exist');
const fixedMailbox = runInNewContext(gateway.slice(start,end)+'\nroleMailbox;');

test('LEGAL receives all four READ tools on its own role',()=>{
 assert.match(gateway,/if\(\['COMMERCIAL_DIRECTOR','OPERATIONS_DIRECTOR','FINANCE','LEGAL','RAIL_LOGISTICS','ASSISTANT'\]\.includes\(cfg\.business_role\)\)tools\.push\(/);
 for(const tool of ['mail_sync_status','mail_recent','mail_search','mail_read']) {
   assert.match(gateway,new RegExp("name:'"+tool+"'"));
 }
});
test('LEGAL gets scoped outbound tool without adding FINANCE or SYSTEM_ADMIN send',()=>{
 assert.match(gateway,/if\(\['COMMERCIAL_DIRECTOR','OPERATIONS_DIRECTOR','LEGAL','RAIL_LOGISTICS','ASSISTANT'\]\.includes\(cfg\.business_role\)\)common\.push\(\{name:'mail_send'/);
 assert.doesNotMatch(gateway,/if\(\[[^\]]*'FINANCE'[^\]]*\]\.includes\(cfg\.business_role\)\)common\.push\(\{name:'mail_send'/);
 assert.match(gateway,/scopeHas\(auth\.scope,'mcp:coordinate'\)/);
 assert.match(gateway,/coordinationEnabled\(cfg\)/);
});
test('server-owned Legal identity maps ONLY to lawyer mailbox',()=>{
 assert.equal(fixedMailbox({business_role:'LEGAL'}),'lawyer@ronaoil.com');
 assert.equal(fixedMailbox({business_role:'RAIL_LOGISTICS'}),'rail_spec@ronaoil.com');
 assert.equal(fixedMailbox({business_role:'FINANCE'}),'finance@ronaoil.com');
 assert.equal(fixedMailbox({business_role:'OPERATIONS_DIRECTOR'}),'exec_director@ronaoil.com');
 assert.equal(fixedMailbox({business_role:'COMMERCIAL_DIRECTOR'}),'analyst@ronaoil.com');
 assert.equal(fixedMailbox({business_role:'SYSTEM_ADMIN'}),null);
 assert.match(gateway,/if\(roleArgInjected\(args\)\)/);
 assert.doesNotMatch(gateway,/args\?\.mailbox\s*\?\s*.*LEGAL_MAILBOX/);
});
test('REG.RU bridge already supports Legal, with independent internal token',()=>{
 assert.match(bridge,/"lawyer@ronaoil\.com"/);
 assert.match(bridge,/if\(!ALLOWED\.has\(m\)\)/);
 assert.match(bridge,/safeEqual\(supplied,expected\)/);
 assert.match(gateway,/x-rona-mail-internal-key/);
});
test('no SMTP or external recipient was sent by deploying the code change',()=>{
 assert.match(gateway,/INTERNAL_NETWORK_ONLY_MAIL_RECIPIENT_DENIED/);
 assert.match(gateway,/IDEMPOTENCY_KEY_REUSE_CONFLICT/);
 assert.match(gateway,/if\(name==='mail_send'\)\{/);
 assert.match(gateway,/UUID_RE\.test\(String\(args\.idempotency_key/);
 assert.match(gateway,/const mailbox=roleMailbox\(cfg\),to=cleanMailList/);
 assert.match(gateway,/roleMailBridge\(mailbox,'process-outbox'\)/);
});
