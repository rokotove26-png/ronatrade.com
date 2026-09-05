import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const POLICY_PATH='governance/client-portal-visual-freeze.json';
const APPLICATIONS_APPROVAL_PATH='governance/client-applications-uat-v2-owner-approval.json';
const DEALS_LOADER_APPROVAL_PATH='governance/client-deals-loader-owner-remediation-20260904.json';
const CLIENT_LOAD_HOTFIX_APPROVAL_PATH='governance/client-load-hotfix-pr429-owner-approval-20260905.json';
const policy=JSON.parse(await readFile(POLICY_PATH,'utf8'));
const applicationsApproval=JSON.parse(await readFile(APPLICATIONS_APPROVAL_PATH,'utf8'));
const dealsLoaderApproval=JSON.parse(await readFile(DEALS_LOADER_APPROVAL_PATH,'utf8'));
const clientLoadHotfixApproval=JSON.parse(await readFile(CLIENT_LOAD_HOTFIX_APPROVAL_PATH,'utf8'));

if(policy.policy!=='RONA_CLIENT_PORTAL_VISUAL_FREEZE_V1')throw new Error('CLIENT_VISUAL_FREEZE_POLICY_ID_MISMATCH');
if(policy.status!=='FROZEN')throw new Error('CLIENT_VISUAL_FREEZE_NOT_ACTIVE');
if(policy.owner_instruction_required!==true)throw new Error('CLIENT_VISUAL_FREEZE_OWNER_GATE_DISABLED');
if(!policy.approval_marker||!String(policy.approval_marker).startsWith('OWNER_VISUAL_APPROVAL:'))throw new Error('CLIENT_VISUAL_FREEZE_APPROVAL_MARKER_INVALID');

const applicationExceptionAuthorized=
  applicationsApproval?.approval==='OWNER_IN_CHAT'&&
  applicationsApproval?.authorized_at==='2026-09-04'&&
  applicationsApproval?.scope==='CLIENT_APPLICATIONS_UAT_V2'&&
  applicationsApproval?.requirements?.application_rows_align_to_primary_title_frame===true&&
  applicationsApproval?.requirements?.display_actual_submitted_price===true&&
  applicationsApproval?.requirements?.hide_internal_price_mode_enum_from_client_display===true&&
  applicationsApproval?.requirements?.images_added===false&&
  Array.isArray(applicationsApproval?.requirements?.resource_status_visible)&&
  applicationsApproval.requirements.resource_status_visible.includes('RESOURCE_NOT_CONFIRMED')&&
  applicationsApproval.requirements.resource_status_visible.includes('RESOURCE_CONFIRMED');

const dealsLoaderExceptionAuthorized=
  dealsLoaderApproval?.approval==='OWNER_IN_CHAT'&&
  dealsLoaderApproval?.authorized_at==='2026-09-04'&&
  dealsLoaderApproval?.extended_at==='2026-09-05'&&
  dealsLoaderApproval?.scope==='CLIENT_DEALS_FIRST_PAINT_FUNCTIONAL_REMEDIATION'&&
  dealsLoaderApproval?.requirements?.server_authoritative_context_required===true&&
  dealsLoaderApproval?.requirements?.server_authoritative_active_deal_ids_must_match_rendered_operational_deal_ids===true&&
  dealsLoaderApproval?.requirements?.canonical_visual_composer_must_not_block_functional_section_release===true&&
  dealsLoaderApproval?.requirements?.authoritative_live_deal_materialization_required===true&&
  dealsLoaderApproval?.requirements?.authoritative_deal_lifecycle_binding_change_allowed===true&&
  dealsLoaderApproval?.requirements?.authoritative_lifecycle_attachment_change_allowed===true&&
  dealsLoaderApproval?.requirements?.cross_company_deal_detail_reuse_forbidden===true&&
  dealsLoaderApproval?.requirements?.active_current_section_only===true&&
  dealsLoaderApproval?.requirements?.functional_runtime_addition_allowed===true&&
  dealsLoaderApproval?.requirements?.functional_attachment_addition_allowed===true&&
  dealsLoaderApproval?.requirements?.existing_deal_visual_preserved===true&&
  dealsLoaderApproval?.requirements?.visual_css_changed===false&&
  dealsLoaderApproval?.requirements?.business_data_changed===false&&
  dealsLoaderApproval?.requirements?.business_logic_changed===false&&
  dealsLoaderApproval?.requirements?.images_added===false&&
  dealsLoaderApproval?.requirements?.unrelated_visual_change===false;

const CLIENT_LOAD_HOTFIX_PR429_FILES=[
  '.github/workflows/client-runtime-sanitation-qa.yml',
  'assets/portal-runtime/client-background-section-preload-v1.js',
  'assets/portal-runtime/client-context-selection-authority-v1.js',
  'assets/portal-runtime/client-deal-documents-v5.js',
  'assets/portal-runtime/client-deal-lifecycle-v1.js',
  'assets/portal-runtime/client-deals-authoritative-v1.js',
  'assets/portal-runtime/client-home-command-center-v2.js',
  'assets/portal-runtime/client-messages-archive-v1.js',
  'assets/portal-runtime/client-price-sync-v1.js',
  'assets/portal-runtime/client-section-first-paint-v1.js',
  'package.json',
  'scripts/attach-client-context-selection-authority-v1.mjs',
  'scripts/attach-client-deals-authoritative-v1.mjs',
  'scripts/attach-client-section-first-paint-v1.mjs',
  'scripts/qa-client-context-selection-authority-v1.mjs',
  'scripts/qa-client-current-context-consumers-v1.mjs',
  'tests/client-load-feedback-loop-hotfix-v1.test.mjs'
];
const CLIENT_LOAD_HOTFIX_WIRING_FILES=[
  'governance/client-load-hotfix-pr429-owner-approval-20260905.json',
  'scripts/qa-client-portal-visual-freeze.mjs'
];
const exactArray=(actual,expected)=>Array.isArray(actual)&&actual.length===expected.length&&actual.every((value,index)=>value===expected[index]);
const clientLoadHotfixExceptionAuthorized=
  clientLoadHotfixApproval?.approval==='OWNER_IN_CHAT'&&
  clientLoadHotfixApproval?.authorized_at==='2026-09-05'&&
  clientLoadHotfixApproval?.extended_at==='2026-09-05'&&
  clientLoadHotfixApproval?.pr_number===429&&
  clientLoadHotfixApproval?.branch==='hotfix/client-load-feedback-loop-v1'&&
  clientLoadHotfixApproval?.base_commit==='4e07ad9f2591c6135e6de651bdaa06bb80a82e78'&&
  clientLoadHotfixApproval?.functional_head_before_wiring==='d8af6dd2cc41f279b3fc29aa12b423f0472f828f'&&
  clientLoadHotfixApproval?.scope==='CLIENT_LOAD_HOTFIX_PR_429'&&
  clientLoadHotfixApproval?.authorized_delta==='DEALS_CURRENT_PROJECTION_AND_SELECTED_CONTEXT_SLOTS'&&
  exactArray(clientLoadHotfixApproval?.approved_files,CLIENT_LOAD_HOTFIX_PR429_FILES)&&
  exactArray(clientLoadHotfixApproval?.wiring_files,CLIENT_LOAD_HOTFIX_WIRING_FILES)&&
  clientLoadHotfixApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientLoadHotfixApproval?.requirements?.gate_mechanism_remains_active===true&&
  clientLoadHotfixApproval?.requirements?.approved_file_list_is_exact===true&&
  clientLoadHotfixApproval?.requirements?.new_runtime_files_allowed===false&&
  clientLoadHotfixApproval?.requirements?.new_attachment_files_allowed===false&&
  clientLoadHotfixApproval?.requirements?.css_changed===false&&
  clientLoadHotfixApproval?.requirements?.html_composition_changed===false&&
  clientLoadHotfixApproval?.requirements?.design_changed===false&&
  clientLoadHotfixApproval?.requirements?.business_data_changed===false&&
  clientLoadHotfixApproval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientLoadHotfixApproval?.requirements?.business_logic_changed===false&&
  clientLoadHotfixApproval?.requirements?.deals_uses_current_projection===true&&
  clientLoadHotfixApproval?.requirements?.deals_own_context_fetch===false&&
  clientLoadHotfixApproval?.requirements?.projection_event_replaces_deals_payload===true&&
  clientLoadHotfixApproval?.requirements?.first_paint_same_projection_no_fetch===true&&
  clientLoadHotfixApproval?.requirements?.selected_context_slots_from_client_contract_ids===true&&
  clientLoadHotfixApproval?.requirements?.global_dom_text_replacement===false&&
  clientLoadHotfixApproval?.requirements?.hardcoded_company_names===false&&
  clientLoadHotfixApproval?.requirements?.sanitation_assertion_updated_to_current_projection_contract===true&&
  clientLoadHotfixApproval?.requirements?.rail_runtime_changed===false&&
  clientLoadHotfixApproval?.requirements?.production_changed===false&&
  clientLoadHotfixApproval?.requirements?.full_green_ci_required_before_merge===true&&
  clientLoadHotfixApproval?.requirements?.system_admin_review_required_before_merge===true&&
  clientLoadHotfixApproval?.requirements?.authenticated_client_verification_required_before_merge===true&&
  clientLoadHotfixApproval?.requirements?.production_deploy_before_acceptance===false&&
  clientLoadHotfixApproval?.requirements?.merge_before_acceptance===false&&
  clientLoadHotfixApproval?.expires_on_hotfix_completion===true;

const approvedModifiedFiles=new Set();
const approvedNewRuntime=new Set();
const approvedNewAttach=new Set();
if(applicationExceptionAuthorized){
  approvedModifiedFiles.add('assets/portal-runtime/client-applications-live-render-v1.js');
  approvedModifiedFiles.add('scripts/attach-client-applications-live-render-v1.mjs');
}
if(dealsLoaderExceptionAuthorized){
  approvedModifiedFiles.add('assets/portal-runtime/client-section-first-paint-v1.js');
  approvedModifiedFiles.add('assets/portal-runtime/client-deal-lifecycle-v1.js');
  approvedModifiedFiles.add('scripts/attach-client-deal-documents.mjs');
  approvedNewRuntime.add('client-deals-authoritative-v1.js');
  approvedNewAttach.add('attach-client-deals-authoritative-v1.mjs');
}
if(clientLoadHotfixExceptionAuthorized){
  for(const path of CLIENT_LOAD_HOTFIX_PR429_FILES)approvedModifiedFiles.add(path);
}

const protectedFiles=policy.protected_files||{};
const errors=[];

function gitBlobSha(buffer){
  return createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest('hex');
}

for(const [path,expected] of Object.entries(protectedFiles)){
  try{
    const body=await readFile(path);
    const actual=gitBlobSha(body);
    if(actual!==expected&&!approvedModifiedFiles.has(path))errors.push(`MODIFIED ${path} expected=${expected} actual=${actual}`);
  }catch(error){
    errors.push(`MISSING ${path} ${error?.code||error?.message||'READ_ERROR'}`);
  }
}

const baselineRuntime=new Set(Object.keys(protectedFiles)
  .filter(path=>path.startsWith('assets/portal-runtime/client-'))
  .map(path=>path.split('/').pop()));
const currentRuntime=(await readdir('assets/portal-runtime'))
  .filter(name=>/^client-.*\.(?:js|css)$/u.test(name));
for(const name of currentRuntime){
  if(!baselineRuntime.has(name)&&!approvedNewRuntime.has(name))errors.push(`NEW_CLIENT_RUNTIME assets/portal-runtime/${name}`);
}

const baselineAttach=new Set(Object.keys(protectedFiles)
  .filter(path=>path.startsWith('scripts/attach-client-'))
  .map(path=>path.split('/').pop()));
const currentAttach=(await readdir('scripts'))
  .filter(name=>/^attach-client-.*\.mjs$/u.test(name));
for(const name of currentAttach){
  if(!baselineAttach.has(name)&&!approvedNewAttach.has(name))errors.push(`NEW_CLIENT_ATTACHMENT scripts/${name}`);
}

const baselineSource=new Set(Object.keys(protectedFiles)
  .filter(path=>path.startsWith('portal-src/current/client/'))
  .map(path=>path.split('/').pop()));
const currentSource=(await readdir('portal-src/current/client')).sort();
for(const name of currentSource){
  if(!baselineSource.has(name))errors.push(`NEW_CLIENT_SOURCE portal-src/current/client/${name}`);
}

if(errors.length){
  console.error('CLIENT_PORTAL_VISUAL_FREEZE=BLOCKED');
  console.error('Client Portal frontend/visual baseline is frozen. Explicit owner instruction is required before changing the baseline.');
  for(const item of errors)console.error(` - ${item}`);
  process.exit(1);
}

console.log(`CLIENT_PORTAL_VISUAL_FREEZE=PASS baseline=${policy.baseline_release_commit} protected=${Object.keys(protectedFiles).length} applications_owner_exception=${applicationExceptionAuthorized?'approved':'none'} deals_loader_owner_exception=${dealsLoaderExceptionAuthorized?'approved':'none'} client_load_hotfix_pr429_exception=${clientLoadHotfixExceptionAuthorized?'approved':'none'} deals_functional_runtime=${approvedNewRuntime.size?'approved':'none'} selected_context_delta=${clientLoadHotfixApproval?.authorized_delta||'none'} visual_css_changed=false`);
