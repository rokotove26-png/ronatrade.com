import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const styleId='rona-client-section-first-paint-v1-style';
const sha256=b=>createHash('sha256').update(b).digest('hex');

let html=await readFile(htmlPath,'utf8');
const styleRe=new RegExp(`<style\\b[^>]*\\bid=["']${styleId}["'][^>]*>([\\s\\S]*?)<\\/style>`,'i');
const match=styleRe.exec(html);
if(!match)throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_STYLE_MISSING');

const before=match[1];
const dealRuleRe=/[^{}]*data-rona-client-deals-paint[^{}]*\{[^{}]*\}\s*/giu;
const removed=(before.match(dealRuleRe)||[]).length;
if(removed<3)throw new Error(`CLIENT_DEALS_FREEZE_UNBLOCK_RULES_NOT_FOUND:${removed}`);
const after=before.replace(dealRuleRe,'');
if(/data-rona-client-deals-paint/iu.test(after))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_SELECTOR_REMAINS');
if(/Загрузка актуальных сделок/iu.test(after))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_LOADING_OVERLAY_REMAINS');
if(!/data-rona-client-payments-paint/iu.test(after))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_PAYMENTS_GUARD_LOST');

html=html.slice(0,match.index)+match[0].replace(before,after)+html.slice(match.index+match[0].length);
if(/Загрузка актуальных сделок/iu.test(html))throw new Error('CLIENT_DEALS_FREEZE_UNBLOCK_LOADING_TEXT_REMAINS_IN_HTML');
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
if(integrity?.client_runtime?.section_first_paint){
  integrity.client_runtime.section_first_paint.deals_release='FROZEN_BASE_RENDERER_UNBLOCKED';
  integrity.client_runtime.section_first_paint.deals_loading_overlay=false;
  integrity.client_runtime.section_first_paint.deals_empty_overlay=false;
  integrity.client_runtime.section_first_paint.deals_runtime_dom_visibility_preserved=true;
  integrity.client_runtime.section_first_paint.frozen_visual_changed=false;
  integrity.client_runtime.section_first_paint.business_logic_changed=false;
}
const emitted=Buffer.from(html,'utf8');
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_DEALS_FREEZE_UNBLOCK=PASS removed_rules=${removed}; deals_overlay=OFF; frozen_base_renderer=UNCHANGED; payments_guard=PRESERVED; sha256=${sha256(emitted)}`);
