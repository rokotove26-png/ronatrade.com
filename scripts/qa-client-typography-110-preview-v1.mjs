/**
 * QA-only visual preview. Patches the disposable dist artifact after the release
 * build and never modifies frozen source, governance, approvals or production.
 * Intentionally fail closed on any source SHA drift or non-unique patch anchor.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const SOURCE='assets/portal-runtime/client-contract-download-v3.js';
const EMITTED='dist/assets/portal-runtime/client-contract-download-v3.js';
const EXPECTED_SOURCE_GIT_BLOB='af6fa41946cd14b432f4b1f360a3a5c0d2489f46';
const sha256=v=>createHash('sha256').update(v).digest('hex');
const gitBlob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\\0'.replace('\\0','\0'))).update(b).digest('hex');
const once=(input,anchor)=>{const pos=input.indexOf(anchor);if(pos<0||input.indexOf(anchor,pos+anchor.length)>=0)throw Error('QA_PREVIEW_ANCHOR_NOT_UNIQUE');return pos};
if(process.argv.length!==3||process.argv[2]!=='--apply-dist-only')throw Error('QA_PREVIEW_DIST_ONLY_FLAG_REQUIRED');
const frozen=await readFile(SOURCE);
if(gitBlob(frozen)!==EXPECTED_SOURCE_GIT_BLOB)throw Error('QA_PREVIEW_FROZEN_SOURCE_CHANGED');
const emitted=await readFile(EMITTED),before=emitted.toString('utf8'),frozenText=frozen.toString('utf8');
if(!before.includes('RONA_CLIENT_OWNER_SECTION_TYPOGRAPHY_110_V4_EXACT_PARENT')||!before.includes("const OWNER_TYPO_BASE_ATTR='data-rona-owner-typo-base'"))throw Error('QA_PREVIEW_RUNTIME_MARKERS_ABSENT');
const section='function ownerSectionTypoApply(targets){',end='function ownerSectionTypoFlush(){';
const start=once(before,section),stop=once(before,end);
if(stop<=start)throw Error('QA_PREVIEW_SECTION_REGION_INVALID');
const oldBaseline='const baselines=items.map(el=>parseFloat(getComputedStyle(el).fontSize));';
const newBaseline='const baselines=items.map(el=>{const original=Number(el.getAttribute(OWNER_TYPO_BASE_ATTR));return Number.isFinite(original)&&original>0?original:parseFloat(getComputedStyle(el).fontSize)});';
const prefix=before.slice(0,start),piece=before.slice(start,stop),suffix=before.slice(stop);
once(piece,oldBaseline);
const sectionPatched=prefix+piece.replace(oldBaseline,newBaseline)+suffix;
const ownerGlobal='function ownerTypoApply(targets){',ownerGlobalEnd='function ownerTypoFlush(){';
const globalStart=once(sectionPatched,ownerGlobal),globalStop=once(sectionPatched,ownerGlobalEnd);
if(globalStop<=globalStart)throw Error('QA_PREVIEW_NAV_GLOBAL_REGION_INVALID');
const oldOwnerScale="el.style.setProperty('font-size',`${scaled}px`,'important');applied++";
const navPaddingScale="el.style.setProperty('font-size',`${scaled}px`,'important');if(el.matches?.('#nav button')){el.style.setProperty('padding-top','0px','important');el.style.setProperty('padding-bottom','0px','important')}applied++";
const globalPiece=sectionPatched.slice(globalStart,globalStop);
once(globalPiece,oldOwnerScale);
const patched=sectionPatched.slice(0,globalStart)+globalPiece.replace(oldOwnerScale,navPaddingScale)+sectionPatched.slice(globalStop);
if(patched===before||!patched.includes(newBaseline)||!patched.includes(navPaddingScale))throw Error('QA_PREVIEW_NOOP');
if(patched.replace(navPaddingScale,oldOwnerScale).replace(newBaseline,oldBaseline)!==before)throw Error('QA_PREVIEW_NONATOMIC_CHANGE');
await writeFile(EMITTED,patched,'utf8');
console.log('QA_TYPOGRAPHY_NAV_PADDING_PREVIEW=PASS',JSON.stringify({navigation:'#nav button only',padding_block:'0px',font_size:'unchanged',fixed_geometry:'unchanged',overflow_rule:'unchanged',emitted_runtime_only:true}));
const srcAfter=await readFile(SOURCE);
if(!srcAfter.equals(frozen)||gitBlob(srcAfter)!==EXPECTED_SOURCE_GIT_BLOB)throw Error('QA_PREVIEW_SOURCE_MUTATED');
const changed=execFileSync('git',['status','--porcelain','--',SOURCE,'scripts/qa-client-portal-visual-freeze.mjs','governance/client-portal-visual-freeze.json'],{encoding:'utf8'});
if(changed.trim())throw Error('QA_PREVIEW_PROTECTED_GIT_DIFF '+changed);
console.log('QA_TYPOGRAPHY_PREVIEW_DIST_ONLY=PASS',JSON.stringify({source_git_blob:EXPECTED_SOURCE_GIT_BLOB,emitted:resolve(EMITTED),emitted_before_sha256:sha256(emitted),emitted_after_sha256:sha256(Buffer.from(patched)),changed_only:'ownerSectionTypoApply original baseline',protected_source_unchanged:true,production_mutated:false}));
