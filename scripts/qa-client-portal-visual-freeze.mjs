import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const POLICY_PATH='governance/client-portal-visual-freeze.json';
const APPLICATIONS_APPROVAL_PATH='governance/client-applications-uat-v2-owner-approval.json';
const DEALS_LOADER_APPROVAL_PATH='governance/client-deals-loader-owner-remediation-20260904.json';
const CLIENT_LOAD_HOTFIX_APPROVAL_PATH='governance/client-load-hotfix-pr429-owner-approval-20260905.json';
const OWNER_VISUAL_DELTA_APPROVAL_PATH='governance/client-owner-visual-delta-pr429-approval-20260906.json';
const CLIENT_MULTI_CONTEXT_430_APPROVAL_PATH='governance/client-multiclient-parity-issue430-owner-approval-20260906.json';
const policy=JSON.parse(await readFile(POLICY_PATH,'utf8'));
const applicationsApproval=JSON.parse(await readFile(APPLICATIONS_APPROVAL_PATH,'utf8'));
const dealsLoaderApproval=JSON.parse(await readFile(DEALS_LOADER_APPROVAL_PATH,'utf8'));
const clientLoadHotfixApproval=JSON.parse(await readFile(CLIENT_LOAD_HOTFIX_APPROVAL_PATH,'utf8'));
const ownerVisualDeltaApproval=JSON.parse(await readFile(OWNER_VISUAL_DELTA_APPROVAL_PATH,'utf8'));
const clientMultiContext430Approval=JSON.parse(await readFile(CLIENT_MULTI_CONTEXT_430_APPROVAL_PATH,'utf8'));

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
  '.github/workflows/client-home-current-only-qa.yml',
  '.github/workflows/client-home-live-runtime-qa.yml',
  '.github/workflows/client-home-stuck-shell-regression-qa.yml',
  '.github/workflows/client-runtime-sanitation-qa.yml',
  'assets/portal-runtime/client-background-section-preload-v1.js',
  'assets/portal-runtime/client-context-selection-authority-v1.js',
  'assets/portal-runtime/client-deal-documents-v5.js',
  'assets/portal-runtime/client-deal-lifecycle-v1.js',
  'assets/portal-runtime/client-deals-authoritative-v1.js',
  'assets/portal-runtime/client-home-command-center-v2.js',
  'assets/portal-runtime/client-home-current-only-v1.js',
  'assets/portal-runtime/client-messages-archive-v1.js',
  'assets/portal-runtime/client-price-sync-v1.js',
  'assets/portal-runtime/client-section-first-paint-v1.js',
  'package.json',
  'scripts/attach-client-context-selection-authority-v1.mjs',
  'scripts/attach-client-deals-authoritative-v1.mjs',
  'scripts/attach-client-home-current-only-v1.mjs',
  'scripts/attach-client-section-first-paint-v1.mjs',
  'scripts/qa-client-context-selection-authority-v1.mjs',
  'scripts/qa-client-current-context-consumers-v1.mjs',
  'tests/client-load-feedback-loop-hotfix-v1.test.mjs'
];
const CLIENT_LOAD_HOTFIX_WIRING_FILES=[
  'governance/client-load-hotfix-pr429-owner-approval-20260905.json',
  'scripts/qa-client-portal-visual-freeze.mjs'
];
const OWNER_VISUAL_DELTA_FILES=[
  'assets/portal-runtime/client-content-responsive-v1.css',
  'assets/portal-runtime/client-contract-download-v3.js'
];
const CLIENT_MULTI_CONTEXT_430_FILES=[
  'assets/portal-runtime/client-contract-download-v3.js'
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
  clientLoadHotfixApproval?.home_fix_head_before_wiring==='8a98f6ad4b933fb03fed01138d926f0c45827c97'&&
  clientLoadHotfixApproval?.scope==='CLIENT_LOAD_HOTFIX_PR_429'&&
  clientLoadHotfixApproval?.authorized_delta==='DEALS_CURRENT_PROJECTION_AND_SELECTED_CONTEXT_SLOTS'&&
  clientLoadHotfixApproval?.authorized_home_delta==='STALE_FAIL_OPEN_HOME_FIX'&&
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
  clientLoadHotfixApproval?.requirements?.home_stale_preserved_forbidden===true&&
  clientLoadHotfixApproval?.requirements?.home_neutral_loading_error_only===true&&
  clientLoadHotfixApproval?.requirements?.home_context_generation_guard===true&&
  clientLoadHotfixApproval?.requirements?.home_current_projection_only===true&&
  clientLoadHotfixApproval?.requirements?.home_loaded_visual_preserved===true&&
  clientLoadHotfixApproval?.requirements?.rail_runtime_changed===false&&
  clientLoadHotfixApproval?.requirements?.production_changed===false&&
  clientLoadHotfixApproval?.requirements?.full_green_ci_required_before_merge===true&&
  clientLoadHotfixApproval?.requirements?.system_admin_review_required_before_merge===true&&
  clientLoadHotfixApproval?.requirements?.authenticated_client_verification_required_before_merge===true&&
  clientLoadHotfixApproval?.requirements?.production_deploy_before_acceptance===false&&
  clientLoadHotfixApproval?.requirements?.merge_before_acceptance===false&&
  clientLoadHotfixApproval?.expires_on_hotfix_completion===true;

const ownerVisualDeltaExceptionAuthorized=
  ownerVisualDeltaApproval?.approval==='OWNER_IN_CHAT'&&
  ownerVisualDeltaApproval?.owner_authorized_at==='2026-09-05'&&
  ownerVisualDeltaApproval?.governance_recognized_at==='2026-09-06'&&
  ownerVisualDeltaApproval?.pr_number===429&&
  ownerVisualDeltaApproval?.branch==='hotfix/client-load-feedback-loop-v1'&&
  ownerVisualDeltaApproval?.base_commit==='4e07ad9f2591c6135e6de651bdaa06bb80a82e78'&&
  ownerVisualDeltaApproval?.head_before_governance_wiring==='313888560a3cb629dbc30bf810beb1ad7b732545'&&
  ownerVisualDeltaApproval?.scope==='CLIENT_OWNER_VISUAL_DELTA_PR429_EXACT'&&
  exactArray(ownerVisualDeltaApproval?.source_comment_ids,[5554454496,5554471190])&&
  ownerVisualDeltaApproval?.governance_command_comment_id===5554905119&&
  exactArray(ownerVisualDeltaApproval?.approved_files,OWNER_VISUAL_DELTA_FILES)&&
  ownerVisualDeltaApproval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-content-responsive-v1.css']?.baseline_blob_sha==='8ca6c903fb700ba412a5a892e533a5f88f739ab8'&&
  ownerVisualDeltaApproval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-content-responsive-v1.css']?.authorized_post_blob_sha==='1431234cfaa982d4377d5d85683637c2f870f6f3'&&
  ownerVisualDeltaApproval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-content-responsive-v1.css']?.required_marker==='RONA_CLIENT_OWNER_TYPOGRAPHY_110_V2_REAL_UI'&&
  ownerVisualDeltaApproval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.baseline_blob_sha==='2f420990529e37d0feae88dd33f0753a79b9cc4e'&&
  ownerVisualDeltaApproval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.authorized_post_blob_sha==='57e66a343bf199ab2076a0ff5f074ba71e79218c'&&
  ownerVisualDeltaApproval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.required_marker==='20260906-client-contract-v10-kpi-typography-dynamic-owner'&&
  ownerVisualDeltaApproval?.authorized_visual_delta?.client_typography_scale===1.1&&
  ownerVisualDeltaApproval?.authorized_visual_delta?.analytics_effective_scale===1&&
  ownerVisualDeltaApproval?.authorized_visual_delta?.current_company_legal_name_visible===true&&
  ownerVisualDeltaApproval?.authorized_visual_delta?.company_name_source==='SELECTED_CLIENT_ID_CONTRACT_ID_AUTHORITATIVE_CONTEXT'&&
  ownerVisualDeltaApproval?.requirements?.visual_freeze_status_frozen===true&&
  ownerVisualDeltaApproval?.requirements?.owner_instruction_required===true&&
  ownerVisualDeltaApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  ownerVisualDeltaApproval?.requirements?.wildcard_exception===false&&
  ownerVisualDeltaApproval?.requirements?.approved_file_list_is_exact===true&&
  ownerVisualDeltaApproval?.requirements?.css_source_baseline_unchanged===true&&
  ownerVisualDeltaApproval?.requirements?.company_component_and_global_typography_runtime_exact===true&&
  ownerVisualDeltaApproval?.requirements?.client_typography_computed_scale_runtime===true&&
  ownerVisualDeltaApproval?.requirements?.css_zoom_transform_used===false&&
  ownerVisualDeltaApproval?.requirements?.analytics_unchanged_effective_typography===true&&
  ownerVisualDeltaApproval?.requirements?.company_name_fail_closed_if_authoritative_unavailable===true&&
  Array.isArray(ownerVisualDeltaApproval?.system_admin_extension_comment_ids)&&
  exactArray(ownerVisualDeltaApproval.system_admin_extension_comment_ids,[5558876637,5558955617,5559104106])&&
  ownerVisualDeltaApproval?.authorized_functional_delta?.my_companies_kpi_semantics==='CANONICAL_CLIENT_APPLICATIONS_AND_DEALS_PRODUCT_PREDICATES'&&
  ownerVisualDeltaApproval?.requirements?.company_kpi_uses_client_applications_live_render_predicate===true&&
  ownerVisualDeltaApproval?.requirements?.company_kpi_uses_client_deals_authoritative_predicate===true&&
  ownerVisualDeltaApproval?.requirements?.global_dom_text_replacement===false&&
  ownerVisualDeltaApproval?.requirements?.hardcoded_company_contract_deal_ids===false&&
  ownerVisualDeltaApproval?.requirements?.rail_changed===false&&
  ownerVisualDeltaApproval?.requirements?.supabase_schema_or_rls_changed===false&&
  ownerVisualDeltaApproval?.requirements?.business_data_changed===false&&
  ownerVisualDeltaApproval?.requirements?.production_changed===false&&
  ownerVisualDeltaApproval?.requirements?.merge_before_acceptance===false;

const clientMultiContext430ExceptionAuthorized=
  clientMultiContext430Approval?.approval==='OWNER_SYSTEM_ADMIN_ISSUE_COMMENT'&&
  clientMultiContext430Approval?.authorized_at==='2026-09-06'&&
  clientMultiContext430Approval?.issue_number===430&&
  clientMultiContext430Approval?.system_admin_comment_id===5561179393&&
  clientMultiContext430Approval?.system_admin_correction_comment_id===5561354113&&
  clientMultiContext430Approval?.branch==='hotfix/client-multiclient-parity-430-v1'&&
  clientMultiContext430Approval?.base_commit==='9797f7c7c5e8a003eaa19c520f4328a2001d5ce7'&&
  clientMultiContext430Approval?.scope==='CLIENT_MULTI_CONTEXT_AMOUNT_AND_COMPANY_METRICS_430'&&
  exactArray(clientMultiContext430Approval?.approved_protected_files,CLIENT_MULTI_CONTEXT_430_FILES)&&
  clientMultiContext430Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.visual_freeze_baseline_blob_sha==='2f420990529e37d0feae88dd33f0753a79b9cc4e'&&
  clientMultiContext430Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.production_pre_hotfix_blob_sha==='57e66a343bf199ab2076a0ff5f074ba71e79218c'&&
  clientMultiContext430Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.authorized_post_blob_sha==='24b135fa8e0a26cf96e28fdb7d1d7196abb31490'&&
  clientMultiContext430Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.required_marker==='20260906-client-contract-v11-authoritative-company-metrics'&&
  clientMultiContext430Approval?.requirements?.visual_freeze_remains_enabled===true&&
  clientMultiContext430Approval?.requirements?.owner_instruction_required===true&&
  clientMultiContext430Approval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientMultiContext430Approval?.requirements?.wildcard_exception===false&&
  clientMultiContext430Approval?.requirements?.approved_file_list_is_exact===true&&
  clientMultiContext430Approval?.requirements?.css_changed===false&&
  clientMultiContext430Approval?.requirements?.html_composition_changed===false&&
  clientMultiContext430Approval?.requirements?.design_changed===false&&
  clientMultiContext430Approval?.requirements?.typography_changed===false&&
  clientMultiContext430Approval?.requirements?.company_metrics_current_context_authoritative===true&&
  clientMultiContext430Approval?.requirements?.company_metrics_missing_fail_closed===true&&
  clientMultiContext430Approval?.requirements?.company_metrics_invalid_fail_closed===true&&
  clientMultiContext430Approval?.requirements?.company_metrics_neutral_unknown===true&&
  clientMultiContext430Approval?.requirements?.documents_kpi_current_effective_contractual_only===true&&
  clientMultiContext430Approval?.requirements?.superseded_contractual_documents_not_counted===true&&
  clientMultiContext430Approval?.requirements?.internal_artifacts_not_counted_as_contractual_kpi===true&&
  clientMultiContext430Approval?.requirements?.legacy_amount_uses_dedicated_passport_fields===true&&
  clientMultiContext430Approval?.requirements?.payment_status_semantics_unchanged===true&&
  clientMultiContext430Approval?.requirements?.hardcoded_client_contract_deal_ids===false&&
  clientMultiContext430Approval?.requirements?.rail_changed===false&&
  clientMultiContext430Approval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientMultiContext430Approval?.requirements?.business_data_changed===false&&
  clientMultiContext430Approval?.requirements?.destructive_cleanup_in_hotfix===false&&
  clientMultiContext430Approval?.requirements?.production_changed===false&&
  clientMultiContext430Approval?.requirements?.merge_before_system_admin_review===false;

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
let ownerVisualDeltaAppliedFiles=0;
let clientMultiContext430AppliedFiles=0;

function gitBlobSha(buffer){
  return createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest('hex');
}

for(const [path,expected] of Object.entries(protectedFiles)){
  try{
    const body=await readFile(path);
    const actual=gitBlobSha(body);
    const ownerEntry=ownerVisualDeltaExceptionAuthorized?ownerVisualDeltaApproval?.exact_post_remediation_blobs?.[path]:null;
    const exactOwnerVisualPost=Boolean(
      ownerEntry&&
      ownerEntry.baseline_blob_sha===expected&&
      ownerEntry.authorized_post_blob_sha===actual&&
      typeof ownerEntry.required_marker==='string'&&
      ownerEntry.required_marker.length>0&&
      body.toString('utf8').includes(ownerEntry.required_marker)
    );
    const issue430Entry=clientMultiContext430ExceptionAuthorized?clientMultiContext430Approval?.exact_post_remediation_blobs?.[path]:null;
    const exactIssue430Post=Boolean(
      issue430Entry&&
      issue430Entry.visual_freeze_baseline_blob_sha===expected&&
      issue430Entry.production_pre_hotfix_blob_sha==='57e66a343bf199ab2076a0ff5f074ba71e79218c'&&
      issue430Entry.authorized_post_blob_sha===actual&&
      typeof issue430Entry.required_marker==='string'&&
      issue430Entry.required_marker.length>0&&
      body.toString('utf8').includes(issue430Entry.required_marker)
    );
    if(exactOwnerVisualPost)ownerVisualDeltaAppliedFiles+=1;
    if(exactIssue430Post)clientMultiContext430AppliedFiles+=1;
    if(actual!==expected&&!approvedModifiedFiles.has(path)&&!exactOwnerVisualPost&&!exactIssue430Post)errors.push(`MODIFIED ${path} expected=${expected} actual=${actual}`);
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

console.log(`CLIENT_PORTAL_VISUAL_FREEZE=PASS baseline=${policy.baseline_release_commit} protected=${Object.keys(protectedFiles).length} applications_owner_exception=${applicationExceptionAuthorized?'approved':'none'} deals_loader_owner_exception=${dealsLoaderExceptionAuthorized?'approved':'none'} client_load_hotfix_pr429_exception=${clientLoadHotfixExceptionAuthorized?'approved':'none'} owner_visual_delta_exception=${ownerVisualDeltaExceptionAuthorized?'approved':'none'} owner_visual_delta_applied_files=${ownerVisualDeltaAppliedFiles} client_multicontext_430_exception=${clientMultiContext430ExceptionAuthorized?'approved':'none'} client_multicontext_430_applied_files=${clientMultiContext430AppliedFiles} deals_functional_runtime=${approvedNewRuntime.size?'approved':'none'} selected_context_delta=${clientLoadHotfixApproval?.authorized_delta||'none'} home_stale_fail_open_delta=${clientLoadHotfixApproval?.authorized_home_delta||'none'} visual_css_change=${ownerVisualDeltaAppliedFiles?'OWNER_APPROVED_EXACT':'none'}`);
