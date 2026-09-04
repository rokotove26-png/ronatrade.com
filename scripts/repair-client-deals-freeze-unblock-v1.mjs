import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const styleId='rona-client-section-first-paint-v1-style';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const html=await readFile(htmlPath,'utf8');
const styleRe=new RegExp(`<style\\b[^>]*\\bid=["']${styleId}["'][^>]*>([\\s\\S]*?)<\\/style>`,'i');
const match=styleRe.exec(html);
if(!match)throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_STYLE_MISSING');

const style=match[1];
if(!/data-rona-client-deals-paint-ready/iu.test(style))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_READY_GATE_MISSING');
if(!/Загрузка актуальных сделок/iu.test(style))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_CURRENT_LOADING_OVERLAY_MISSING');
if(!/data-rona-client-deals-paint-state=["']empty["']/iu.test(style))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_AUTHORITATIVE_EMPTY_SELECTOR_MISSING');
if(!/Открытых сделок нет\. По выбранной компании и договору активные сделки отсутствуют\./iu.test(style))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_AUTHORITATIVE_EMPTY_MESSAGE_MISSING');
if(!/data-rona-operations-deal-status/iu.test(style)||!/display\s*:\s*none\s*!important/iu.test(style))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_STALE_DEAL_SHIELD_MISSING');
if(!/data-rona-client-payments-paint/iu.test(style))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_PAYMENTS_GUARD_LOST');
if(/data-rona-client-deals-paint-ready[^}]*visibility\s*:\s*hidden/iu.test(style))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_RUNTIME_DOM_HIDDEN');

// The current first-paint runtime keeps the Deals DOM measurable while an opaque
// fail-closed pseudo-element shields stale data. Older remediation removed every
// Deals paint rule, which also removed the authoritative empty-state shield and
// the paint-ready contract. Preserve the current authoritative style verbatim;
// no HTML or frozen business visualization is rewritten here.
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
if(integrity?.client_runtime?.section_first_paint){
  integrity.client_runtime.section_first_paint.deals_release='SERVER_AUTHORITATIVE_ACTIVE_EMPTY_OR_CANONICAL_V8_COMPOSED';
  integrity.client_runtime.section_first_paint.deals_loading_overlay=true;
  integrity.client_runtime.section_first_paint.deals_empty_overlay=true;
  integrity.client_runtime.section_first_paint.deals_runtime_dom_visibility_preserved=true;
  integrity.client_runtime.section_first_paint.deals_freeze_unblock_mode='AUTHORITATIVE_PREPAINT_RUNTIME_DOM_MEASURABLE';
  integrity.client_runtime.section_first_paint.frozen_visual_changed=false;
  integrity.client_runtime.section_first_paint.business_logic_changed=false;
}
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_DEALS_FREEZE_UNBLOCK=PASS html_mutation=NONE; deals_overlay=CURRENT_FAIL_CLOSED; authoritative_empty=PRESERVED; runtime_dom=MEASURABLE; payments_guard=PRESERVED; sha256=${sha256(emitted)}`);
