import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const POLICY_PATH='governance/client-portal-visual-freeze.json';
const APPLICATIONS_APPROVAL_PATH='governance/client-applications-uat-v2-owner-approval.json';
const DEALS_LOADER_APPROVAL_PATH='governance/client-deals-loader-owner-remediation-20260904.json';
const CLIENT_LOAD_HOTFIX_APPROVAL_PATH='governance/client-load-hotfix-pr429-owner-approval-20260905.json';
const OWNER_VISUAL_DELTA_APPROVAL_PATH='governance/client-owner-visual-delta-pr429-approval-20260906.json';
const CLIENT_MULTI_CONTEXT_430_APPROVAL_PATH='governance/client-multiclient-parity-issue430-owner-approval-20260906.json';
const CLIENT_SECTION_TYPOGRAPHY_110_APPROVAL_PATH='governance/client-section-typography-110-owner-approval-20260909.json';
const CLIENT_POSTRELEASE_ISSUE430_APPROVAL_PATH='governance/client-postrelease-issue430-owner-approval-20260911.json';
const APPLICATION_BUSINESS_V2_SCOPE_PATH='governance/client-application-business-v2-owner-scope.json';
const CLIENT_RAIL_ADMIN_MIRROR_APPROVAL_PATH='governance/client-rail-admin-mirror-owner-approval-20260918.json';
const CLIENT_RAIL_670_APPROVAL_PATH='governance/client-online-rail-670-owner-approval-20260919.json';
const CLIENT_EVENT_DRIVEN_REFRESH_APPROVAL_PATH='governance/client-event-driven-refresh-owner-approval-20260921.json';
const CLIENT_COMPANY_DIRECTORY_EVENT_DRIVEN_APPROVAL_PATH='governance/client-company-directory-event-driven-owner-approval-20260921.json';
const CLIENT_MARKET_EVENT_DRIVEN_APPROVAL_PATH='governance/client-market-event-driven-refresh-owner-approval-20260921.json';
const CLIENT_ANALYTICS_CURRENT_SOURCE_APPROVAL_PATH='governance/client-analytics-current-source-owner-approval-20261009.json';
const CLIENT_ANALYTICS_REENTRY_APPROVAL_PATH='governance/client-analytics-reentry-owner-approval-20261009.json';
const CLIENT_ANALYTICS_VISIBILITY_APPROVAL_PATH='governance/client-analytics-visible-owner-approval-20261009.json';
const CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_APPROVAL_PATH='governance/client-analytics-active-route-recovery-owner-approval-20261009.json';
const CLIENT_ANALYTICS_CANONICAL_RESTORE_APPROVAL_PATH='governance/client-analytics-canonical-restore-owner-approval-20261009.json';
const CLIENT_ANALYTICS_AUTHORIZED_PRICE_APPROVAL_PATH='governance/client-analytics-authorized-price-bridge-20261009.json';
const CLIENT_ANALYTICS_PUBLISHED_PRICE_APPROVAL_PATH='governance/client-analytics-published-price-visible-v9-owner-approval-20261009.json';
const CLIENT_ANALYTICS_ADMIN_PARITY_APPROVAL_PATH='governance/client-analytics-admin-parity-v10-owner-approval-20261009.json';
const CLIENT_ANALYTICS_DT_LPG_V11_APPROVAL_PATH='governance/client-analytics-dt-lpg-forecast-source-safe-v11-owner-approval-20261009.json';
const ANALYTICS_DAILY_V12_APPROVAL_PATH='governance/analytics-daily-observed-no-empty-overlay-v12-owner-approval-20261009.json';
const ANALYTICS_LPG_V13_APPROVAL_PATH='governance/lpg-daily-history-v13-owner-approval-20261009.json';
const CLIENT_ANALYTICS_NATIVE_V17_APPROVAL_PATH='governance/client-analytics-native-functionality-v17-20261010.json';
const CLIENT_ANALYTICS_SINGLE_OWNER_V19_APPROVAL_PATH='governance/client-analytics-single-owner-clean-conclusion-v19-20261010.json';
const CLIENT_ANALYTICS_BUYER_V20_APPROVAL_PATH='governance/client-analytics-buyer-facing-insight-v20-20261010.json';
const CLIENT_HOME_LIVE_REFRESH_V1_APPROVAL_PATH='governance/client-home-live-source-refresh-v1-20261010.json';
const CLIENT_HOME_PENDING_REFRESH_V2_APPROVAL_PATH='governance/client-home-inflight-refresh-v2-20261010.json';
const CLIENT_CONTRACT_EVENT_DRIVEN_APPROVAL_PATH='governance/client-contract-event-driven-refresh-owner-approval-20260921.json';
const CLIENT_BACKGROUND_MANIFEST_EVENT_DRIVEN_APPROVAL_PATH='governance/client-background-manifest-event-driven-owner-approval-20260921.json';
const CLIENT_SIDEBAR_COMMAND_NAV_APPROVAL_PATH='governance/client-sidebar-command-nav-owner-approval-20260921.json';
const CLIENT_DEALS_STAGE_TABS_APPROVAL_PATH='governance/client-deals-lifecycle-tabs-owner-approval-20261003.json';
const CLIENT_DEALS_CLOSEOUT_APPROVAL_PATH='governance/client-deals-attention-closeout-owner-approval-20261005.json';
const CLIENT_DEALS_VISUAL_HIERARCHY_APPROVAL_PATH='governance/client-deals-visual-hierarchy-owner-approval-20261005.json';
const CLIENT_DEAL_ATTENTION_PAYMENTS_EXIT_APPROVAL_PATH='governance/client-deal-attention-payments-exit-owner-approval-20261004.json';
const policy=JSON.parse(await readFile(POLICY_PATH,'utf8'));
const applicationsApproval=JSON.parse(await readFile(APPLICATIONS_APPROVAL_PATH,'utf8'));
const dealsLoaderApproval=JSON.parse(await readFile(DEALS_LOADER_APPROVAL_PATH,'utf8'));
const clientLoadHotfixApproval=JSON.parse(await readFile(CLIENT_LOAD_HOTFIX_APPROVAL_PATH,'utf8'));
const ownerVisualDeltaApproval=JSON.parse(await readFile(OWNER_VISUAL_DELTA_APPROVAL_PATH,'utf8'));
const clientMultiContext430Approval=JSON.parse(await readFile(CLIENT_MULTI_CONTEXT_430_APPROVAL_PATH,'utf8'));
const clientSectionTypography110Approval=JSON.parse(await readFile(CLIENT_SECTION_TYPOGRAPHY_110_APPROVAL_PATH,'utf8'));
const clientPostreleaseIssue430Approval=JSON.parse(await readFile(CLIENT_POSTRELEASE_ISSUE430_APPROVAL_PATH,'utf8'));
const applicationBusinessV2Scope=JSON.parse(await readFile(APPLICATION_BUSINESS_V2_SCOPE_PATH,'utf8'));
const clientRailAdminMirrorApproval=JSON.parse(await readFile(CLIENT_RAIL_ADMIN_MIRROR_APPROVAL_PATH,'utf8'));
const clientRail670Approval=JSON.parse(await readFile(CLIENT_RAIL_670_APPROVAL_PATH,'utf8'));
const clientEventDrivenRefreshApproval=JSON.parse(await readFile(CLIENT_EVENT_DRIVEN_REFRESH_APPROVAL_PATH,'utf8'));
const clientCompanyDirectoryEventDrivenApproval=JSON.parse(await readFile(CLIENT_COMPANY_DIRECTORY_EVENT_DRIVEN_APPROVAL_PATH,'utf8'));
const clientMarketEventDrivenApproval=JSON.parse(await readFile(CLIENT_MARKET_EVENT_DRIVEN_APPROVAL_PATH,'utf8'));
const clientAnalyticsCurrentSourceApproval=JSON.parse(await readFile(CLIENT_ANALYTICS_CURRENT_SOURCE_APPROVAL_PATH,'utf8'));
const clientAnalyticsReentryApproval=JSON.parse(await readFile(CLIENT_ANALYTICS_REENTRY_APPROVAL_PATH,'utf8'));
const clientAnalyticsVisibilityApproval=JSON.parse(await readFile(CLIENT_ANALYTICS_VISIBILITY_APPROVAL_PATH,'utf8'));
const clientAnalyticsActiveRouteRecoveryApproval=JSON.parse(await readFile(CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_APPROVAL_PATH,'utf8'));
const clientAnalyticsCanonicalRestoreApproval=JSON.parse(await readFile(CLIENT_ANALYTICS_CANONICAL_RESTORE_APPROVAL_PATH,'utf8'));
const clientAnalyticsAuthorizedPriceApproval=JSON.parse(await readFile(CLIENT_ANALYTICS_AUTHORIZED_PRICE_APPROVAL_PATH,'utf8'));
const clientAnalyticsPublishedPriceApproval=JSON.parse(await readFile(CLIENT_ANALYTICS_PUBLISHED_PRICE_APPROVAL_PATH,'utf8'));
const clientAnalyticsAdminParityApproval=JSON.parse(await readFile(CLIENT_ANALYTICS_ADMIN_PARITY_APPROVAL_PATH,'utf8'));
const clientAnalyticsDtLpgV11Approval=JSON.parse(await readFile(CLIENT_ANALYTICS_DT_LPG_V11_APPROVAL_PATH,'utf8'));
const analyticsDailyV12Approval=JSON.parse(await readFile(ANALYTICS_DAILY_V12_APPROVAL_PATH,'utf8'));
const analyticsLpgV13Approval=JSON.parse(await readFile(ANALYTICS_LPG_V13_APPROVAL_PATH,'utf8'));
const clientAnalyticsNativeV17Approval=JSON.parse(await readFile(CLIENT_ANALYTICS_NATIVE_V17_APPROVAL_PATH,'utf8'));
const clientAnalyticsSingleOwnerV19Approval=JSON.parse(await readFile(CLIENT_ANALYTICS_SINGLE_OWNER_V19_APPROVAL_PATH,'utf8'));
const clientAnalyticsBuyerV20Approval=JSON.parse(await readFile(CLIENT_ANALYTICS_BUYER_V20_APPROVAL_PATH,'utf8'));
const clientHomeLiveRefreshV1Approval=JSON.parse(await readFile(CLIENT_HOME_LIVE_REFRESH_V1_APPROVAL_PATH,'utf8'));
const clientHomePendingRefreshV2Approval=JSON.parse(await readFile(CLIENT_HOME_PENDING_REFRESH_V2_APPROVAL_PATH,'utf8'));
const clientContractEventDrivenApproval=JSON.parse(await readFile(CLIENT_CONTRACT_EVENT_DRIVEN_APPROVAL_PATH,'utf8'));
const clientBackgroundManifestEventDrivenApproval=JSON.parse(await readFile(CLIENT_BACKGROUND_MANIFEST_EVENT_DRIVEN_APPROVAL_PATH,'utf8'));
const clientSidebarCommandNavApproval=JSON.parse(await readFile(CLIENT_SIDEBAR_COMMAND_NAV_APPROVAL_PATH,'utf8'));
const clientDealsStageTabsApproval=JSON.parse(await readFile(CLIENT_DEALS_STAGE_TABS_APPROVAL_PATH,'utf8'));
const clientDealsCloseoutApproval=JSON.parse(await readFile(CLIENT_DEALS_CLOSEOUT_APPROVAL_PATH,'utf8'));
const clientDealsVisualHierarchyApproval=JSON.parse(await readFile(CLIENT_DEALS_VISUAL_HIERARCHY_APPROVAL_PATH,'utf8'));
const clientDealAttentionPaymentsExitApproval=JSON.parse(await readFile(CLIENT_DEAL_ATTENTION_PAYMENTS_EXIT_APPROVAL_PATH,'utf8'));

if(policy.policy!=='RONA_CLIENT_PORTAL_VISUAL_FREEZE_V1')throw new Error('CLIENT_VISUAL_FREEZE_POLICY_ID_MISMATCH');
if(policy.status!=='FROZEN')throw new Error('CLIENT_VISUAL_FREEZE_NOT_ACTIVE');
if(policy.owner_instruction_required!==true)throw new Error('CLIENT_VISUAL_FREEZE_OWNER_GATE_DISABLED');
if(!policy.approval_marker||!String(policy.approval_marker).startsWith('OWNER_VISUAL_APPROVAL:'))throw new Error('CLIENT_VISUAL_FREEZE_APPROVAL_MARKER_INVALID');

const CLIENT_SIDEBAR_COMMAND_NAV_RUNTIME='assets/portal-runtime/client-sidebar-command-nav-v1.js';
const clientSidebarCommandNavExceptionAuthorized=
  clientSidebarCommandNavApproval?.approval==='OWNER_IN_CHAT'&&
  clientSidebarCommandNavApproval?.authorized_at==='2026-09-21'&&
  clientSidebarCommandNavApproval?.scope==='CLIENT_SIDEBAR_COMMAND_NAV_VISUAL_V1'&&
  Array.isArray(clientSidebarCommandNavApproval?.approved_new_runtime)&&
  clientSidebarCommandNavApproval.approved_new_runtime.length===1&&
  clientSidebarCommandNavApproval.approved_new_runtime[0]===CLIENT_SIDEBAR_COMMAND_NAV_RUNTIME&&
  clientSidebarCommandNavApproval?.required_marker==='20260921-client-sidebar-command-nav-v1'&&
  clientSidebarCommandNavApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientSidebarCommandNavApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientSidebarCommandNavApproval?.requirements?.wildcard_exception===false&&
  clientSidebarCommandNavApproval?.requirements?.sidebar_only===true&&
  clientSidebarCommandNavApproval?.requirements?.canonical_client_source_changed===false&&
  clientSidebarCommandNavApproval?.requirements?.sidebar_width_changed===false&&
  clientSidebarCommandNavApproval?.requirements?.business_data_changed===false&&
  clientSidebarCommandNavApproval?.requirements?.business_logic_changed===false&&
  clientSidebarCommandNavApproval?.requirements?.auth_changed===false&&
  clientSidebarCommandNavApproval?.requirements?.router_changed===false&&
  clientSidebarCommandNavApproval?.requirements?.navigation_click_behavior_changed===false&&
  clientSidebarCommandNavApproval?.requirements?.supabase_changed===false&&
  clientSidebarCommandNavApproval?.requirements?.finance_changed===false&&
  clientSidebarCommandNavApproval?.requirements?.rail_business_logic_changed===false&&
  clientSidebarCommandNavApproval?.requirements?.images_added===false&&
  clientSidebarCommandNavApproval?.requirements?.real_inline_svg_icons===true&&
  clientSidebarCommandNavApproval?.requirements?.legacy_glyph_icons_removed_from_rendered_sidebar===true&&
  clientSidebarCommandNavApproval?.requirements?.active_state_cyan_red_icon===true&&
  clientSidebarCommandNavApproval?.requirements?.attention_state_neon_red===true&&
  clientSidebarCommandNavApproval?.requirements?.explicit_attention_only===true&&
  clientSidebarCommandNavApproval?.requirements?.late_overwrite_self_heal===true&&
  clientSidebarCommandNavApproval?.requirements?.chromium_visual_proof_required===true;

const clientDealsStageTabsExceptionAuthorized=
  clientDealsStageTabsApproval?.approval==='OWNER_IN_CHAT'&&
  clientDealsStageTabsApproval?.authorized_at==='2026-10-03'&&
  clientDealsStageTabsApproval?.scope==='CLIENT_DEALS_LIFECYCLE_TABS_AND_REMOVE_STANDALONE_CLOSING_V1'&&
  clientDealsStageTabsApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientDealsStageTabsApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientDealsStageTabsApproval?.requirements?.wildcard_exception===false&&
  Array.isArray(clientDealsStageTabsApproval?.requirements?.client_deal_tabs)&&
  JSON.stringify(clientDealsStageTabsApproval.requirements.client_deal_tabs)===JSON.stringify(['ACTIVE','ATTENTION','COMPLETED'])&&
  clientDealsStageTabsApproval?.requirements?.standalone_closing_documents_removed===true&&
  clientDealsStageTabsApproval?.requirements?.deal_documents_preserved===true&&
  clientDealsStageTabsApproval?.requirements?.internal_deal_closing_stage_preserved===true&&
  clientDealsStageTabsApproval?.requirements?.claims_section_preserved===true&&
  clientDealsStageTabsApproval?.requirements?.hardcoded_deal_ids===false;

const CLIENT_DEALS_CLOSEOUT_FILES=[
  'assets/portal-runtime/client-deals-authoritative-v1.js',
  'scripts/attach-client-deals-authoritative-v1.mjs',
  'assets/portal-runtime/client-closeout-documents-v1.js'
];
const clientDealsCloseoutExceptionAuthorized=
  clientDealsCloseoutApproval?.approval==='OWNER_IN_CHAT'&&
  clientDealsCloseoutApproval?.authorized_at==='2026-10-05'&&
  clientDealsCloseoutApproval?.scope==='CLIENT_DEALS_ATTENTION_CLOSEOUT_PARITY_V1'&&
  clientDealsCloseoutApproval?.decision==='SCOPED_VISUAL_FREEZE_RELEASE'&&
  clientDealsCloseoutApproval?.requirements?.scope_attention_only===true&&
  clientDealsCloseoutApproval?.requirements?.active_deals_preserved===true&&
  clientDealsCloseoutApproval?.requirements?.passport_open_preserved===true&&
  clientDealsCloseoutApproval?.requirements?.canonical_visual_css_changed===false&&
  clientDealsCloseoutApproval?.requirements?.dedicated_closeout_workspace_allowed===true&&
  clientDealsCloseoutApproval?.requirements?.client_closeout_smgs_upload_allowed===true&&
  JSON.stringify(clientDealsCloseoutApproval?.requirements?.upload_kinds)===JSON.stringify(['SMGS_DELIVERY_STAMP','SMGS_EMPTY_WAGONS'])&&
  clientDealsCloseoutApproval?.requirements?.owner_completion_authority_preserved===true&&
  clientDealsCloseoutApproval?.requirements?.admin_impersonation_read_only===true&&
  clientDealsCloseoutApproval?.requirements?.deal_completion_mutation_from_client===false&&
  clientDealsCloseoutApproval?.requirements?.business_data_changed===false&&
  clientDealsCloseoutApproval?.requirements?.business_record_mutation===false&&
  clientDealsCloseoutApproval?.requirements?.hardcoded_deal_ids===false&&
  clientDealsCloseoutApproval?.requirements?.wildcard_exception===false&&
  clientDealsCloseoutApproval?.requirements?.exact_blob_enforcement===true&&
  clientDealsCloseoutApproval?.requirements?.scoped_unfreeze_only===true&&
  CLIENT_DEALS_CLOSEOUT_FILES.every(path=>Boolean(clientDealsCloseoutApproval?.exact_post_blobs?.[path]));

const CLIENT_DEALS_VISUAL_HIERARCHY_FILES=[
  'assets/portal-runtime/client-content-responsive-v1.css',
  'scripts/attach-client-content-responsive-v1.mjs'
];
const clientDealsVisualHierarchyExceptionAuthorized=
  clientDealsVisualHierarchyApproval?.approval==='OWNER_IN_CHAT'&&
  clientDealsVisualHierarchyApproval?.authorized_at==='2026-10-05'&&
  clientDealsVisualHierarchyApproval?.scope==='CLIENT_DEALS_VISUAL_HIERARCHY_V2'&&
  clientDealsVisualHierarchyApproval?.decision==='SCOPED_VISUAL_FREEZE_RELEASE'&&
  clientDealsVisualHierarchyApproval?.requirements?.deals_section_only===true&&
  clientDealsVisualHierarchyApproval?.requirements?.typography_hierarchy_changed===true&&
  clientDealsVisualHierarchyApproval?.requirements?.lifecycle_tab_status_colors_changed===true&&
  clientDealsVisualHierarchyApproval?.requirements?.closeout_metric_status_colors_changed===true&&
  clientDealsVisualHierarchyApproval?.requirements?.active_attention_completed_semantics_unchanged===true&&
  clientDealsVisualHierarchyApproval?.requirements?.business_data_changed===false&&
  clientDealsVisualHierarchyApproval?.requirements?.business_logic_changed===false&&
  clientDealsVisualHierarchyApproval?.requirements?.api_contract_changed===false&&
  clientDealsVisualHierarchyApproval?.requirements?.auth_changed===false&&
  clientDealsVisualHierarchyApproval?.requirements?.finance_changed===false&&
  clientDealsVisualHierarchyApproval?.requirements?.rail_changed===false&&
  clientDealsVisualHierarchyApproval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientDealsVisualHierarchyApproval?.requirements?.hardcoded_business_entities===false&&
  clientDealsVisualHierarchyApproval?.requirements?.images_added===false&&
  clientDealsVisualHierarchyApproval?.requirements?.unrelated_visual_changes===false&&
  clientDealsVisualHierarchyApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientDealsVisualHierarchyApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientDealsVisualHierarchyApproval?.requirements?.wildcard_exception===false&&
  clientDealsVisualHierarchyApproval?.requirements?.exact_blob_enforcement===true&&
  clientDealsVisualHierarchyApproval?.requirements?.scoped_unfreeze_only===true&&
  CLIENT_DEALS_VISUAL_HIERARCHY_FILES.every(path=>Boolean(clientDealsVisualHierarchyApproval?.exact_post_blobs?.[path]));

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
  'assets/portal-runtime/client-contract-download-v3.js',
  'scripts/attach-client-market-intelligence-v1.mjs'
];
const CLIENT_MULTI_CONTEXT_430_FILES=[
  'assets/portal-runtime/client-contract-download-v3.js'
];
const CLIENT_SECTION_TYPOGRAPHY_110_FILES=[
  'assets/portal-runtime/client-contract-download-v3.js'
];
const CLIENT_POSTRELEASE_ISSUE430_FILES=[
  'assets/portal-runtime/client-contract-download-v3.js'
];
const CLIENT_POSTRELEASE_ISSUE430_QA_WIRING_FILES=[
  '.github/workflows/client-owner-targeted-remediation-qa.yml'
];
const CLIENT_POSTRELEASE_ISSUE430_APPROVED_FILES=[...CLIENT_POSTRELEASE_ISSUE430_FILES,...CLIENT_POSTRELEASE_ISSUE430_QA_WIRING_FILES];
const CLIENT_SECTION_TYPOGRAPHY_110_FINALIZATION_FILES=[
  'governance/client-section-typography-110-owner-approval-20260909.json',
  'scripts/qa-client-portal-visual-freeze.mjs',
  'scripts/qa-client-section-typography-110-v1.mjs',
  'scripts/qa-client-typography-frame-overflow-freeze-v1.mjs'
];
const CLIENT_SECTION_TYPOGRAPHY_110_CORRECTIVE_FILES=[
  'governance/client-section-typography-110-owner-approval-20260909.json',
  'scripts/qa-client-portal-visual-freeze.mjs',
  'scripts/qa-client-section-typography-110-v1.mjs'
];
const CLIENT_COMPANY_DIRECTORY_EVENT_DRIVEN_FILES=[
  'assets/portal-runtime/portal-client-company-directory-authority-v1.js'
];
const clientCompanyDirectoryEventDrivenExceptionAuthorized=
  clientCompanyDirectoryEventDrivenApproval?.approval==='OWNER_IN_CHAT'&&
  clientCompanyDirectoryEventDrivenApproval?.authorized_at==='2026-09-21'&&
  clientCompanyDirectoryEventDrivenApproval?.scope==='CLIENT_COMPANY_DIRECTORY_EVENT_DRIVEN_REFRESH_V1'&&
  Array.isArray(clientCompanyDirectoryEventDrivenApproval?.approved_protected_files)&&
  clientCompanyDirectoryEventDrivenApproval.approved_protected_files.length===CLIENT_COMPANY_DIRECTORY_EVENT_DRIVEN_FILES.length&&
  CLIENT_COMPANY_DIRECTORY_EVENT_DRIVEN_FILES.every(path=>clientCompanyDirectoryEventDrivenApproval.approved_protected_files.includes(path))&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.wildcard_exception===false&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.visual_change===false&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.css_theme_typography_layout_changed===false&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.business_data_changed===false&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.business_logic_changed===false&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.auth_changed===false&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.periodic_refresh_removed===true&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.refresh_policy==='OPEN_DIRECTORY_EVENT_CONTEXT_PAGESHOW_INVALIDATION'&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.invalidation_event==='rona:client-company-directory-invalidated'&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.authorized_directory_event_preserved===true&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.pageshow_refresh_preserved===true&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.context_selection_authority_preserved===true&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.signed_contract_download_preserved===true&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.pr431_card_factory_visual_semantics_preserved===true&&
  clientCompanyDirectoryEventDrivenApproval?.requirements?.architect_pr_810_files_changed===false;

const PR431_DIRECT_FIX_FILES=[
  'assets/portal-runtime/portal-client-company-directory-authority-v1.js',
  'assets/portal-runtime/client-context-selection-authority-v1.js',
  'scripts/qa-client-owner-retest-authoritative-company-metrics-v5.mjs',
  '.github/workflows/client-owner-targeted-remediation-qa.yml'
];
const PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION={
  approval:'OWNER_SYSTEM_ADMIN_ISSUE_COMMENT',
  authorized_at:'2026-09-09',
  pr_number:431,
  branch:'hotfix/client-multiclient-parity-430-v1',
  system_admin_comment_id:5592583180,
  authorized_head:'0e2476ae4ab99479966d5801b4d14bbb9972a0b9',
  scope:'CLIENT_PR431_COMPANY_DIRECTORY_AND_APPLICATIONS_FUNCTIONAL_BUG_FIX_ONLY',
  exact_post_remediation_blobs:{
    'assets/portal-runtime/client-contract-download-v3.js':{
      visual_freeze_baseline_blob_sha:'2f420990529e37d0feae88dd33f0753a79b9cc4e',
      authorized_post_blob_sha:'0f0127c2efc750074026f6a483db51216bab8d32',
      required_marker:'authoritativeCompanyDirectoryOwnsCards'
    },
    'assets/portal-runtime/client-application-lifecycle-v1.js':{
      visual_freeze_baseline_blob_sha:'73e94188bff36e57a7f269a516ae655b2556ea2a',
      authorized_post_blob_sha:'aacb8fde011ed2f0c0c2f5db44d209081e77bab2',
      required_marker:'canonicalApplicationsOwnsDom'
    }
  },
  requirements:{
    visual_freeze_remains_enabled:true,
    exact_file_enforcement_remains_active:true,
    wildcard_exception:false,
    redesign:false,
    css_theme_typography_layout_changed:false,
    images_added:false,
    business_data_changed:false,
    supabase_schema_or_rls_changed:false,
    rail_changed:false,
    unrelated_refactor:false,
    cleanup:false,
    production_changed:false,
    merge_before_owner_retest:false
  }
};
const exactArray=(actual,expected)=>Array.isArray(actual)&&actual.length===expected.length&&actual.every((value,index)=>value===expected[index]);

const clientPostreleaseIssue430ExceptionAuthorized=
  clientPostreleaseIssue430Approval?.approval==='OWNER_SYSTEM_ADMIN_ISSUE_COMMENT'&&
  clientPostreleaseIssue430Approval?.authorized_at==='2026-09-11'&&
  clientPostreleaseIssue430Approval?.owner_comment_id===5627234321&&
  clientPostreleaseIssue430Approval?.system_admin_comment_id===5627544290&&
  clientPostreleaseIssue430Approval?.communication_rule_comment_id===5627880412&&
  clientPostreleaseIssue430Approval?.base_commit==='0f85c0455e2df319fed49b1a84016929a905e025'&&
  clientPostreleaseIssue430Approval?.scope==='CLIENT_POSTRELEASE_RESOURCE_AUTHORITY_AND_COMPANY_RACE_ONLY'&&
  exactArray(clientPostreleaseIssue430Approval?.approved_protected_files,CLIENT_POSTRELEASE_ISSUE430_APPROVED_FILES)&&
  clientPostreleaseIssue430Approval?.requirements?.historical_pr431_exact_parent_gate_rebound_only===true&&
  clientPostreleaseIssue430Approval?.requirements?.visual_freeze_remains_enabled===true&&
  clientPostreleaseIssue430Approval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientPostreleaseIssue430Approval?.requirements?.exact_blob_enforcement_remains_active===true&&
  clientPostreleaseIssue430Approval?.requirements?.wildcard_exception===false&&
  clientPostreleaseIssue430Approval?.requirements?.minimal_company_card_stabilization_only===true&&
  clientPostreleaseIssue430Approval?.requirements?.redesign===false&&
  clientPostreleaseIssue430Approval?.requirements?.css_changed===false&&
  clientPostreleaseIssue430Approval?.requirements?.theme_typography_layout_redesign_changed===false&&
  clientPostreleaseIssue430Approval?.requirements?.images_added===false&&
  clientPostreleaseIssue430Approval?.requirements?.resource_authority_scope_only===true&&
  clientPostreleaseIssue430Approval?.requirements?.company_race_scope_only===true&&
  clientPostreleaseIssue430Approval?.requirements?.business_data_changed===false&&
  clientPostreleaseIssue430Approval?.requirements?.production_business_data_mutation===false&&
  clientPostreleaseIssue430Approval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientPostreleaseIssue430Approval?.requirements?.auth_changed===false&&
  clientPostreleaseIssue430Approval?.requirements?.rail_changed===false&&
  clientPostreleaseIssue430Approval?.requirements?.production_changed===false&&
  clientPostreleaseIssue430Approval?.requirements?.merge_before_system_admin_review===false;

const clientSectionTypography110ExceptionAuthorized=
  clientSectionTypography110Approval?.approval==='OWNER_SYSTEM_ADMIN_ISSUE_COMMENT'&&
  clientSectionTypography110Approval?.authorized_at==='2026-09-09'&&
  clientSectionTypography110Approval?.pr_number===431&&
  clientSectionTypography110Approval?.branch==='hotfix/client-multiclient-parity-430-v1'&&
  clientSectionTypography110Approval?.system_admin_comment_id===5602689478&&
  clientSectionTypography110Approval?.correction_system_admin_comment_id===5603758040&&
  clientSectionTypography110Approval?.parent_sha==='0d3f4363e124647d9f3b72d377eb24240c5a4574'&&
  clientSectionTypography110Approval?.typography_finalization_base_sha==='0d3f4363e124647d9f3b72d377eb24240c5a4574'&&
  clientSectionTypography110Approval?.correction_parent_sha==='15ddfae3b5de2ff98b7ff40c25047bbdb2e7ba6a'&&
  exactArray(clientSectionTypography110Approval?.exact_factual_chain_to_correction_parent,['0d3f4363e124647d9f3b72d377eb24240c5a4574','ec718aac7efebf03a6d94637d3aa68d5dec276a3','15ddfae3b5de2ff98b7ff40c25047bbdb2e7ba6a'])&&
  clientSectionTypography110Approval?.typography_visual_base_sha==='d1a25b07624dd86633fbdf090afa356683eeb1dd'&&
  clientSectionTypography110Approval?.scope==='CLIENT_SECTION_TYPOGRAPHY_110_FINALIZATION_EXACT'&&
  exactArray(clientSectionTypography110Approval?.approved_protected_files,CLIENT_SECTION_TYPOGRAPHY_110_FILES)&&
  exactArray(clientSectionTypography110Approval?.finalization_changed_files,CLIENT_SECTION_TYPOGRAPHY_110_FINALIZATION_FILES)&&
  exactArray(clientSectionTypography110Approval?.corrective_changed_files,CLIENT_SECTION_TYPOGRAPHY_110_CORRECTIVE_FILES)&&
  clientSectionTypography110Approval?.approved_qa_workflow_wiring?.path==='.github/workflows/client-owner-targeted-remediation-qa.yml'&&
  clientSectionTypography110Approval?.approved_qa_workflow_wiring?.system_admin_comment_id===5602689478&&
  clientSectionTypography110Approval?.approved_qa_workflow_wiring?.authorized_blob_sha==='ae36d39a9081cf0da929c2340312d3098726be35'&&
  clientSectionTypography110Approval?.approved_qa_workflow_wiring?.historical_pr431_direct_fix_blob_sha==='7b9e1697daca02647c53b643b5d41e193fc02e26'&&
  clientSectionTypography110Approval?.approved_qa_workflow_wiring?.required_marker==='node scripts/qa-client-section-typography-110-v1.mjs'&&
  clientSectionTypography110Approval?.approved_qa_workflow_wiring?.scope==='TYPOGRAPHY_FINALIZATION_QA_WIRING_EXACT_ONLY'&&
  clientSectionTypography110Approval?.approved_qa_workflow_wiring?.wildcard_exception===false&&
  clientSectionTypography110Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.visual_freeze_baseline_blob_sha==='2f420990529e37d0feae88dd33f0753a79b9cc4e'&&
  clientSectionTypography110Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.authorized_parent_blob_sha==='2054fb7f54d4727ba5dd0bac2f688c3a90c66e65'&&
  clientSectionTypography110Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.authorized_post_blob_sha==='2054fb7f54d4727ba5dd0bac2f688c3a90c66e65'&&
  clientSectionTypography110Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.required_marker==='RONA_CLIENT_OWNER_SECTION_TYPOGRAPHY_110_V4_EXACT_PARENT'&&
  clientSectionTypography110Approval?.authorized_visual_delta?.client_section_content_scale===1.1&&
  clientSectionTypography110Approval?.authorized_visual_delta?.section_titles_effective_scale===1&&
  clientSectionTypography110Approval?.authorized_visual_delta?.analytics_effective_scale===1&&
  clientSectionTypography110Approval?.authorized_visual_delta?.shell_effective_scale===1&&
  clientSectionTypography110Approval?.authorized_visual_delta?.runtime_changed_in_finalization===false&&
  clientSectionTypography110Approval?.requirements?.visual_freeze_status_frozen===true&&
  clientSectionTypography110Approval?.requirements?.owner_instruction_required===true&&
  clientSectionTypography110Approval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientSectionTypography110Approval?.requirements?.exact_blob_enforcement_remains_active===true&&
  clientSectionTypography110Approval?.requirements?.wildcard_exception===false&&
  clientSectionTypography110Approval?.requirements?.approved_file_list_is_exact===true&&
  clientSectionTypography110Approval?.requirements?.exact_correction_parent_control===true&&
  clientSectionTypography110Approval?.requirements?.runtime_changed_in_finalization===false&&
  clientSectionTypography110Approval?.requirements?.frame_geometry_may_expand===false&&
  clientSectionTypography110Approval?.requirements?.horizontal_text_overflow_allowed===false&&
  clientSectionTypography110Approval?.requirements?.ellipsis_or_clipping_allowed===false&&
  clientSectionTypography110Approval?.requirements?.wrapping_required_if_needed===true&&
  exactArray(clientSectionTypography110Approval?.requirements?.desktop_widths_proven,[1920,1366])&&
  clientSectionTypography110Approval?.requirements?.font_scale_may_shrink===false&&
  clientSectionTypography110Approval?.requirements?.bug1_touch===false&&
  clientSectionTypography110Approval?.requirements?.bug2_touch===false&&
  clientSectionTypography110Approval?.requirements?.background_restoration_touch===false&&
  clientSectionTypography110Approval?.requirements?.backend_changed===false&&
  clientSectionTypography110Approval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientSectionTypography110Approval?.requirements?.rail_changed===false&&
  clientSectionTypography110Approval?.requirements?.business_data_changed===false&&
  clientSectionTypography110Approval?.requirements?.html_composition_changed===false&&
  clientSectionTypography110Approval?.requirements?.theme_colors_icons_spacing_changed===false&&
  clientSectionTypography110Approval?.requirements?.agent_xlsx_commission_changed===false&&
  clientSectionTypography110Approval?.requirements?.merge_before_owner_review===false&&
  clientSectionTypography110Approval?.requirements?.production_switch_before_owner_review===false;

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
  clientMultiContext430Approval?.system_admin_card_owner_comment_id===5573033812&&
  clientMultiContext430Approval?.branch==='hotfix/client-multiclient-parity-430-v1'&&
  clientMultiContext430Approval?.base_commit==='9797f7c7c5e8a003eaa19c520f4328a2001d5ce7'&&
  clientMultiContext430Approval?.scope==='CLIENT_MULTI_CONTEXT_AMOUNT_AND_COMPANY_METRICS_430'&&
  exactArray(clientMultiContext430Approval?.approved_protected_files,CLIENT_MULTI_CONTEXT_430_FILES)&&
  clientMultiContext430Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.visual_freeze_baseline_blob_sha==='2f420990529e37d0feae88dd33f0753a79b9cc4e'&&
  clientMultiContext430Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.production_pre_hotfix_blob_sha==='57e66a343bf199ab2076a0ff5f074ba71e79218c'&&
  clientMultiContext430Approval?.exact_post_remediation_blobs?.['assets/portal-runtime/client-contract-download-v3.js']?.authorized_post_blob_sha==='6f9c760179a878473f8684db0f47ca75c1d6eaff'&&
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
  clientMultiContext430Approval?.requirements?.company_metrics_context_switch_fail_closed===true&&
  clientMultiContext430Approval?.requirements?.company_card_owner_nearest_unique_visible_ancestor===true&&
  clientMultiContext430Approval?.requirements?.company_card_owner_search_bounded===true&&
  clientMultiContext430Approval?.requirements?.company_card_owner_shared_pending_ready===true&&
  clientMultiContext430Approval?.requirements?.company_card_owner_missing_ambiguous_fail_closed===true&&
  clientMultiContext430Approval?.requirements?.pending_requires_three_visible_neutral_metrics===true&&
  clientMultiContext430Approval?.requirements?.ready_requires_three_visible_authoritative_metrics===true&&
  clientMultiContext430Approval?.requirements?.stale_foreign_metrics_during_transition===false&&
  clientMultiContext430Approval?.requirements?.synthetic_future_context_generic===true&&
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

const pr431DirectFixGovernanceAuthorized=
  clientMultiContext430Approval?.pr431_direct_fix?.system_admin_comment_id===5592831513&&
  clientMultiContext430Approval?.pr431_direct_fix?.parent_sha==='fd56ca2d4fc9d2ea60df454c48de74c4af257ca6'&&
  clientMultiContext430Approval?.pr431_direct_fix?.scope==='CLIENT_PR431_ACTIVE_ONLY_COMPANY_DIRECTORY_AND_CANONICAL_APPLICATIONS_PRESERVATION'&&
  exactArray(clientMultiContext430Approval?.pr431_direct_fix?.approved_files,PR431_DIRECT_FIX_FILES)&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.visual_freeze_scoped_exception===true&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.exact_file_enforcement_remains_active===true&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.exact_blob_enforcement_remains_active===true&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.wildcard_exception===false&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.company_directory_owner_active_only===true&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.legacy_current_card_preserved_until_atomic_takeover===true&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.current_noncurrent_action_state_generic===true&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.signed_contract_source_per_directory_row===true&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.canonical_applications_same_node_preserved_during_legacy_render===true&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.application_open_then_projection_refresh_row_survives===true&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.backend_changed===false&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.business_data_changed===false&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.rail_changed===false&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.css_theme_typography_layout_changed===false&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.production_changed===false&&
  clientMultiContext430Approval?.pr431_direct_fix?.requirements?.merge_before_owner_retest===false;

const pr431TwoBugScopedFreezeExceptionAuthorized=
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.approval==='OWNER_SYSTEM_ADMIN_ISSUE_COMMENT'&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.authorized_at==='2026-09-09'&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.pr_number===431&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.branch==='hotfix/client-multiclient-parity-430-v1'&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.system_admin_comment_id===5592583180&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.authorized_head==='0e2476ae4ab99479966d5801b4d14bbb9972a0b9'&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.scope==='CLIENT_PR431_COMPANY_DIRECTORY_AND_APPLICATIONS_FUNCTIONAL_BUG_FIX_ONLY'&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.visual_freeze_remains_enabled===true&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.exact_file_enforcement_remains_active===true&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.wildcard_exception===false&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.redesign===false&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.css_theme_typography_layout_changed===false&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.images_added===false&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.business_data_changed===false&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.supabase_schema_or_rls_changed===false&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.rail_changed===false&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.unrelated_refactor===false&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.cleanup===false&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.production_changed===false&&
  PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.requirements.merge_before_owner_retest===false;

const applicationBusinessV2VisualExceptionAuthorized=
  applicationBusinessV2Scope?.authorization==='OWNER_IN_CHAT_SYSTEM_ADMIN_REREVIEW'&&
  applicationBusinessV2Scope?.task==='RONA-P1-CLIENT-INTAKE-2026-09-16-001'&&
  applicationBusinessV2Scope?.scope==='CLIENT_APPLICATIONS_LIFECYCLE_SYSTEMIC_FIX'&&
  applicationBusinessV2Scope?.owner_authority_correction_comment_id===5699785446&&
  applicationBusinessV2Scope?.visual_implementation_authorization==='OWNER_VISUAL_APPROVAL: CLIENT_APPLICATIONS_LIFECYCLE_SYSTEMIC_FIX_20260916'&&
  applicationBusinessV2Scope?.owner_visual_acceptance==='HOLD'&&
  applicationBusinessV2Scope?.production_acceptance==='PENDING'&&
  applicationBusinessV2Scope?.merge==='HOLD'&&
  applicationBusinessV2Scope?.deploy==='HOLD'&&
  applicationBusinessV2Scope?.unrelated_visual_changes===false;

const clientRailAdminMirrorExceptionAuthorized=
  clientRailAdminMirrorApproval?.approval==='OWNER_IN_CHAT'&&
  clientRailAdminMirrorApproval?.authorized_at==='2026-09-18'&&
  clientRailAdminMirrorApproval?.scope==='CLIENT_RAIL_ADMIN_VISUAL_MIRROR_20260918'&&
  Array.isArray(clientRailAdminMirrorApproval?.approved_protected_files)&&
  clientRailAdminMirrorApproval.approved_protected_files.length===1&&
  clientRailAdminMirrorApproval.approved_protected_files[0]==='assets/portal-runtime/client-rail-canonical-hero-v1.js'&&
  clientRailAdminMirrorApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientRailAdminMirrorApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientRailAdminMirrorApproval?.requirements?.wildcard_exception===false&&
  clientRailAdminMirrorApproval?.requirements?.scope_client_online_rail_only===true&&
  clientRailAdminMirrorApproval?.requirements?.mirror_admin_online_rail_geometry===true&&
  clientRailAdminMirrorApproval?.requirements?.square_map===true&&
  clientRailAdminMirrorApproval?.requirements?.aligned_left_frames===true&&
  clientRailAdminMirrorApproval?.requirements?.expanded_shared_width===true&&
  clientRailAdminMirrorApproval?.requirements?.preserve_client_authoritative_data_sources===true&&
  clientRailAdminMirrorApproval?.requirements?.preserve_business_logic===true&&
  clientRailAdminMirrorApproval?.requirements?.business_data_changed===false&&
  clientRailAdminMirrorApproval?.requirements?.auth_changed===false&&
  clientRailAdminMirrorApproval?.requirements?.images_added===false&&
  clientRailAdminMirrorApproval?.requirements?.unrelated_visual_changes===false;

const CLIENT_EVENT_DRIVEN_REFRESH_FILES=[
  'assets/portal-runtime/client-price-conditions-v1.js',
  'assets/portal-runtime/client-shell-guard-v3.js',
  'assets/portal-runtime/client-logout-visual-v1.js',
  'scripts/attach-client-logout-visual-v1.mjs',
  'assets/portal-runtime/client-payments-authoritative-v1.js',
  'scripts/attach-client-application-lifecycle.mjs'
];
const clientEventDrivenRefreshExceptionAuthorized=
  clientEventDrivenRefreshApproval?.approval==='OWNER_IN_CHAT'&&
  clientEventDrivenRefreshApproval?.authorized_at==='2026-09-21'&&
  clientEventDrivenRefreshApproval?.scope==='CLIENT_EVENT_DRIVEN_REFRESH_CLEANUP_V1'&&
  Array.isArray(clientEventDrivenRefreshApproval?.approved_protected_files)&&
  clientEventDrivenRefreshApproval.approved_protected_files.length===CLIENT_EVENT_DRIVEN_REFRESH_FILES.length&&
  CLIENT_EVENT_DRIVEN_REFRESH_FILES.every(path=>clientEventDrivenRefreshApproval.approved_protected_files.includes(path))&&
  clientEventDrivenRefreshApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientEventDrivenRefreshApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientEventDrivenRefreshApproval?.requirements?.wildcard_exception===false&&
  clientEventDrivenRefreshApproval?.requirements?.visual_redesign===false&&
  clientEventDrivenRefreshApproval?.requirements?.css_theme_typography_layout_changed===false&&
  clientEventDrivenRefreshApproval?.requirements?.business_data_changed===false&&
  clientEventDrivenRefreshApproval?.requirements?.business_logic_changed===false&&
  clientEventDrivenRefreshApproval?.requirements?.auth_changed===false&&
  clientEventDrivenRefreshApproval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientEventDrivenRefreshApproval?.requirements?.finance_changed===false&&
  clientEventDrivenRefreshApproval?.requirements?.rail_changed===false&&
  clientEventDrivenRefreshApproval?.requirements?.images_added===false&&
  clientEventDrivenRefreshApproval?.requirements?.unrelated_refactor===false&&
  clientEventDrivenRefreshApproval?.requirements?.perpetual_timer_removed===true&&
  clientEventDrivenRefreshApproval?.requirements?.event_driven_refresh_required===true&&
  clientEventDrivenRefreshApproval?.requirements?.no_background_polling_when_idle===true;

const CLIENT_DEAL_ATTENTION_PAYMENTS_EXIT_FILE='assets/portal-runtime/client-payments-authoritative-v1.js';
const clientDealAttentionPaymentsExitExceptionAuthorized=
  clientDealAttentionPaymentsExitApproval?.approval==='OWNER_IN_CHAT'&&
  clientDealAttentionPaymentsExitApproval?.authorized_at==='2026-10-04'&&
  clientDealAttentionPaymentsExitApproval?.scope==='CLIENT_DEAL_ATTENTION_PAYMENTS_EXIT_V1'&&
  Array.isArray(clientDealAttentionPaymentsExitApproval?.approved_protected_files)&&
  clientDealAttentionPaymentsExitApproval.approved_protected_files.length===1&&
  clientDealAttentionPaymentsExitApproval.approved_protected_files[0]===CLIENT_DEAL_ATTENTION_PAYMENTS_EXIT_FILE&&
  clientDealAttentionPaymentsExitApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientDealAttentionPaymentsExitApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientDealAttentionPaymentsExitApproval?.requirements?.wildcard_exception===false&&
  clientDealAttentionPaymentsExitApproval?.requirements?.visual_change===false&&
  clientDealAttentionPaymentsExitApproval?.requirements?.css_theme_typography_layout_changed===false&&
  clientDealAttentionPaymentsExitApproval?.requirements?.business_data_changed===false&&
  clientDealAttentionPaymentsExitApproval?.requirements?.business_logic_changed===true&&
  clientDealAttentionPaymentsExitApproval?.requirements?.auth_changed===false&&
  clientDealAttentionPaymentsExitApproval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientDealAttentionPaymentsExitApproval?.requirements?.rail_authority_preserved===true&&
  clientDealAttentionPaymentsExitApproval?.requirements?.finance_authority_preserved===true&&
  clientDealAttentionPaymentsExitApproval?.requirements?.client_context_authority_preserved===true&&
  clientDealAttentionPaymentsExitApproval?.requirements?.deal_attention_trigger==='RAIL_MONITORING_COMPLETED'&&
  clientDealAttentionPaymentsExitApproval?.requirements?.payments_exit_trigger==='RAIL_COMPLETED_AND_FINANCE_V7_AUTHORITATIVE_100_PERCENT_PAID'&&
  clientDealAttentionPaymentsExitApproval?.requirements?.confirmed_receipt_history_preserved===true&&
  clientDealAttentionPaymentsExitApproval?.requirements?.no_business_fact_mutation===true&&
  clientDealAttentionPaymentsExitApproval?.requirements?.no_background_polling_added===true&&
  clientDealAttentionPaymentsExitApproval?.requirements?.images_added===false&&
  clientDealAttentionPaymentsExitApproval?.requirements?.unrelated_visual_changes===false;

const CLIENT_MARKET_EVENT_DRIVEN_FILES=[
  'scripts/attach-client-market-intelligence-v1.mjs'
];
const clientMarketEventDrivenExceptionAuthorized=
  clientMarketEventDrivenApproval?.approval==='OWNER_IN_CHAT'&&
  clientMarketEventDrivenApproval?.authorized_at==='2026-09-21'&&
  clientMarketEventDrivenApproval?.scope==='CLIENT_MARKET_EVENT_DRIVEN_REFRESH_V1'&&
  Array.isArray(clientMarketEventDrivenApproval?.approved_protected_files)&&
  clientMarketEventDrivenApproval.approved_protected_files.length===CLIENT_MARKET_EVENT_DRIVEN_FILES.length&&
  CLIENT_MARKET_EVENT_DRIVEN_FILES.every(path=>clientMarketEventDrivenApproval.approved_protected_files.includes(path))&&
  clientMarketEventDrivenApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientMarketEventDrivenApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientMarketEventDrivenApproval?.requirements?.wildcard_exception===false&&
  clientMarketEventDrivenApproval?.requirements?.visual_change===false&&
  clientMarketEventDrivenApproval?.requirements?.admin_market_news_visual_parity_preserved===true&&
  clientMarketEventDrivenApproval?.requirements?.business_data_changed===false&&
  clientMarketEventDrivenApproval?.requirements?.business_logic_changed===false&&
  clientMarketEventDrivenApproval?.requirements?.auth_changed===false&&
  clientMarketEventDrivenApproval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientMarketEventDrivenApproval?.requirements?.periodic_refresh_removed===true&&
  clientMarketEventDrivenApproval?.requirements?.refresh_policy==='OPEN_CONTEXT_CHANGE_INVALIDATION'&&
  clientMarketEventDrivenApproval?.requirements?.no_background_polling_when_idle===true&&
  clientMarketEventDrivenApproval?.requirements?.background_preload_dependency===false;

const CLIENT_ANALYTICS_CURRENT_SOURCE_FILES=[
  'assets/portal-runtime/client-market-intelligence-v1.js',
  'scripts/attach-client-market-intelligence-v1.mjs'
];
const clientAnalyticsCurrentSourceExceptionAuthorized=
  clientAnalyticsCurrentSourceApproval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsCurrentSourceApproval?.authorized_at==='2026-10-09'&&
  clientAnalyticsCurrentSourceApproval?.scope==='CLIENT_ANALYTICS_CURRENT_SOURCE_SAFE_V3'&&
  clientAnalyticsCurrentSourceApproval?.decision==='SCOPED_VISUAL_FREEZE_RELEASE'&&
  clientAnalyticsCurrentSourceApproval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_ANALYTICS_CURRENT_SOURCE_SAFE_V3'&&
  JSON.stringify(clientAnalyticsCurrentSourceApproval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_CURRENT_SOURCE_FILES)&&
  clientAnalyticsCurrentSourceApproval?.requirements?.analytics_section_only===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.approved_current_client_safe_publication_only===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.source_freshness_gate_preserved===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.source_unavailable_fail_closed===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.market_values_not_manufactured===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.market_publication_authority_unchanged===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.auth_unchanged===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.other_client_sections_unchanged===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.admin_market_news_visual_parity_preserved===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.wildcard_exception===false&&
  clientAnalyticsCurrentSourceApproval?.requirements?.exact_blob_enforcement===true&&
  clientAnalyticsCurrentSourceApproval?.requirements?.scoped_unfreeze_only===true&&
  CLIENT_ANALYTICS_CURRENT_SOURCE_FILES.every(path=>Boolean(clientAnalyticsCurrentSourceApproval?.exact_post_blobs?.[path]));

const CLIENT_ANALYTICS_REENTRY_FILES=[
  'assets/portal-runtime/client-market-intelligence-v1.js',
  'scripts/attach-client-market-intelligence-v1.mjs'
];
const clientAnalyticsReentryExceptionAuthorized=
  clientAnalyticsReentryApproval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsReentryApproval?.authorized_at==='2026-10-09'&&
  clientAnalyticsReentryApproval?.scope==='CLIENT_ANALYTICS_REENTRY_GUARD_V4'&&
  clientAnalyticsReentryApproval?.decision==='SCOPED_VISUAL_FREEZE_RELEASE'&&
  clientAnalyticsReentryApproval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_ANALYTICS_REENTRY_GUARD_V4'&&
  clientAnalyticsReentryApproval?.supersedes_scope==='CLIENT_ANALYTICS_CURRENT_SOURCE_SAFE_V3'&&
  JSON.stringify(clientAnalyticsReentryApproval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_REENTRY_FILES)&&
  clientAnalyticsReentryApproval?.requirements?.analytics_section_only===true&&
  clientAnalyticsReentryApproval?.requirements?.only_legacy_visibility_reentry_fix===true&&
  clientAnalyticsReentryApproval?.requirements?.analytics_runtime_cache_busted===true&&
  clientAnalyticsReentryApproval?.requirements?.previous_analytics_source_safe_policies_preserved===true&&
  clientAnalyticsReentryApproval?.requirements?.approved_current_client_safe_publication_only===true&&
  clientAnalyticsReentryApproval?.requirements?.source_freshness_gate_preserved===true&&
  clientAnalyticsReentryApproval?.requirements?.source_unavailable_fail_closed===true&&
  clientAnalyticsReentryApproval?.requirements?.market_values_not_manufactured===true&&
  clientAnalyticsReentryApproval?.requirements?.market_publication_authority_unchanged===true&&
  clientAnalyticsReentryApproval?.requirements?.auth_unchanged===true&&
  clientAnalyticsReentryApproval?.requirements?.other_client_sections_unchanged===true&&
  clientAnalyticsReentryApproval?.requirements?.admin_market_news_visual_parity_preserved===true&&
  clientAnalyticsReentryApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientAnalyticsReentryApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientAnalyticsReentryApproval?.requirements?.wildcard_exception===false&&
  clientAnalyticsReentryApproval?.requirements?.exact_blob_enforcement===true&&
  clientAnalyticsReentryApproval?.requirements?.scoped_unfreeze_only===true&&
  CLIENT_ANALYTICS_REENTRY_FILES.every(path=>Boolean(clientAnalyticsReentryApproval?.exact_post_blobs?.[path]));

const CLIENT_ANALYTICS_VISIBILITY_FILES=[...CLIENT_ANALYTICS_REENTRY_FILES];
const clientAnalyticsVisibilityExceptionAuthorized=
  clientAnalyticsVisibilityApproval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsVisibilityApproval?.authorized_at==='2026-10-09'&&
  clientAnalyticsVisibilityApproval?.scope==='CLIENT_ANALYTICS_VISIBLE_OWNER_V5'&&
  clientAnalyticsVisibilityApproval?.decision==='SCOPED_VISUAL_FREEZE_RELEASE'&&
  clientAnalyticsVisibilityApproval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_ANALYTICS_VISIBLE_OWNER_V5'&&
  clientAnalyticsVisibilityApproval?.supersedes_scope==='CLIENT_ANALYTICS_REENTRY_GUARD_V4'&&
  clientAnalyticsReentryExceptionAuthorized&&
  JSON.stringify(clientAnalyticsVisibilityApproval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_VISIBILITY_FILES)&&
  clientAnalyticsVisibilityApproval?.requirements?.analytics_section_only===true&&
  clientAnalyticsVisibilityApproval?.requirements?.visible_published_current_owner_only===true&&
  clientAnalyticsVisibilityApproval?.requirements?.canonical_legacy_id_remains_hidden===true&&
  clientAnalyticsVisibilityApproval?.requirements?.market_values_not_manufactured===true&&
  clientAnalyticsVisibilityApproval?.requirements?.published_current_gate_preserved===true&&
  clientAnalyticsVisibilityApproval?.requirements?.source_unavailable_fail_closed===true&&
  clientAnalyticsVisibilityApproval?.requirements?.auth_unchanged===true&&
  clientAnalyticsVisibilityApproval?.requirements?.other_client_sections_unchanged===true&&
  clientAnalyticsVisibilityApproval?.requirements?.market_publication_authority_unchanged===true&&
  clientAnalyticsVisibilityApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientAnalyticsVisibilityApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientAnalyticsVisibilityApproval?.requirements?.exact_blob_enforcement===true&&
  clientAnalyticsVisibilityApproval?.requirements?.wildcard_exception===false&&
  clientAnalyticsVisibilityApproval?.requirements?.scoped_unfreeze_only===true&&
  clientAnalyticsVisibilityApproval?.requirements?.chromium_visible_viewport_test_required===true&&
  clientAnalyticsVisibilityApproval?.requirements?.script_cache_busted===true&&
  CLIENT_ANALYTICS_VISIBILITY_FILES.every(path=>Boolean(clientAnalyticsVisibilityApproval?.exact_post_blobs?.[path]));

const CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_FILES=[...CLIENT_ANALYTICS_VISIBILITY_FILES];
const clientAnalyticsActiveRouteRecoveryExceptionAuthorized=
  clientAnalyticsActiveRouteRecoveryApproval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsActiveRouteRecoveryApproval?.authorized_at==='2026-10-09'&&
  clientAnalyticsActiveRouteRecoveryApproval?.scope==='CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_V6'&&
  clientAnalyticsActiveRouteRecoveryApproval?.decision==='SCOPED_VISUAL_FREEZE_RELEASE'&&
  clientAnalyticsActiveRouteRecoveryApproval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_V6'&&
  clientAnalyticsActiveRouteRecoveryApproval?.supersedes_scope==='CLIENT_ANALYTICS_VISIBLE_OWNER_V5'&&
  clientAnalyticsVisibilityExceptionAuthorized&&
  JSON.stringify(clientAnalyticsActiveRouteRecoveryApproval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_FILES)&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.analytics_section_only===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.current_published_owner_only===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.recover_nav_selected_hidden_route===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.recover_late_inline_owner_display_none===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.cleanup_on_deselection===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.archived_analytics_hidden===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.market_freshness_gate_unchanged===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.source_unavailable_fail_closed===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.auth_unchanged===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.other_client_sections_unchanged===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.market_publication_authority_unchanged===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.exact_blob_enforcement===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.wildcard_exception===false&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.scoped_unfreeze_only===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.real_canonical_browser_reentry_and_injected_hide_test_required===true&&
  clientAnalyticsActiveRouteRecoveryApproval?.requirements?.script_cache_busted===true&&
  CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_FILES.every(path=>Boolean(clientAnalyticsActiveRouteRecoveryApproval?.exact_post_blobs?.[path]));

const CLIENT_ANALYTICS_CANONICAL_RESTORE_FILES=[...CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_FILES];
const clientAnalyticsCanonicalRestoreExceptionAuthorized=
  clientAnalyticsCanonicalRestoreApproval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsCanonicalRestoreApproval?.authorized_at==='2026-10-09'&&
  clientAnalyticsCanonicalRestoreApproval?.scope==='CLIENT_ANALYTICS_CANONICAL_RESTORE_V7'&&
  clientAnalyticsCanonicalRestoreApproval?.decision==='SCOPED_VISUAL_FREEZE_RESTORATION'&&
  clientAnalyticsCanonicalRestoreApproval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_ANALYTICS_CANONICAL_RESTORE_V7'&&
  clientAnalyticsCanonicalRestoreApproval?.supersedes_scope==='CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_V6'&&
  clientAnalyticsActiveRouteRecoveryExceptionAuthorized&&
  JSON.stringify(clientAnalyticsCanonicalRestoreApproval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_CANONICAL_RESTORE_FILES)&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.restore_existing_canonical_node_only===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.preserve_an2_hero_kpis_controls_chart_forecast_prices_commentary===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.no_substitute_owner_cards===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.no_static_history_exposed_as_current===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.current_only_client_published_feed===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.api_error_fail_closed===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.canonical_view_set_payload_only===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.market_publication_authority_unchanged===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.auth_and_impersonation_unchanged===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.no_business_data_mutation===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.original_client_canonical_source_unchanged===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.source_safe_prepaint_required===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.native_chart_no_fake_values===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.chromium_real_canonical_visual_parity_required===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.exact_blob_enforcement===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.scoped_unfreeze_only===true&&
  clientAnalyticsCanonicalRestoreApproval?.requirements?.wildcard_exception===false&&
  CLIENT_ANALYTICS_CANONICAL_RESTORE_FILES.every(path=>Boolean(clientAnalyticsCanonicalRestoreApproval?.exact_post_blobs?.[path]));

const CLIENT_ANALYTICS_AUTHORIZED_PRICE_FILES=[...CLIENT_ANALYTICS_CANONICAL_RESTORE_FILES];
const clientAnalyticsAuthorizedPriceException=
  clientAnalyticsAuthorizedPriceApproval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsAuthorizedPriceApproval?.authorized_at==='2026-10-09'&&
  clientAnalyticsAuthorizedPriceApproval?.scope==='CLIENT_ANALYTICS_AUTHORIZED_CONTEXT_PRICE_BRIDGE_V8'&&
  clientAnalyticsAuthorizedPriceApproval?.decision==='SCOPED_DATA_ONLY_VISUAL_FREEZE_PRESERVED'&&
  clientAnalyticsAuthorizedPriceApproval?.approval_marker==='OWNER_DATA_APPROVAL: CLIENT_ANALYTICS_AUTHORIZED_CONTEXT_PRICE_BRIDGE_V8'&&
  clientAnalyticsAuthorizedPriceApproval?.supersedes_scope==='CLIENT_ANALYTICS_CANONICAL_RESTORE_V7'&&
  clientAnalyticsCanonicalRestoreExceptionAuthorized&&
  JSON.stringify(clientAnalyticsAuthorizedPriceApproval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_AUTHORIZED_PRICE_FILES)&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.restore_existing_canonical_node_only===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.identical_css_html_dom_structure===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.no_new_cards_or_chart_types===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.auth_and_impersonation_unchanged===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.market_source_freshness_gate_unchanged===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.raw_platts_private===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.commercial_prices_from_client_price_sync_only===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.contract_and_client_id_both_must_match===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.price_sync_authority_required===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.missing_or_ambiguous_prices_fail_closed===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.context_switch_clears_previous_client_prices===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.preserve_original_visual_freeze===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.exact_file_enforcement===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.exact_blob_enforcement===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.scoped_data_only===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.no_database_or_authoritative_publication_changes===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.real_canonical_browser_tests_required===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.rollback_documented===true&&
  clientAnalyticsAuthorizedPriceApproval?.requirements?.no_wildcard_exception===true&&
  CLIENT_ANALYTICS_AUTHORIZED_PRICE_FILES.every(path=>Boolean(clientAnalyticsAuthorizedPriceApproval?.exact_post_blobs?.[path]));

const CLIENT_ANALYTICS_PUBLISHED_PRICE_FILES=[...CLIENT_ANALYTICS_AUTHORIZED_PRICE_FILES];
const clientAnalyticsPublishedPriceException=
  clientAnalyticsPublishedPriceApproval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsPublishedPriceApproval?.authorized_at==='2026-10-09'&&
  clientAnalyticsPublishedPriceApproval?.scope==='CLIENT_ANALYTICS_PUBLISHED_PRICE_PRESENTATION_V9'&&
  clientAnalyticsPublishedPriceApproval?.decision==='DATA_TEXT_ONLY_NO_VISUAL_STRUCTURE_CHANGE'&&
  clientAnalyticsPublishedPriceApproval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_ANALYTICS_PUBLISHED_PRICE_PRESENTATION_V9'&&
  clientAnalyticsPublishedPriceApproval?.supersedes_scope==='CLIENT_ANALYTICS_AUTHORIZED_CONTEXT_PRICE_BRIDGE_V8'&&
  clientAnalyticsAuthorizedPriceException&&
  JSON.stringify(clientAnalyticsPublishedPriceApproval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_PUBLISHED_PRICE_FILES)&&
  clientAnalyticsPublishedPriceApproval?.requirements?.canonical_design_exactly_retained===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.no_html_css_dom_change===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.no_new_cards_or_controls===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.only_existing_slot_texts_changed===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.client_and_contract_authority_unchanged===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.source_scoped_to_published_contract_price===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.prominent_existing_price_base_slot===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.source_type_clearly_labeled===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.low_high_forecasts_not_fabricated===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.no_admin_quote_disclosure===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.no_raw_platts_source===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.existing_client_market_freshness_preserved===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.missing_ambiguous_price_fail_closed===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.context_switch_clears_prior_value===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.exact_sha_protection===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.no_wildcard_exception===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.rollback_to_v8_exact_blobs===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.no_business_data_mutation===true&&
  clientAnalyticsPublishedPriceApproval?.requirements?.real_chromium_and_visual_freeze_required===true&&
  CLIENT_ANALYTICS_PUBLISHED_PRICE_FILES.every(path=>Boolean(clientAnalyticsPublishedPriceApproval?.exact_post_blobs?.[path]));
const CLIENT_ANALYTICS_ADMIN_PARITY_FILES=[...CLIENT_ANALYTICS_PUBLISHED_PRICE_FILES];
const clientAnalyticsAdminParityException=
  clientAnalyticsAdminParityApproval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsAdminParityApproval?.authorized_at==='2026-10-09'&&
  clientAnalyticsAdminParityApproval?.scope==='CLIENT_ANALYTICS_ADMIN_PARITY_V10'&&
  clientAnalyticsAdminParityApproval?.decision==='DATA_BINDING_ONLY_FROZEN_VISUAL_UNCHANGED'&&
  clientAnalyticsAdminParityApproval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_ANALYTICS_ADMIN_PARITY_V10'&&
  clientAnalyticsAdminParityApproval?.supersedes_scope==='CLIENT_ANALYTICS_PUBLISHED_PRICE_PRESENTATION_V9'&&
  clientAnalyticsPublishedPriceException&&
  JSON.stringify(clientAnalyticsAdminParityApproval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_ADMIN_PARITY_FILES)&&
  [
    'canonical_design_exactly_retained','no_html_css_dom_change','no_new_cards_or_controls',
    'only_existing_slots_and_native_charts','admin_canonical_source_model_reused',
    'commercial_director_market_authority_preserved','client_role_scope_mandatory',
    'no_admin_internal_pricing_bridge_exposed','published_current_product_gate_preserved',
    'forecasts_source_locked','client_published_contract_prices_preserved',
    'context_switch_clears_prior_price','api_error_fail_closed','no_business_data_mutation',
    'visual_freeze_remains_enabled','exact_file_enforcement_remains_active',
    'exact_blob_enforcement','scoped_unfreeze_only','real_chromium_and_visual_freeze_required'
  ].every(k=>clientAnalyticsAdminParityApproval?.requirements?.[k]===true)&&
  clientAnalyticsAdminParityApproval?.requirements?.wildcard_exception===false&&
  CLIENT_ANALYTICS_ADMIN_PARITY_FILES.every(path=>Boolean(clientAnalyticsAdminParityApproval?.exact_post_blobs?.[path]));
const CLIENT_ANALYTICS_DT_LPG_V11_FILES=[...CLIENT_ANALYTICS_ADMIN_PARITY_FILES];
const clientAnalyticsDtLpgV11Exception=
  clientAnalyticsDtLpgV11Approval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsDtLpgV11Approval?.authorized_at==='2026-10-09'&&
  clientAnalyticsDtLpgV11Approval?.scope==='CLIENT_ANALYTICS_DT_LPG_FORECAST_SOURCE_SAFE_V11'&&
  clientAnalyticsDtLpgV11Approval?.decision==='SOURCE_SCOPED_DATA_BINDING_AND_PRODUCT_LABEL_CORRECTION_NO_VISUAL_STRUCTURE_CHANGE'&&
  clientAnalyticsDtLpgV11Approval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_ANALYTICS_DT_LPG_FORECAST_SOURCE_SAFE_V11'&&
  clientAnalyticsDtLpgV11Approval?.supersedes_scope==='CLIENT_ANALYTICS_ADMIN_PARITY_V10'&&
  clientAnalyticsAdminParityException&&
  JSON.stringify(clientAnalyticsDtLpgV11Approval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_DT_LPG_V11_FILES)&&
  [
    'canonical_an2_design_exactly_retained','no_html_css_dom_change',
    'no_new_cards_or_controls','client_context_and_contract_scope_preserved',
    'published_verified_client_audience_gate','physical_spot_current_only_gate_preserved',
    'dt_physical_stale_not_shown_as_current','lpg_regional_unverified_not_shown_as_current',
    'confirmed_platts_forward_as_of_date_required','forecast_indicative_not_spot',
    'forecast_source_ref_and_doc_status_locked','commercial_director_source_ownership_preserved',
    'admin_internal_rona_prices_not_exposed','selected_product_chart_labels_corrected',
    'context_switch_clears_prices','api_error_fail_closed',
    'visual_freeze_remains_enabled','exact_file_enforcement_remains_active',
    'exact_blob_enforcement','scoped_unfreeze_only',
    'real_browser_and_production_proof_required','no_business_data_mutation'
  ].every(k=>clientAnalyticsDtLpgV11Approval?.requirements?.[k]===true)&&
  clientAnalyticsDtLpgV11Approval?.requirements?.wildcard_exception===false&&
  CLIENT_ANALYTICS_DT_LPG_V11_FILES.every(path=>Boolean(clientAnalyticsDtLpgV11Approval?.exact_post_blobs?.[path]));
const ANALYTICS_DAILY_V12_FILES=[...CLIENT_ANALYTICS_DT_LPG_V11_FILES];
const analyticsDailyV12Exception=
  analyticsDailyV12Approval?.approval==='OWNER_IN_CHAT'&&
  analyticsDailyV12Approval?.authorized_at==='2026-10-09'&&
  analyticsDailyV12Approval?.scope==='ANALYTICS_DAILY_OBSERVATIONS_NO_EMPTY_OVERLAY_V12'&&
  analyticsDailyV12Approval?.decision==='DATA_SEMANTICS_AND_EXISTING_EMPTY_STATE_CORRECTION_NO_RELAYOUT'&&
  analyticsDailyV12Approval?.approval_marker==='OWNER_VISUAL_APPROVAL: ANALYTICS_DAILY_OBSERVATIONS_NO_EMPTY_OVERLAY_V12'&&
  analyticsDailyV12Approval?.supersedes_scope==='CLIENT_ANALYTICS_DT_LPG_FORECAST_SOURCE_SAFE_V11'&&
  clientAnalyticsDtLpgV11Exception&&
  JSON.stringify(analyticsDailyV12Approval?.approved_protected_files)===JSON.stringify(ANALYTICS_DAILY_V12_FILES)&&
  [
    'no_owner_approved_html_layout_change','no_original_css_layout_change',
    'existing_empty_overlay_removed_only_if_series','no_new_controls_or_cards',
    'client_native_an2_graph_preserved','admin_client_single_daily_data_function',
    'observation_dates_not_maturity_months','monthly_forecast_separate',
    'dt_same_physical_component_basis','lpg_fixed_maturity_per_displayed_segment',
    'source_gaps_not_interpolated','source_verified_platts_documents_only',
    'client_published_product_permissions_retained',
    'commercial_director_market_data_authority_preserved',
    'stale_bnk_composite_not_claimed_current','stale_lpg_regional_not_claimed_current',
    'no_admin_internal_margin_or_price_bridge_in_client',
    'selected_contract_price_scope_preserved','context_switch_fail_closed',
    'no_business_data_mutation','exact_blob_freeze_enabled',
    'owner_approved_exact_two_protected_files','rollback_point_documented',
    'real_browser_qas_required'
  ].every(k=>analyticsDailyV12Approval?.requirements?.[k]===true)&&
  analyticsDailyV12Approval?.requirements?.wildcard_exception===false&&
  ANALYTICS_DAILY_V12_FILES.every(path=>Boolean(analyticsDailyV12Approval?.exact_post_blobs?.[path]));
const ANALYTICS_LPG_V13_FILES=[...ANALYTICS_DAILY_V12_FILES];
const analyticsLpgV13Exception=
  analyticsLpgV13Approval?.approval==='OWNER_IN_CHAT'&&
  analyticsLpgV13Approval?.scope==='ANALYTICS_LPG_GAP_HISTORY_V13'&&
  analyticsLpgV13Approval?.decision==='EXACT_FROZEN_VISUAL_GAP_MARKERS_AND_DATED_HISTORY_ONLY'&&
  analyticsLpgV13Approval?.approval_marker==='OWNER_VISUAL_APPROVAL: ANALYTICS_LPG_GAP_HISTORY_V13'&&
  analyticsLpgV13Approval?.supersedes_scope==='ANALYTICS_DAILY_OBSERVATIONS_NO_EMPTY_OVERLAY_V12'&&
  analyticsDailyV12Exception&&
  JSON.stringify(analyticsLpgV13Approval?.approved_protected_files)===JSON.stringify(ANALYTICS_LPG_V13_FILES)&&
  analyticsLpgV13Approval?.requirements?.lpg_full_verified_same_contract_history===true&&
  analyticsLpgV13Approval?.requirements?.lpg_gap_interpolation_forbidden===true&&
  analyticsLpgV13Approval?.requirements?.wildcard_exception===false&&
  ANALYTICS_LPG_V13_FILES.every(path=>Boolean(analyticsLpgV13Approval?.exact_post_blobs?.[path]));





// Exact Owner V17 supersession applies to ONE protected Analytics runtime only.
const CLIENT_ANALYTICS_NATIVE_V17_RUNTIME='assets/portal-runtime/client-market-intelligence-v1.js';
const clientAnalyticsNativeV17ExceptionAuthorized=
  clientAnalyticsNativeV17Approval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsNativeV17Approval?.authorized_at==='2026-10-10'&&
  clientAnalyticsNativeV17Approval?.scope==='CLIENT_ANALYTICS_NATIVE_FUNCTIONALITY_V17'&&
  clientAnalyticsNativeV17Approval?.decision==='OWNER_EXPLICIT_TEXT_AND_DATA_FUNCTIONAL_DELTA_ONLY'&&
  analyticsLpgV13Exception&&
  clientAnalyticsNativeV17Approval?.source_lock?.previous_client_runtime_blob===
    analyticsLpgV13Approval?.exact_post_blobs?.[CLIENT_ANALYTICS_NATIVE_V17_RUNTIME]?.authorized_post_blob_sha&&
  clientAnalyticsNativeV17Approval?.source_lock?.new_client_runtime_blob==='122d07c847bf5522a095f524c91d410f6633d6d9'&&
  clientAnalyticsNativeV17Approval?.requirements?.visual_freeze_remains_enabled===true&&
  clientAnalyticsNativeV17Approval?.requirements?.exact_blob_enforcement===true&&
  clientAnalyticsNativeV17Approval?.requirements?.exact_file_enforcement===true&&
  clientAnalyticsNativeV17Approval?.requirements?.wildcard_exception===false&&
  clientAnalyticsNativeV17Approval?.requirements?.no_css_or_html_change===true&&
  clientAnalyticsNativeV17Approval?.requirements?.other_sections_unchanged===true&&
  clientAnalyticsNativeV17Approval?.approved_protected_files?.includes(CLIENT_ANALYTICS_NATIVE_V17_RUNTIME);
  
const CLIENT_ANALYTICS_SINGLE_OWNER_V19_FILES=[
  'assets/portal-runtime/client-market-intelligence-v1.js',
  'scripts/attach-client-market-intelligence-v1.mjs'
];
const clientAnalyticsSingleOwnerV19ExceptionAuthorized=
  clientAnalyticsNativeV17ExceptionAuthorized&&
  clientAnalyticsSingleOwnerV19Approval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsSingleOwnerV19Approval?.authorized_at==='2026-10-10'&&
  clientAnalyticsSingleOwnerV19Approval?.scope==='CLIENT_ANALYTICS_SINGLE_OWNER_CLEAN_CONCLUSION_V19'&&
  clientAnalyticsSingleOwnerV19Approval?.decision==='SCOPED_VISUAL_FREEZE_RELEASE'&&
  clientAnalyticsSingleOwnerV19Approval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_ANALYTICS_SINGLE_OWNER_CLEAN_CONCLUSION_V19'&&
  clientAnalyticsSingleOwnerV19Approval?.supersedes_scope==='CLIENT_ANALYTICS_NATIVE_FUNCTIONALITY_V17'&&
  JSON.stringify(clientAnalyticsSingleOwnerV19Approval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_SINGLE_OWNER_V19_FILES)&&
  clientAnalyticsSingleOwnerV19Approval?.requirements?.exact_blob_enforcement===true&&
  clientAnalyticsSingleOwnerV19Approval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientAnalyticsSingleOwnerV19Approval?.requirements?.visual_freeze_remains_enabled===true&&
  clientAnalyticsSingleOwnerV19Approval?.requirements?.wildcard_exception===false&&
  clientAnalyticsSingleOwnerV19Approval?.requirements?.layout_css_html_unchanged===true&&
  clientAnalyticsSingleOwnerV19Approval?.requirements?.tenant_context_change_fail_closed===true&&
  clientAnalyticsSingleOwnerV19Approval?.requirements?.other_client_sections_unchanged===true&&
  CLIENT_ANALYTICS_SINGLE_OWNER_V19_FILES.every(path=>Boolean(clientAnalyticsSingleOwnerV19Approval?.exact_post_blobs?.[path]));

const CLIENT_ANALYTICS_BUYER_V20_FILES=[...CLIENT_ANALYTICS_SINGLE_OWNER_V19_FILES];
const clientAnalyticsBuyerV20ExceptionAuthorized=
  clientAnalyticsSingleOwnerV19ExceptionAuthorized&&
  clientAnalyticsBuyerV20Approval?.approval==='OWNER_IN_CHAT'&&
  clientAnalyticsBuyerV20Approval?.authorized_at==='2026-10-10'&&
  clientAnalyticsBuyerV20Approval?.scope==='CLIENT_ANALYTICS_BUYER_FACING_INSIGHT_V20'&&
  clientAnalyticsBuyerV20Approval?.decision==='SCOPED_TEXT_PRESENTATION_AND_FOOTER_VISIBILITY_ONLY'&&
  clientAnalyticsBuyerV20Approval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_ANALYTICS_BUYER_FACING_INSIGHT_V20'&&
  clientAnalyticsBuyerV20Approval?.supersedes_scope==='CLIENT_ANALYTICS_SINGLE_OWNER_CLEAN_CONCLUSION_V19'&&
  JSON.stringify(clientAnalyticsBuyerV20Approval?.approved_protected_files)===JSON.stringify(CLIENT_ANALYTICS_BUYER_V20_FILES)&&
  clientAnalyticsBuyerV20Approval?.requirements?.exact_blob_enforcement===true&&
  clientAnalyticsBuyerV20Approval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientAnalyticsBuyerV20Approval?.requirements?.visual_freeze_remains_enabled===true&&
  clientAnalyticsBuyerV20Approval?.requirements?.wildcard_exception===false&&
  clientAnalyticsBuyerV20Approval?.requirements?.source_diagnostic_footer_hidden_only_in_client_an2===true&&
  clientAnalyticsBuyerV20Approval?.requirements?.exact_canonical_dom_preserved===true&&
  clientAnalyticsBuyerV20Approval?.requirements?.other_client_sections_unchanged===true&&
  CLIENT_ANALYTICS_BUYER_V20_FILES.every(path=>Boolean(clientAnalyticsBuyerV20Approval?.exact_post_blobs?.[path]));

const CLIENT_HOME_LIVE_REFRESH_V1_FILE='assets/portal-runtime/client-home-command-center-v2.js';
const clientHomeLiveRefreshV1Authorized=
  clientHomeLiveRefreshV1Approval?.approval==='OWNER_IN_CHAT'&&
  clientHomeLiveRefreshV1Approval?.authorized_at==='2026-10-10'&&
  clientHomeLiveRefreshV1Approval?.scope==='CLIENT_HOME_LIVE_SOURCE_REFRESH_V1'&&
  clientHomeLiveRefreshV1Approval?.decision==='SCOPED_TECHNICAL_REFRESH_AND_NAVIGATION_FIX'&&
  clientHomeLiveRefreshV1Approval?.approval_marker==='OWNER_FUNCTIONAL_APPROVAL: CLIENT_HOME_LIVE_SOURCE_REFRESH_V1'&&
  JSON.stringify(clientHomeLiveRefreshV1Approval?.approved_protected_files)===JSON.stringify([CLIENT_HOME_LIVE_REFRESH_V1_FILE])&&
  clientHomeLiveRefreshV1Approval?.requirements?.client_home_only===true&&
  clientHomeLiveRefreshV1Approval?.requirements?.refresh_interval_ms===30000&&
  clientHomeLiveRefreshV1Approval?.requirements?.no_business_calculation_changes===true&&
  clientHomeLiveRefreshV1Approval?.requirements?.visual_freeze_remains_enabled===true&&
  clientHomeLiveRefreshV1Approval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientHomeLiveRefreshV1Approval?.requirements?.exact_blob_enforcement===true&&
  clientHomeLiveRefreshV1Approval?.requirements?.wildcard_exception===false&&
  Boolean(clientHomeLiveRefreshV1Approval?.exact_post_blobs?.[CLIENT_HOME_LIVE_REFRESH_V1_FILE]);

const clientHomePendingRefreshV2Authorized=
  clientHomeLiveRefreshV1Authorized&&
  clientHomePendingRefreshV2Approval?.approval==='OWNER_IN_CHAT'&&
  clientHomePendingRefreshV2Approval?.scope==='CLIENT_HOME_INFLIGHT_INVALIDATION_COALESCING_V2'&&
  clientHomePendingRefreshV2Approval?.decision==='SCOPED_TECHNICAL_RACE_CORRECTION_ONLY'&&
  clientHomePendingRefreshV2Approval?.approval_marker==='OWNER_VISUAL_APPROVAL: CLIENT_HOME_INFLIGHT_INVALIDATION_COALESCING_V2'&&
  clientHomePendingRefreshV2Approval?.supersedes_scope==='CLIENT_HOME_LIVE_SOURCE_REFRESH_V1'&&
  JSON.stringify(clientHomePendingRefreshV2Approval?.approved_protected_files)===JSON.stringify([CLIENT_HOME_LIVE_REFRESH_V1_FILE])&&
  clientHomePendingRefreshV2Approval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientHomePendingRefreshV2Approval?.requirements?.exact_blob_enforcement===true&&
  clientHomePendingRefreshV2Approval?.requirements?.visual_freeze_remains_enabled===true&&
  clientHomePendingRefreshV2Approval?.requirements?.wildcard_exception===false&&
  clientHomePendingRefreshV2Approval?.requirements?.real_chromium_race_test_required===true&&
  Boolean(clientHomePendingRefreshV2Approval?.exact_post_blobs?.[CLIENT_HOME_LIVE_REFRESH_V1_FILE]);

const CLIENT_CONTRACT_EVENT_DRIVEN_FILES=[
  'assets/portal-runtime/client-contract-download-v3.js'
];
const clientContractEventDrivenExceptionAuthorized=
  clientContractEventDrivenApproval?.approval==='OWNER_IN_CHAT'&&
  clientContractEventDrivenApproval?.authorized_at==='2026-09-21'&&
  clientContractEventDrivenApproval?.scope==='CLIENT_CONTRACT_EVENT_DRIVEN_REFRESH_V1'&&
  Array.isArray(clientContractEventDrivenApproval?.approved_protected_files)&&
  clientContractEventDrivenApproval.approved_protected_files.length===CLIENT_CONTRACT_EVENT_DRIVEN_FILES.length&&
  CLIENT_CONTRACT_EVENT_DRIVEN_FILES.every(path=>clientContractEventDrivenApproval.approved_protected_files.includes(path))&&
  clientContractEventDrivenApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientContractEventDrivenApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientContractEventDrivenApproval?.requirements?.wildcard_exception===false&&
  clientContractEventDrivenApproval?.requirements?.visual_change===false&&
  clientContractEventDrivenApproval?.requirements?.business_data_changed===false&&
  clientContractEventDrivenApproval?.requirements?.business_logic_changed===false&&
  clientContractEventDrivenApproval?.requirements?.auth_changed===false&&
  clientContractEventDrivenApproval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientContractEventDrivenApproval?.requirements?.periodic_refresh_removed===true&&
  clientContractEventDrivenApproval?.requirements?.generic_click_network_refresh_removed===true&&
  clientContractEventDrivenApproval?.requirements?.refresh_policy==='OPEN_CONTEXT_PROJECTION_PAGESHOW_INVALIDATION'&&
  clientContractEventDrivenApproval?.requirements?.no_background_polling_when_idle===true&&
  clientContractEventDrivenApproval?.requirements?.current_context_authority_preserved===true&&
  clientContractEventDrivenApproval?.requirements?.single_owner_projection_preserved===true&&
  clientContractEventDrivenApproval?.requirements?.supersedes_legacy_exact_visual_blob_only===true&&
  clientContractEventDrivenApproval?.requirements?.legacy_visual_semantics_preserved===true&&
  clientContractEventDrivenApproval?.requirements?.images_added===false&&
  clientContractEventDrivenApproval?.requirements?.unrelated_visual_changes===false;

const CLIENT_BACKGROUND_MANIFEST_EVENT_DRIVEN_FILES=[
  'assets/portal-runtime/client-background-section-preload-v1.js',
  'scripts/attach-client-background-section-preload-v1.mjs'
];
const clientBackgroundManifestEventDrivenExceptionAuthorized=
  clientBackgroundManifestEventDrivenApproval?.approval==='OWNER_IN_CHAT'&&
  clientBackgroundManifestEventDrivenApproval?.authorized_at==='2026-09-21'&&
  clientBackgroundManifestEventDrivenApproval?.scope==='CLIENT_BACKGROUND_MANIFEST_EVENT_DRIVEN_V1'&&
  Array.isArray(clientBackgroundManifestEventDrivenApproval?.approved_protected_files)&&
  clientBackgroundManifestEventDrivenApproval.approved_protected_files.length===CLIENT_BACKGROUND_MANIFEST_EVENT_DRIVEN_FILES.length&&
  CLIENT_BACKGROUND_MANIFEST_EVENT_DRIVEN_FILES.every(path=>clientBackgroundManifestEventDrivenApproval.approved_protected_files.includes(path))&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.visual_freeze_remains_enabled===true&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.wildcard_exception===false&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.visual_change===false&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.business_data_changed===false&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.business_logic_changed===false&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.auth_changed===false&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.supabase_schema_or_rls_changed===false&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.periodic_polling_absent===true&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.background_network_preload_absent===true&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.refresh_policy==='OPEN_CONTEXT_CHANGE_PAGESHOW_LAZY_MANIFEST'&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.current_context_authority_preserved===true&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.lazy_route_manifest_only===true&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.images_added===false&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.unrelated_visual_changes===false&&
  clientBackgroundManifestEventDrivenApproval?.requirements?.architect_pr_810_runtime_files_changed===false;

const CLIENT_RAIL_670_FILES=[
  'assets/portal-runtime/client-rail-canonical-hero-v1.js',
  'scripts/attach-client-rail-production-v1.mjs'
];
const clientRail670ExceptionAuthorized=
  clientRail670Approval?.approval==='OWNER_GITHUB_ISSUE'&&
  clientRail670Approval?.authorized_at==='2026-09-19'&&
  clientRail670Approval?.issue_number===670&&
  clientRail670Approval?.issue_url==='https://github.com/rokotove26-png/ronatrade.com/issues/670'&&
  clientRail670Approval?.owner_login==='rokotove26-png'&&
  clientRail670Approval?.scope==='CLIENT_ONLINE_RAIL_PRODUCTION_PARITY_WITH_ADMIN'&&
  Array.isArray(clientRail670Approval?.approved_protected_files)&&
  clientRail670Approval.approved_protected_files.length===CLIENT_RAIL_670_FILES.length&&
  CLIENT_RAIL_670_FILES.every(path=>clientRail670Approval.approved_protected_files.includes(path))&&
  clientRail670Approval?.requirements?.visual_freeze_remains_enabled===true&&
  clientRail670Approval?.requirements?.exact_file_enforcement_remains_active===true&&
  clientRail670Approval?.requirements?.wildcard_exception===false&&
  clientRail670Approval?.requirements?.scope_client_online_rail_only===true&&
  clientRail670Approval?.requirements?.mirror_admin_online_rail_visual_structure===true&&
  clientRail670Approval?.requirements?.preserve_authenticated_client_contract_authority===true&&
  clientRail670Approval?.requirements?.preserve_cross_client_fail_closed===true&&
  clientRail670Approval?.requirements?.preserve_admin_online_rail_business_logic===true&&
  clientRail670Approval?.requirements?.preserve_finance_payments_access_prices===true&&
  clientRail670Approval?.requirements?.business_data_changed===false&&
  clientRail670Approval?.requirements?.supabase_schema_changed===false&&
  clientRail670Approval?.requirements?.images_added===false&&
  clientRail670Approval?.requirements?.unrelated_visual_changes===false&&
  clientRail670Approval?.requirements?.system_admin_independent_qa_required===true&&
  clientRail670Approval?.requirements?.owner_visual_acceptance_required===true&&
  clientRail670Approval?.requirements?.merge==='HOLD'&&
  clientRail670Approval?.requirements?.deploy==='HOLD';
const clientRailAdminMirrorSupersededBy670=
  clientRail670ExceptionAuthorized&&
  clientRail670Approval.approved_protected_files.includes('assets/portal-runtime/client-rail-canonical-hero-v1.js');

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
if(applicationBusinessV2VisualExceptionAuthorized){
  const path='assets/portal-runtime/client-application-intent-v2.js';
  const body=await readFile(path);
  const actual=createHash('sha1').update(Buffer.from(`blob ${body.length}\0`)).update(body).digest('hex');
  const expected=applicationBusinessV2Scope?.candidate_exact_blobs?.[path];
  if(actual===expected&&body.toString('utf8').includes('RONA_APPLICATION_BUSINESS_V2')) approvedNewRuntime.add('client-application-intent-v2.js');
}

if(clientDealsCloseoutExceptionAuthorized){
  const path='assets/portal-runtime/client-closeout-documents-v1.js';
  const body=await readFile(path);
  const actual=createHash('sha1').update(Buffer.from(`blob ${body.length}\0`)).update(body).digest('hex');
  const entry=clientDealsCloseoutApproval?.exact_post_blobs?.[path];
  if(entry&&entry.authorized_post_blob_sha===actual&&body.toString('utf8').includes(entry.required_marker)){
    approvedNewRuntime.add('client-closeout-documents-v1.js');
  }
}

if(clientSidebarCommandNavExceptionAuthorized){
  const body=await readFile(CLIENT_SIDEBAR_COMMAND_NAV_RUNTIME);
  const actual=createHash('sha1').update(Buffer.from(`blob ${body.length}\0`)).update(body).digest('hex');
  if(actual===clientSidebarCommandNavApproval.exact_new_runtime_blob_sha&&body.toString('utf8').includes(clientSidebarCommandNavApproval.required_marker)){
    approvedNewRuntime.add('client-sidebar-command-nav-v1.js');
  }
}
let clientDealsStageTabsExact=false;
if(clientDealsStageTabsExceptionAuthorized){
  const exact=clientDealsStageTabsApproval.approved_exact_blobs||{};
  const closeoutExact=clientDealsCloseoutExceptionAuthorized?(clientDealsCloseoutApproval.exact_post_blobs||{}):{};
  const required=[
    'assets/portal-runtime/client-deals-authoritative-v1.js',
    'assets/portal-runtime/client-sidebar-command-nav-v1.js',
    'assets/portal-runtime/client-content-responsive-v1.css',
    'assets/portal-runtime/portal-canonical-button-hover-v1.js',
    'scripts/attach-client-deals-authoritative-v1.mjs',
    'scripts/attach-portal-canonical-button-hover-v1.mjs',
    'scripts/attach-client-content-responsive-v1.mjs'
  ];
  let matched=0;
  for(const path of required){
    const body=await readFile(path);
    const actual=createHash('sha1').update(Buffer.from(`blob ${body.length}\0`)).update(body).digest('hex');
    const legacyEntry=exact[path];
    const closeoutEntry=closeoutExact[path];
    const hierarchyEntry=clientDealsVisualHierarchyExceptionAuthorized?clientDealsVisualHierarchyApproval?.exact_post_blobs?.[path]:null;
    const legacyExact=Boolean(legacyEntry&&legacyEntry.sha===actual&&typeof legacyEntry.required_marker==='string'&&body.toString('utf8').includes(legacyEntry.required_marker));
    const closeoutExactMatch=Boolean(
      closeoutEntry&&
      legacyEntry&&
      closeoutEntry.baseline_blob_sha===legacyEntry.sha&&
      closeoutEntry.authorized_post_blob_sha===actual&&
      typeof closeoutEntry.required_marker==='string'&&
      closeoutEntry.required_marker.length>0&&
      body.toString('utf8').includes(closeoutEntry.required_marker)
    );
    const hierarchyExactMatch=Boolean(
      hierarchyEntry&&
      hierarchyEntry.authorized_post_blob_sha===actual&&
      typeof hierarchyEntry.required_marker==='string'&&
      hierarchyEntry.required_marker.length>0&&
      body.toString('utf8').includes(hierarchyEntry.required_marker)
    );
    if(legacyExact||closeoutExactMatch||hierarchyExactMatch)matched+=1;
  }
  clientDealsStageTabsExact=matched===required.length;
  if(clientDealsStageTabsExact){
    approvedNewRuntime.add('client-deals-authoritative-v1.js');
    approvedNewRuntime.add('client-sidebar-command-nav-v1.js');
    approvedNewAttach.add('attach-client-deals-authoritative-v1.mjs');
    approvedModifiedFiles.add('assets/portal-runtime/client-content-responsive-v1.css');
    approvedModifiedFiles.add('scripts/attach-client-content-responsive-v1.mjs');
  }
}

const protectedFiles=policy.protected_files||{};
const errors=[];
if(!clientSidebarCommandNavExceptionAuthorized)errors.push('CLIENT_SIDEBAR_COMMAND_NAV_GOVERNANCE_NOT_AUTHORIZED');
if(clientSidebarCommandNavExceptionAuthorized&&!approvedNewRuntime.has('client-sidebar-command-nav-v1.js'))errors.push('CLIENT_SIDEBAR_COMMAND_NAV_EXACT_RUNTIME_NOT_AUTHORIZED');
if(!clientDealsStageTabsExceptionAuthorized)errors.push('CLIENT_DEALS_STAGE_TABS_OWNER_APPROVAL_NOT_AUTHORIZED');
if(!clientDealsCloseoutExceptionAuthorized)errors.push('CLIENT_DEALS_CLOSEOUT_SCOPED_UNFREEZE_NOT_AUTHORIZED');
if(!clientDealsVisualHierarchyExceptionAuthorized)errors.push('CLIENT_DEALS_VISUAL_HIERARCHY_SCOPED_UNFREEZE_NOT_AUTHORIZED');
if(clientDealsStageTabsExceptionAuthorized&&!clientDealsStageTabsExact)errors.push('CLIENT_DEALS_STAGE_TABS_EXACT_BLOBS_NOT_AUTHORIZED');
let ownerVisualDeltaAppliedFiles=0;
let clientMultiContext430AppliedFiles=0;
let clientSectionTypography110AppliedFiles=0;
let clientPostreleaseIssue430AppliedFiles=0;
let pr431TwoBugScopedAppliedFiles=0;
let pr431DirectFixExactFiles=0;
let pr431TypographyQaWiringExactFiles=0;
let clientRailAdminMirrorAppliedFiles=0;
let clientRail670AppliedFiles=0;
let clientEventDrivenRefreshAppliedFiles=0;
let clientDealAttentionPaymentsExitAppliedFiles=0;
let clientMarketEventDrivenAppliedFiles=0;
let clientAnalyticsCurrentSourceAppliedFiles=0;
let clientAnalyticsReentryAppliedFiles=0;
let clientAnalyticsVisibilityAppliedFiles=0;
let clientAnalyticsActiveRouteRecoveryAppliedFiles=0;
let clientAnalyticsCanonicalRestoreAppliedFiles=0;
let clientAnalyticsAuthorizedPriceAppliedFiles=0;
let clientAnalyticsPublishedPriceAppliedFiles=0;
let clientAnalyticsAdminParityAppliedFiles=0;
let clientAnalyticsDtLpgV11AppliedFiles=0;
let analyticsDailyV12AppliedFiles=0;
let analyticsLpgV13AppliedFiles=0;
let clientAnalyticsNativeV17AppliedFiles=0;
let clientAnalyticsSingleOwnerV19AppliedFiles=0;
let clientAnalyticsBuyerV20AppliedFiles=0;
let clientHomeLiveRefreshV1AppliedFiles=0;
let clientHomePendingRefreshV2AppliedFiles=0;
let clientContractEventDrivenAppliedFiles=0;
let clientBackgroundManifestEventDrivenAppliedFiles=0;
let clientDealsVisualHierarchyAppliedFiles=0;

const functionalRuntimeVisualGuardPaths=['assets/portal-runtime/portal-client-company-directory-authority-v1.js'];
for(const path of functionalRuntimeVisualGuardPaths){
  try{
    const source=await readFile(path,'utf8');
    const forbidden=[
      ['GLOBAL_OWNER_TYPOGRAPHY_MARKER',/RONA_CLIENT_OWNER_TYPOGRAPHY/u],
      ['GLOBAL_FONT_SIZE_STYLE_WRITE',/style\.setProperty\(\s*['"]font-size['"]/u],
      ['DIRECT_FONT_SIZE_WRITE',/\.style\.fontSize\s*=/u],
      ['RUNTIME_STYLE_ELEMENT_INJECTION',/createElement\(\s*['"]style['"]\s*\)/u],
      ['RUNTIME_FONT_SIZE_RULE',/font-size\s*:/iu]
    ];
    for(const [label,re] of forbidden)if(re.test(source))errors.push(`FUNCTIONAL_RUNTIME_VISUAL_OWNER ${path} ${label}`);
  }catch(error){errors.push(`FUNCTIONAL_RUNTIME_VISUAL_GUARD_MISSING ${path} ${error?.code||error?.message||'READ_ERROR'}`)}
}

function gitBlobSha(buffer){
  return createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest('hex');
}

if(!pr431DirectFixGovernanceAuthorized){
  errors.push('PR431_DIRECT_FIX_GOVERNANCE_NOT_AUTHORIZED');
}else{
  const exact=clientMultiContext430Approval.pr431_direct_fix.exact_post_blobs||{};
  for(const path of PR431_DIRECT_FIX_FILES){
    try{
      const body=await readFile(path),actual=gitBlobSha(body),entry=exact[path],source=body.toString('utf8');
      const directFixExact=Boolean(entry&&entry.authorized_post_blob_sha===actual&&typeof entry.required_marker==='string'&&entry.required_marker&&source.includes(entry.required_marker));
      const qaWiring=clientSectionTypography110ExceptionAuthorized&&path===clientSectionTypography110Approval?.approved_qa_workflow_wiring?.path?clientSectionTypography110Approval.approved_qa_workflow_wiring:null;
      const typographyQaWiringExact=Boolean(
        qaWiring&&
        qaWiring.system_admin_comment_id===5602689478&&
        qaWiring.authorized_blob_sha==='ae36d39a9081cf0da929c2340312d3098726be35'&&
        qaWiring.authorized_blob_sha===actual&&
        qaWiring.historical_pr431_direct_fix_blob_sha===entry?.authorized_post_blob_sha&&
        qaWiring.scope==='TYPOGRAPHY_FINALIZATION_QA_WIRING_EXACT_ONLY'&&
        qaWiring.wildcard_exception===false&&
        typeof qaWiring.required_marker==='string'&&
        qaWiring.required_marker.length>0&&
        source.includes(qaWiring.required_marker)
      );
      const companyDirectoryEventDrivenEntry=clientCompanyDirectoryEventDrivenExceptionAuthorized?clientCompanyDirectoryEventDrivenApproval?.exact_post_blobs?.[path]:null;
      const companyDirectoryEventDrivenExact=Boolean(
        path==='assets/portal-runtime/portal-client-company-directory-authority-v1.js'&&
        companyDirectoryEventDrivenEntry&&
        companyDirectoryEventDrivenEntry.visual_freeze_baseline_blob_sha===entry?.authorized_post_blob_sha&&
        companyDirectoryEventDrivenEntry.authorized_post_blob_sha===actual&&
        typeof companyDirectoryEventDrivenEntry.required_marker==='string'&&
        companyDirectoryEventDrivenEntry.required_marker.length>0&&
        source.includes(companyDirectoryEventDrivenEntry.required_marker)
      );
      const postreleaseQaEntry=clientPostreleaseIssue430ExceptionAuthorized?clientPostreleaseIssue430Approval?.exact_post_remediation_blobs?.[path]:null;
      const postreleaseQaWiringExact=Boolean(
        CLIENT_POSTRELEASE_ISSUE430_QA_WIRING_FILES.includes(path)&&
        postreleaseQaEntry&&
        postreleaseQaEntry.visual_freeze_baseline_blob_sha===entry?.authorized_post_blob_sha&&
        postreleaseQaEntry.authorized_post_blob_sha===actual&&
        typeof postreleaseQaEntry.required_marker==='string'&&
        postreleaseQaEntry.required_marker.length>0&&
        source.includes(postreleaseQaEntry.required_marker)
      );
      if(!directFixExact&&!typographyQaWiringExact&&!postreleaseQaWiringExact&&!companyDirectoryEventDrivenExact){
        errors.push(`PR431_DIRECT_FIX_EXACT_BLOB ${path} expected=${entry?.authorized_post_blob_sha||'missing'} actual=${actual}`);
      }else{
        pr431DirectFixExactFiles+=1;
        if(typographyQaWiringExact||postreleaseQaWiringExact)pr431TypographyQaWiringExactFiles+=1;
      }
    }catch(error){errors.push(`PR431_DIRECT_FIX_EXACT_BLOB_MISSING ${path} ${error?.code||error?.message||'READ_ERROR'}`)}
  }
}

if(!clientCompanyDirectoryEventDrivenExceptionAuthorized)errors.push('CLIENT_COMPANY_DIRECTORY_EVENT_DRIVEN_GOVERNANCE_NOT_AUTHORIZED');
if(!clientSectionTypography110ExceptionAuthorized)errors.push('CLIENT_SECTION_TYPOGRAPHY_110_GOVERNANCE_NOT_AUTHORIZED');
if(clientSectionTypography110ExceptionAuthorized&&pr431TypographyQaWiringExactFiles!==1)errors.push(`CLIENT_SECTION_TYPOGRAPHY_QA_WIRING_EXACT_BLOB_COUNT expected=1 actual=${pr431TypographyQaWiringExactFiles}`);

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
    const typographyEntry=clientSectionTypography110ExceptionAuthorized?clientSectionTypography110Approval?.exact_post_remediation_blobs?.[path]:null;
    const exactTypographyPost=Boolean(
      typographyEntry&&
      typographyEntry.visual_freeze_baseline_blob_sha===expected&&
      typographyEntry.authorized_parent_blob_sha==='2054fb7f54d4727ba5dd0bac2f688c3a90c66e65'&&
      typographyEntry.authorized_post_blob_sha===actual&&
      typeof typographyEntry.required_marker==='string'&&
      typographyEntry.required_marker.length>0&&
      body.toString('utf8').includes(typographyEntry.required_marker)
    );
    const pr431Entry=pr431TwoBugScopedFreezeExceptionAuthorized?PR431_TWO_BUG_SCOPED_FREEZE_EXCEPTION.exact_post_remediation_blobs?.[path]:null;
    const exactPr431TwoBugScopedPost=Boolean(
      pr431Entry&&
      pr431Entry.visual_freeze_baseline_blob_sha===expected&&
      pr431Entry.authorized_post_blob_sha===actual&&
      typeof pr431Entry.required_marker==='string'&&
      pr431Entry.required_marker.length>0&&
      body.toString('utf8').includes(pr431Entry.required_marker)
    );
    const postreleaseEntry=clientPostreleaseIssue430ExceptionAuthorized?clientPostreleaseIssue430Approval?.exact_post_remediation_blobs?.[path]:null;
    const exactClientPostreleaseIssue430=Boolean(
      postreleaseEntry&&
      postreleaseEntry.visual_freeze_baseline_blob_sha===expected&&
      postreleaseEntry.authorized_post_blob_sha===actual&&
      typeof postreleaseEntry.required_marker==='string'&&
      postreleaseEntry.required_marker.length>0&&
      body.toString('utf8').includes(postreleaseEntry.required_marker)
    );
    const clientRailMirrorEntry=clientRailAdminMirrorExceptionAuthorized?clientRailAdminMirrorApproval?.exact_post_blobs?.[path]:null;
    const exactClientRailAdminMirror=Boolean(
      clientRailMirrorEntry&&
      clientRailMirrorEntry.visual_freeze_baseline_blob_sha===expected&&
      clientRailMirrorEntry.authorized_post_blob_sha===actual&&
      typeof clientRailMirrorEntry.required_marker==='string'&&
      clientRailMirrorEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientRailMirrorEntry.required_marker)
    );
    const clientRail670Entry=clientRail670ExceptionAuthorized?clientRail670Approval?.exact_post_blobs?.[path]:null;
    const exactClientRail670=Boolean(
      clientRail670Entry&&
      clientRail670Entry.visual_freeze_baseline_blob_sha===expected&&
      clientRail670Entry.authorized_post_blob_sha===actual&&
      typeof clientRail670Entry.required_marker==='string'&&
      clientRail670Entry.required_marker.length>0&&
      body.toString('utf8').includes(clientRail670Entry.required_marker)
    );
    const clientEventDrivenRefreshEntry=clientEventDrivenRefreshExceptionAuthorized?clientEventDrivenRefreshApproval?.exact_post_blobs?.[path]:null;
    const exactClientEventDrivenRefresh=Boolean(
      clientEventDrivenRefreshEntry&&
      clientEventDrivenRefreshEntry.visual_freeze_baseline_blob_sha===expected&&
      clientEventDrivenRefreshEntry.authorized_post_blob_sha===actual&&
      typeof clientEventDrivenRefreshEntry.required_marker==='string'&&
      clientEventDrivenRefreshEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientEventDrivenRefreshEntry.required_marker)
    );
    const clientDealAttentionPaymentsExitEntry=clientDealAttentionPaymentsExitExceptionAuthorized?clientDealAttentionPaymentsExitApproval?.exact_post_blobs?.[path]:null;
    const exactClientDealAttentionPaymentsExit=Boolean(
      path===CLIENT_DEAL_ATTENTION_PAYMENTS_EXIT_FILE&&
      clientDealAttentionPaymentsExitEntry&&
      clientDealAttentionPaymentsExitEntry.visual_freeze_baseline_blob_sha===expected&&
      clientDealAttentionPaymentsExitEntry.authorized_parent_blob_sha===clientEventDrivenRefreshEntry?.authorized_post_blob_sha&&
      clientDealAttentionPaymentsExitEntry.authorized_post_blob_sha===actual&&
      typeof clientDealAttentionPaymentsExitEntry.required_marker==='string'&&
      clientDealAttentionPaymentsExitEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientDealAttentionPaymentsExitEntry.required_marker)
    );
    const clientMarketEventDrivenEntry=clientMarketEventDrivenExceptionAuthorized?clientMarketEventDrivenApproval?.exact_post_blobs?.[path]:null;
    const exactClientMarketEventDriven=Boolean(
      clientMarketEventDrivenEntry&&
      clientMarketEventDrivenEntry.visual_freeze_baseline_blob_sha===expected&&
      clientMarketEventDrivenEntry.authorized_post_blob_sha===actual&&
      typeof clientMarketEventDrivenEntry.required_marker==='string'&&
      clientMarketEventDrivenEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientMarketEventDrivenEntry.required_marker)
    );
    const clientAnalyticsCurrentSourceEntry=clientAnalyticsCurrentSourceExceptionAuthorized?clientAnalyticsCurrentSourceApproval.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsCurrentSource=Boolean(
      CLIENT_ANALYTICS_CURRENT_SOURCE_FILES.includes(path)&&
      clientAnalyticsCurrentSourceEntry&&
      clientAnalyticsCurrentSourceEntry.visual_freeze_baseline_blob_sha===expected&&
      clientAnalyticsCurrentSourceEntry.authorized_post_blob_sha===actual&&
      typeof clientAnalyticsCurrentSourceEntry.required_marker==='string'&&
      clientAnalyticsCurrentSourceEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientAnalyticsCurrentSourceEntry.required_marker)
    );
    const clientAnalyticsReentryEntry=clientAnalyticsReentryExceptionAuthorized?clientAnalyticsReentryApproval.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsReentry=Boolean(
      CLIENT_ANALYTICS_REENTRY_FILES.includes(path)&&
      clientAnalyticsReentryEntry&&
      clientAnalyticsReentryEntry.visual_freeze_baseline_blob_sha===expected&&
      clientAnalyticsReentryEntry.supersedes_authorized_post_blob_sha===clientAnalyticsCurrentSourceApproval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      clientAnalyticsReentryEntry.authorized_post_blob_sha===actual&&
      typeof clientAnalyticsReentryEntry.required_marker==='string'&&
      clientAnalyticsReentryEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientAnalyticsReentryEntry.required_marker)
    );
    const clientAnalyticsVisibilityEntry=clientAnalyticsVisibilityExceptionAuthorized?clientAnalyticsVisibilityApproval.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsVisibility=Boolean(
      CLIENT_ANALYTICS_VISIBILITY_FILES.includes(path)&&
      clientAnalyticsVisibilityEntry&&
      clientAnalyticsVisibilityEntry.visual_freeze_baseline_blob_sha===expected&&
      clientAnalyticsVisibilityEntry.supersedes_authorized_post_blob_sha===clientAnalyticsReentryApproval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      clientAnalyticsVisibilityEntry.authorized_post_blob_sha===actual&&
      typeof clientAnalyticsVisibilityEntry.required_marker==='string'&&
      clientAnalyticsVisibilityEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientAnalyticsVisibilityEntry.required_marker)
    );
    const clientAnalyticsActiveRouteRecoveryEntry=clientAnalyticsActiveRouteRecoveryExceptionAuthorized?clientAnalyticsActiveRouteRecoveryApproval.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsActiveRouteRecovery=Boolean(
      CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_FILES.includes(path)&&
      clientAnalyticsActiveRouteRecoveryEntry&&
      clientAnalyticsActiveRouteRecoveryEntry.visual_freeze_baseline_blob_sha===expected&&
      clientAnalyticsActiveRouteRecoveryEntry.supersedes_authorized_post_blob_sha===clientAnalyticsVisibilityApproval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      clientAnalyticsActiveRouteRecoveryEntry.authorized_post_blob_sha===actual&&
      typeof clientAnalyticsActiveRouteRecoveryEntry.required_marker==='string'&&
      clientAnalyticsActiveRouteRecoveryEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientAnalyticsActiveRouteRecoveryEntry.required_marker)
    );
    const clientAnalyticsCanonicalRestoreEntry=clientAnalyticsCanonicalRestoreExceptionAuthorized?clientAnalyticsCanonicalRestoreApproval.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsCanonicalRestore=Boolean(
      CLIENT_ANALYTICS_CANONICAL_RESTORE_FILES.includes(path)&&
      clientAnalyticsCanonicalRestoreEntry&&
      clientAnalyticsCanonicalRestoreEntry.visual_freeze_baseline_blob_sha===expected&&
      clientAnalyticsCanonicalRestoreEntry.supersedes_authorized_post_blob_sha===clientAnalyticsActiveRouteRecoveryApproval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      clientAnalyticsCanonicalRestoreEntry.authorized_post_blob_sha===actual&&
      typeof clientAnalyticsCanonicalRestoreEntry.required_marker==='string'&&
      clientAnalyticsCanonicalRestoreEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientAnalyticsCanonicalRestoreEntry.required_marker)
    );
    const clientAnalyticsAuthorizedPriceEntry=clientAnalyticsAuthorizedPriceException?clientAnalyticsAuthorizedPriceApproval.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsAuthorizedPrice=Boolean(
      CLIENT_ANALYTICS_AUTHORIZED_PRICE_FILES.includes(path)&&
      clientAnalyticsAuthorizedPriceEntry&&
      clientAnalyticsAuthorizedPriceEntry.visual_freeze_baseline_blob_sha===expected&&
      clientAnalyticsAuthorizedPriceEntry.supersedes_authorized_post_blob_sha===clientAnalyticsCanonicalRestoreApproval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      clientAnalyticsAuthorizedPriceEntry.authorized_post_blob_sha===actual&&
      typeof clientAnalyticsAuthorizedPriceEntry.required_marker==='string'&&
      clientAnalyticsAuthorizedPriceEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientAnalyticsAuthorizedPriceEntry.required_marker)
    );
    const clientAnalyticsPublishedPriceEntry=clientAnalyticsPublishedPriceException?clientAnalyticsPublishedPriceApproval.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsPublishedPrice=Boolean(
      CLIENT_ANALYTICS_PUBLISHED_PRICE_FILES.includes(path)&&
      clientAnalyticsPublishedPriceEntry&&
      clientAnalyticsPublishedPriceEntry.visual_freeze_baseline_blob_sha===expected&&
      clientAnalyticsPublishedPriceEntry.supersedes_authorized_post_blob_sha===clientAnalyticsAuthorizedPriceApproval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      clientAnalyticsPublishedPriceEntry.authorized_post_blob_sha===actual&&
      typeof clientAnalyticsPublishedPriceEntry.required_marker==='string'&&
      clientAnalyticsPublishedPriceEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientAnalyticsPublishedPriceEntry.required_marker)
    );

    const clientAnalyticsAdminParityEntry=clientAnalyticsAdminParityException?clientAnalyticsAdminParityApproval.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsAdminParity=Boolean(
      CLIENT_ANALYTICS_ADMIN_PARITY_FILES.includes(path)&&
      clientAnalyticsAdminParityEntry&&
      clientAnalyticsAdminParityEntry.visual_freeze_baseline_blob_sha===expected&&
      clientAnalyticsAdminParityEntry.supersedes_authorized_post_blob_sha===clientAnalyticsPublishedPriceApproval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      clientAnalyticsAdminParityEntry.authorized_post_blob_sha===actual&&
      clientAnalyticsAdminParityEntry.required_marker==='20261009-client-analytics-admin-canonical-parity-v10'&&
      body.toString('utf8').includes(clientAnalyticsAdminParityEntry.required_marker)
    );

    const clientAnalyticsDtLpgV11Entry=clientAnalyticsDtLpgV11Exception?clientAnalyticsDtLpgV11Approval.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsDtLpgV11=Boolean(
      CLIENT_ANALYTICS_DT_LPG_V11_FILES.includes(path)&&
      clientAnalyticsDtLpgV11Entry&&
      clientAnalyticsDtLpgV11Entry.visual_freeze_baseline_blob_sha===expected&&
      clientAnalyticsDtLpgV11Entry.supersedes_authorized_post_blob_sha===clientAnalyticsAdminParityApproval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      clientAnalyticsDtLpgV11Entry.authorized_post_blob_sha===actual&&
      clientAnalyticsDtLpgV11Entry.required_marker==='20261009-client-analytics-dt-lpg-forecast-parity-v11'&&
      body.toString('utf8').includes(clientAnalyticsDtLpgV11Entry.required_marker)
    );
    const analyticsDailyV12Entry=analyticsDailyV12Exception?analyticsDailyV12Approval.exact_post_blobs?.[path]:null;
    const exactAnalyticsDailyV12=Boolean(
      ANALYTICS_DAILY_V12_FILES.includes(path)&&
      analyticsDailyV12Entry&&
      analyticsDailyV12Entry.visual_freeze_baseline_blob_sha===expected&&
      analyticsDailyV12Entry.supersedes_authorized_post_blob_sha===clientAnalyticsDtLpgV11Approval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      analyticsDailyV12Entry.authorized_post_blob_sha===actual&&
      analyticsDailyV12Entry.required_marker==='20261009-client-analytics-observed-daily-v12'&&
      body.toString('utf8').includes(analyticsDailyV12Entry.required_marker)
    );


    const analyticsLpgV13Entry=analyticsLpgV13Exception?analyticsLpgV13Approval.exact_post_blobs?.[path]:null;
    const exactAnalyticsLpgV13=Boolean(
      ANALYTICS_LPG_V13_FILES.includes(path)&&
      analyticsLpgV13Entry&&
      analyticsLpgV13Entry.visual_freeze_baseline_blob_sha===expected&&
      analyticsLpgV13Entry.supersedes_authorized_post_blob_sha===analyticsDailyV12Approval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      analyticsLpgV13Entry.authorized_post_blob_sha===actual&&
      analyticsLpgV13Entry.required_marker==='20261009-lpg-source-gap-history-v13'&&
      body.toString('utf8').includes(analyticsLpgV13Entry.required_marker)
    );
    const exactClientAnalyticsNativeV17=Boolean(
      clientAnalyticsNativeV17ExceptionAuthorized&&
      path===CLIENT_ANALYTICS_NATIVE_V17_RUNTIME&&
      analyticsLpgV13Entry?.visual_freeze_baseline_blob_sha===expected&&
      analyticsLpgV13Entry?.authorized_post_blob_sha===clientAnalyticsNativeV17Approval.source_lock.previous_client_runtime_blob&&
      actual===clientAnalyticsNativeV17Approval.source_lock.new_client_runtime_blob&&
      body.toString('utf8').includes("owner.querySelectorAll('.rona-market-chart-metric [data-chart-metric]')")&&
      body.toString('utf8').includes("textIfDifferent(headline,'Возможные цены RONA Trade')")
    );
    const singleOwnerV19Entry=clientAnalyticsSingleOwnerV19ExceptionAuthorized?clientAnalyticsSingleOwnerV19Approval?.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsSingleOwnerV19=Boolean(
      CLIENT_ANALYTICS_SINGLE_OWNER_V19_FILES.includes(path)&&
      singleOwnerV19Entry&&
      singleOwnerV19Entry.visual_freeze_baseline_blob_sha===expected&&
      singleOwnerV19Entry.supersedes_authorized_post_blob_sha===
        (path===CLIENT_ANALYTICS_NATIVE_V17_RUNTIME
          ? clientAnalyticsNativeV17Approval.source_lock.new_client_runtime_blob
          : analyticsLpgV13Approval.exact_post_blobs?.[path]?.authorized_post_blob_sha)&&
      singleOwnerV19Entry.authorized_post_blob_sha===actual&&
      singleOwnerV19Entry.required_marker==='20261010-client-analytics-clean-conclusion-single-owner-v19'&&
      body.toString('utf8').includes(singleOwnerV19Entry.required_marker)
    );
    const buyerV20Entry=clientAnalyticsBuyerV20ExceptionAuthorized?clientAnalyticsBuyerV20Approval?.exact_post_blobs?.[path]:null;
    const exactClientAnalyticsBuyerV20=Boolean(
      CLIENT_ANALYTICS_BUYER_V20_FILES.includes(path)&&
      buyerV20Entry&&
      buyerV20Entry.visual_freeze_baseline_blob_sha===expected&&
      buyerV20Entry.supersedes_authorized_post_blob_sha===
        clientAnalyticsSingleOwnerV19Approval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      buyerV20Entry.authorized_post_blob_sha===actual&&
      buyerV20Entry.required_marker==='20261010-client-analytics-buyer-facing-insight-v20'&&
      body.toString('utf8').includes(buyerV20Entry.required_marker)&&
      (path!==CLIENT_ANALYTICS_NATIVE_V17_RUNTIME||
       body.toString('utf8').includes('.an2-comment + .rona-owner-muted{display:none!important}'))
    );
    const homeRefreshV1Entry=clientHomeLiveRefreshV1Authorized?clientHomeLiveRefreshV1Approval?.exact_post_blobs?.[path]:null;
    const exactClientHomeLiveRefreshV1=Boolean(
      path===CLIENT_HOME_LIVE_REFRESH_V1_FILE&&
      homeRefreshV1Entry&&
      homeRefreshV1Entry.visual_freeze_baseline_blob_sha===expected&&
      homeRefreshV1Entry.supersedes_authorized_post_blob_sha==='14c3a251ba7015e7d46e2cf48d14f7c07e049ed6'&&
      homeRefreshV1Entry.authorized_post_blob_sha===actual&&
      homeRefreshV1Entry.required_marker==='20261010-client-home-live-freshness-v1'&&
      body.toString('utf8').includes(homeRefreshV1Entry.required_marker)&&
      body.toString('utf8').includes("authority.invalidateCurrentProjection()")&&
      body.toString('utf8').includes('SOURCE_REFRESH_MS=30000')
    );
    const homePendingV2Entry=clientHomePendingRefreshV2Authorized?clientHomePendingRefreshV2Approval?.exact_post_blobs?.[path]:null;
    const exactClientHomePendingRefreshV2=Boolean(
      path===CLIENT_HOME_LIVE_REFRESH_V1_FILE&&homePendingV2Entry&&
      homePendingV2Entry.visual_freeze_baseline_blob_sha===expected&&
      homePendingV2Entry.supersedes_authorized_post_blob_sha===clientHomeLiveRefreshV1Approval.exact_post_blobs?.[path]?.authorized_post_blob_sha&&
      homePendingV2Entry.authorized_post_blob_sha===actual&&
      homePendingV2Entry.required_marker==='20261010-client-home-pending-refresh-v2'&&
      body.toString('utf8').includes(homePendingV2Entry.required_marker)&&
      body.toString('utf8').includes('state.refreshPending=true')&&
      body.toString('utf8').includes("refreshVisible('pending')")
    );
    const clientContractEventDrivenEntry=clientContractEventDrivenExceptionAuthorized?clientContractEventDrivenApproval?.exact_post_blobs?.[path]:null;
    const exactClientContractEventDriven=Boolean(
      clientContractEventDrivenEntry&&
      clientContractEventDrivenEntry.visual_freeze_baseline_blob_sha===expected&&
      clientContractEventDrivenEntry.authorized_post_blob_sha===actual&&
      typeof clientContractEventDrivenEntry.required_marker==='string'&&
      clientContractEventDrivenEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientContractEventDrivenEntry.required_marker)
    );
    const clientDealsVisualHierarchyEntry=clientDealsVisualHierarchyExceptionAuthorized?clientDealsVisualHierarchyApproval?.exact_post_blobs?.[path]:null;
    const exactClientDealsVisualHierarchy=Boolean(
      clientDealsVisualHierarchyEntry&&
      clientDealsVisualHierarchyEntry.authorized_post_blob_sha===actual&&
      typeof clientDealsVisualHierarchyEntry.required_marker==='string'&&
      clientDealsVisualHierarchyEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientDealsVisualHierarchyEntry.required_marker)
    );
    const clientBackgroundManifestEventDrivenEntry=clientBackgroundManifestEventDrivenExceptionAuthorized?clientBackgroundManifestEventDrivenApproval?.exact_post_blobs?.[path]:null;
    const exactClientBackgroundManifestEventDriven=Boolean(
      clientBackgroundManifestEventDrivenEntry&&
      clientBackgroundManifestEventDrivenEntry.visual_freeze_baseline_blob_sha===expected&&
      clientBackgroundManifestEventDrivenEntry.authorized_post_blob_sha===actual&&
      typeof clientBackgroundManifestEventDrivenEntry.required_marker==='string'&&
      clientBackgroundManifestEventDrivenEntry.required_marker.length>0&&
      body.toString('utf8').includes(clientBackgroundManifestEventDrivenEntry.required_marker)
    );
    if(exactOwnerVisualPost)ownerVisualDeltaAppliedFiles+=1;
    if(exactIssue430Post)clientMultiContext430AppliedFiles+=1;
    if(exactTypographyPost)clientSectionTypography110AppliedFiles+=1;
    if(exactPr431TwoBugScopedPost)pr431TwoBugScopedAppliedFiles+=1;
    if(exactClientPostreleaseIssue430&&CLIENT_POSTRELEASE_ISSUE430_FILES.includes(path))clientPostreleaseIssue430AppliedFiles+=1;
    if(exactClientRailAdminMirror)clientRailAdminMirrorAppliedFiles+=1;
    if(exactClientRail670)clientRail670AppliedFiles+=1;
    if(exactClientEventDrivenRefresh)clientEventDrivenRefreshAppliedFiles+=1;
    if(exactClientDealAttentionPaymentsExit)clientDealAttentionPaymentsExitAppliedFiles+=1;
    if(exactClientMarketEventDriven)clientMarketEventDrivenAppliedFiles+=1;
    if(exactClientAnalyticsCurrentSource)clientAnalyticsCurrentSourceAppliedFiles+=1;
    if(exactClientAnalyticsReentry)clientAnalyticsReentryAppliedFiles+=1;
    if(exactClientAnalyticsVisibility)clientAnalyticsVisibilityAppliedFiles+=1;
    if(exactClientAnalyticsActiveRouteRecovery)clientAnalyticsActiveRouteRecoveryAppliedFiles+=1;
    if(exactClientAnalyticsCanonicalRestore)clientAnalyticsCanonicalRestoreAppliedFiles+=1;
    if(exactClientAnalyticsAuthorizedPrice)clientAnalyticsAuthorizedPriceAppliedFiles+=1;
    if(exactClientAnalyticsPublishedPrice)clientAnalyticsPublishedPriceAppliedFiles+=1;
    if(exactClientAnalyticsAdminParity)clientAnalyticsAdminParityAppliedFiles+=1;
    if(exactClientAnalyticsDtLpgV11)clientAnalyticsDtLpgV11AppliedFiles+=1;
    if(exactAnalyticsDailyV12)analyticsDailyV12AppliedFiles+=1;
    if(exactAnalyticsLpgV13||exactClientAnalyticsNativeV17||exactClientAnalyticsSingleOwnerV19||exactClientAnalyticsBuyerV20)analyticsLpgV13AppliedFiles+=1;
    if(exactClientAnalyticsNativeV17||((exactClientAnalyticsSingleOwnerV19||exactClientAnalyticsBuyerV20)&&path===CLIENT_ANALYTICS_NATIVE_V17_RUNTIME))clientAnalyticsNativeV17AppliedFiles+=1;
    if(exactClientAnalyticsSingleOwnerV19||exactClientAnalyticsBuyerV20)clientAnalyticsSingleOwnerV19AppliedFiles+=1;
    if(exactClientAnalyticsBuyerV20)clientAnalyticsBuyerV20AppliedFiles+=1;
    if(exactClientHomeLiveRefreshV1||exactClientHomePendingRefreshV2)clientHomeLiveRefreshV1AppliedFiles+=1;
    if(exactClientHomePendingRefreshV2)clientHomePendingRefreshV2AppliedFiles+=1;
    if(exactClientContractEventDriven)clientContractEventDrivenAppliedFiles+=1;
    if(exactClientDealsVisualHierarchy)clientDealsVisualHierarchyAppliedFiles+=1;
    if(exactClientBackgroundManifestEventDriven)clientBackgroundManifestEventDrivenAppliedFiles+=1;
    if(actual!==expected&&!approvedModifiedFiles.has(path)&&!exactOwnerVisualPost&&!exactIssue430Post&&!exactTypographyPost&&!exactPr431TwoBugScopedPost&&!exactClientPostreleaseIssue430&&!exactClientRailAdminMirror&&!exactClientRail670&&!exactClientEventDrivenRefresh&&!exactClientDealAttentionPaymentsExit&&!exactClientMarketEventDriven&&!exactClientAnalyticsCurrentSource&&!exactClientAnalyticsReentry&&!exactClientAnalyticsVisibility&&!exactClientAnalyticsActiveRouteRecovery&&!exactClientAnalyticsCanonicalRestore&&!exactClientAnalyticsAuthorizedPrice&&!exactClientAnalyticsPublishedPrice&&!exactClientAnalyticsAdminParity&&!exactClientAnalyticsDtLpgV11&&!exactAnalyticsDailyV12&&!exactAnalyticsLpgV13&&!exactClientAnalyticsNativeV17&&!exactClientAnalyticsSingleOwnerV19&&!exactClientAnalyticsBuyerV20&&!exactClientHomeLiveRefreshV1&&!exactClientHomePendingRefreshV2&&!exactClientContractEventDriven&&!exactClientDealsVisualHierarchy&&!exactClientBackgroundManifestEventDriven)errors.push(`MODIFIED ${path} expected=${expected} actual=${actual}`);
  }catch(error){
    errors.push(`MISSING ${path} ${error?.code||error?.message||'READ_ERROR'}`);
  }
}

if(clientDealsVisualHierarchyExceptionAuthorized&&clientDealsVisualHierarchyAppliedFiles!==CLIENT_DEALS_VISUAL_HIERARCHY_FILES.length)errors.push(`CLIENT_DEALS_VISUAL_HIERARCHY_PROTECTED_BLOB_COUNT expected=${CLIENT_DEALS_VISUAL_HIERARCHY_FILES.length} actual=${clientDealsVisualHierarchyAppliedFiles}`);
if(!clientRailAdminMirrorExceptionAuthorized)errors.push('CLIENT_RAIL_ADMIN_MIRROR_GOVERNANCE_NOT_AUTHORIZED');
if(clientRailAdminMirrorExceptionAuthorized&&clientRailAdminMirrorAppliedFiles!==1&&!clientRailAdminMirrorSupersededBy670)errors.push(`CLIENT_RAIL_ADMIN_MIRROR_EXACT_BLOB_COUNT expected=1 actual=${clientRailAdminMirrorAppliedFiles}`);
if(!clientRail670ExceptionAuthorized)errors.push('CLIENT_RAIL_670_GOVERNANCE_NOT_AUTHORIZED');
if(clientRail670ExceptionAuthorized&&clientRail670AppliedFiles!==CLIENT_RAIL_670_FILES.length)errors.push(`CLIENT_RAIL_670_EXACT_BLOB_COUNT expected=${CLIENT_RAIL_670_FILES.length} actual=${clientRail670AppliedFiles}`);
if(!clientEventDrivenRefreshExceptionAuthorized)errors.push('CLIENT_EVENT_DRIVEN_REFRESH_GOVERNANCE_NOT_AUTHORIZED');
if(!clientDealAttentionPaymentsExitExceptionAuthorized)errors.push('CLIENT_DEAL_ATTENTION_PAYMENTS_EXIT_GOVERNANCE_NOT_AUTHORIZED');
if(clientDealAttentionPaymentsExitExceptionAuthorized&&clientDealAttentionPaymentsExitAppliedFiles!==1)errors.push(`CLIENT_DEAL_ATTENTION_PAYMENTS_EXIT_EXACT_BLOB_COUNT expected=1 actual=${clientDealAttentionPaymentsExitAppliedFiles}`);
const clientEventDrivenRefreshEffectiveFiles=clientEventDrivenRefreshAppliedFiles+(clientDealAttentionPaymentsExitAppliedFiles===1?1:0);
if(clientEventDrivenRefreshExceptionAuthorized&&clientEventDrivenRefreshEffectiveFiles!==CLIENT_EVENT_DRIVEN_REFRESH_FILES.length)errors.push(`CLIENT_EVENT_DRIVEN_REFRESH_EXACT_BLOB_COUNT expected=${CLIENT_EVENT_DRIVEN_REFRESH_FILES.length} actual=${clientEventDrivenRefreshEffectiveFiles}`);
if(!clientMarketEventDrivenExceptionAuthorized)errors.push('CLIENT_MARKET_EVENT_DRIVEN_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsCurrentSourceExceptionAuthorized)errors.push('CLIENT_ANALYTICS_CURRENT_SOURCE_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsReentryExceptionAuthorized)errors.push('CLIENT_ANALYTICS_REENTRY_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsVisibilityExceptionAuthorized)errors.push('CLIENT_ANALYTICS_VISIBLE_OWNER_V5_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsActiveRouteRecoveryExceptionAuthorized)errors.push('CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_V6_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsCanonicalRestoreExceptionAuthorized)errors.push('CLIENT_ANALYTICS_CANONICAL_RESTORE_V7_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsAuthorizedPriceException)errors.push('CLIENT_ANALYTICS_AUTHORIZED_PRICE_V8_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsPublishedPriceException)errors.push('CLIENT_ANALYTICS_PUBLISHED_PRICE_V9_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsAdminParityException)errors.push('CLIENT_ANALYTICS_ADMIN_PARITY_V10_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsDtLpgV11Exception)errors.push('CLIENT_ANALYTICS_DT_LPG_V11_GOVERNANCE_NOT_AUTHORIZED');
if(!analyticsDailyV12Exception)errors.push('ANALYTICS_DAILY_V12_GOVERNANCE_NOT_AUTHORIZED');
if(!analyticsLpgV13Exception)errors.push('ANALYTICS_LPG_V13_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsNativeV17ExceptionAuthorized)errors.push('CLIENT_ANALYTICS_NATIVE_V17_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsSingleOwnerV19ExceptionAuthorized)errors.push('CLIENT_ANALYTICS_SINGLE_OWNER_V19_GOVERNANCE_NOT_AUTHORIZED');
if(!clientAnalyticsBuyerV20ExceptionAuthorized)errors.push('CLIENT_ANALYTICS_BUYER_V20_GOVERNANCE_NOT_AUTHORIZED');
if(!clientHomeLiveRefreshV1Authorized)errors.push('CLIENT_HOME_LIVE_REFRESH_V1_GOVERNANCE_NOT_AUTHORIZED');
if(!clientHomePendingRefreshV2Authorized)errors.push('CLIENT_HOME_PENDING_REFRESH_V2_GOVERNANCE_NOT_AUTHORIZED');
if(clientHomePendingRefreshV2Authorized&&clientHomePendingRefreshV2AppliedFiles!==1)
  errors.push('CLIENT_HOME_PENDING_REFRESH_V2_EXACT_BLOB_COUNT expected=1 actual='+clientHomePendingRefreshV2AppliedFiles);
if(clientHomeLiveRefreshV1Authorized&&clientHomeLiveRefreshV1AppliedFiles!==1)
  errors.push('CLIENT_HOME_LIVE_REFRESH_V1_EXACT_BLOB_COUNT expected=1 actual='+clientHomeLiveRefreshV1AppliedFiles);
if(clientAnalyticsBuyerV20ExceptionAuthorized&&clientAnalyticsBuyerV20AppliedFiles!==CLIENT_ANALYTICS_BUYER_V20_FILES.length)
  errors.push('CLIENT_ANALYTICS_BUYER_V20_EXACT_BLOB_COUNT expected='+CLIENT_ANALYTICS_BUYER_V20_FILES.length+' actual='+clientAnalyticsBuyerV20AppliedFiles);
if(clientAnalyticsSingleOwnerV19ExceptionAuthorized&&clientAnalyticsSingleOwnerV19AppliedFiles!==CLIENT_ANALYTICS_SINGLE_OWNER_V19_FILES.length)
  errors.push('CLIENT_ANALYTICS_SINGLE_OWNER_V19_EXACT_BLOB_COUNT expected='+CLIENT_ANALYTICS_SINGLE_OWNER_V19_FILES.length+' actual='+clientAnalyticsSingleOwnerV19AppliedFiles);
if(clientAnalyticsNativeV17ExceptionAuthorized&&clientAnalyticsNativeV17AppliedFiles!==1)errors.push('CLIENT_ANALYTICS_NATIVE_V17_EXACT_BLOB_COUNT expected=1 actual='+clientAnalyticsNativeV17AppliedFiles);
if(analyticsLpgV13Exception&&analyticsLpgV13AppliedFiles!==ANALYTICS_LPG_V13_FILES.length)
  errors.push(`ANALYTICS_LPG_V13_EXACT_BLOB_COUNT expected=${ANALYTICS_LPG_V13_FILES.length} actual=${analyticsLpgV13AppliedFiles}`);
const analyticsDailyV12EffectiveFiles=analyticsDailyV12AppliedFiles+
  (analyticsLpgV13AppliedFiles===ANALYTICS_LPG_V13_FILES.length?ANALYTICS_LPG_V13_FILES.length:0);
if(analyticsDailyV12Exception&&analyticsDailyV12EffectiveFiles!==ANALYTICS_DAILY_V12_FILES.length)
  errors.push(`ANALYTICS_DAILY_V12_EXACT_BLOB_COUNT expected=${ANALYTICS_DAILY_V12_FILES.length} actual=${analyticsDailyV12EffectiveFiles}`);
const clientAnalyticsDtLpgV11EffectiveFiles=clientAnalyticsDtLpgV11AppliedFiles+
  (analyticsDailyV12EffectiveFiles===ANALYTICS_DAILY_V12_FILES.length?ANALYTICS_DAILY_V12_FILES.length:0);
if(clientAnalyticsDtLpgV11Exception&&clientAnalyticsDtLpgV11EffectiveFiles!==CLIENT_ANALYTICS_DT_LPG_V11_FILES.length)
  errors.push(`CLIENT_ANALYTICS_DT_LPG_V11_EXACT_BLOB_COUNT expected=${CLIENT_ANALYTICS_DT_LPG_V11_FILES.length} actual=${clientAnalyticsDtLpgV11EffectiveFiles}`);
const clientAnalyticsAdminParityEffectiveFiles=clientAnalyticsAdminParityAppliedFiles+
  (clientAnalyticsDtLpgV11EffectiveFiles===CLIENT_ANALYTICS_DT_LPG_V11_FILES.length?CLIENT_ANALYTICS_DT_LPG_V11_FILES.length:0);
if(clientAnalyticsAdminParityException&&clientAnalyticsAdminParityEffectiveFiles!==CLIENT_ANALYTICS_ADMIN_PARITY_FILES.length)
  errors.push(`CLIENT_ANALYTICS_ADMIN_PARITY_V10_EXACT_BLOB_COUNT expected=${CLIENT_ANALYTICS_ADMIN_PARITY_FILES.length} actual=${clientAnalyticsAdminParityEffectiveFiles}`);
const clientAnalyticsPublishedPriceEffectiveFiles=clientAnalyticsPublishedPriceAppliedFiles+
  (clientAnalyticsAdminParityEffectiveFiles===CLIENT_ANALYTICS_ADMIN_PARITY_FILES.length?CLIENT_ANALYTICS_ADMIN_PARITY_FILES.length:0);
if(clientAnalyticsPublishedPriceException&&clientAnalyticsPublishedPriceEffectiveFiles!==CLIENT_ANALYTICS_PUBLISHED_PRICE_FILES.length)
  errors.push(`CLIENT_ANALYTICS_PUBLISHED_PRICE_V9_EXACT_BLOB_COUNT expected=${CLIENT_ANALYTICS_PUBLISHED_PRICE_FILES.length} actual=${clientAnalyticsPublishedPriceEffectiveFiles}`);
const clientAnalyticsAuthorizedPriceEffectiveFiles=clientAnalyticsAuthorizedPriceAppliedFiles+
  (clientAnalyticsPublishedPriceEffectiveFiles===CLIENT_ANALYTICS_PUBLISHED_PRICE_FILES.length?CLIENT_ANALYTICS_PUBLISHED_PRICE_FILES.length:0);
if(clientAnalyticsAuthorizedPriceException&&clientAnalyticsAuthorizedPriceEffectiveFiles!==CLIENT_ANALYTICS_AUTHORIZED_PRICE_FILES.length)
  errors.push(`CLIENT_ANALYTICS_AUTHORIZED_PRICE_V8_EXACT_BLOB_COUNT expected=${CLIENT_ANALYTICS_AUTHORIZED_PRICE_FILES.length} actual=${clientAnalyticsAuthorizedPriceEffectiveFiles}`);
const clientAnalyticsCanonicalRestoreEffectiveFiles=clientAnalyticsCanonicalRestoreAppliedFiles+
  (clientAnalyticsAuthorizedPriceEffectiveFiles===CLIENT_ANALYTICS_AUTHORIZED_PRICE_FILES.length?CLIENT_ANALYTICS_AUTHORIZED_PRICE_FILES.length:0);
if(clientAnalyticsCanonicalRestoreExceptionAuthorized&&clientAnalyticsCanonicalRestoreEffectiveFiles!==CLIENT_ANALYTICS_CANONICAL_RESTORE_FILES.length)
  errors.push(`CLIENT_ANALYTICS_CANONICAL_RESTORE_V7_EXACT_BLOB_COUNT expected=${CLIENT_ANALYTICS_CANONICAL_RESTORE_FILES.length} actual=${clientAnalyticsCanonicalRestoreEffectiveFiles}`);
const clientAnalyticsActiveRouteRecoveryEffectiveFiles=clientAnalyticsActiveRouteRecoveryAppliedFiles+
  (clientAnalyticsCanonicalRestoreEffectiveFiles===CLIENT_ANALYTICS_CANONICAL_RESTORE_FILES.length?CLIENT_ANALYTICS_CANONICAL_RESTORE_FILES.length:0);
if(clientAnalyticsActiveRouteRecoveryExceptionAuthorized&&clientAnalyticsActiveRouteRecoveryEffectiveFiles!==CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_FILES.length)
  errors.push(`CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_V6_EXACT_BLOB_COUNT expected=${CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_FILES.length} actual=${clientAnalyticsActiveRouteRecoveryEffectiveFiles}`);
const clientAnalyticsVisibilityEffectiveFiles=clientAnalyticsVisibilityAppliedFiles+
  (clientAnalyticsActiveRouteRecoveryEffectiveFiles===CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_FILES.length?CLIENT_ANALYTICS_ACTIVE_ROUTE_RECOVERY_FILES.length:0);
if(clientAnalyticsVisibilityExceptionAuthorized&&clientAnalyticsVisibilityEffectiveFiles!==CLIENT_ANALYTICS_VISIBILITY_FILES.length)
  errors.push(`CLIENT_ANALYTICS_VISIBLE_OWNER_V5_EXACT_BLOB_COUNT expected=${CLIENT_ANALYTICS_VISIBILITY_FILES.length} actual=${clientAnalyticsVisibilityEffectiveFiles}`);
const clientAnalyticsReentryEffectiveFiles=clientAnalyticsReentryAppliedFiles+(clientAnalyticsVisibilityEffectiveFiles===CLIENT_ANALYTICS_VISIBILITY_FILES.length?CLIENT_ANALYTICS_VISIBILITY_FILES.length:0);
if(clientAnalyticsReentryExceptionAuthorized&&clientAnalyticsReentryEffectiveFiles!==CLIENT_ANALYTICS_REENTRY_FILES.length)
  errors.push(`CLIENT_ANALYTICS_REENTRY_EXACT_BLOB_COUNT expected=${CLIENT_ANALYTICS_REENTRY_FILES.length} actual=${clientAnalyticsReentryEffectiveFiles}`);
const clientAnalyticsCurrentSourceEffectiveFiles=clientAnalyticsCurrentSourceAppliedFiles+(clientAnalyticsReentryEffectiveFiles===CLIENT_ANALYTICS_REENTRY_FILES.length?CLIENT_ANALYTICS_REENTRY_FILES.length:0);
if(clientAnalyticsCurrentSourceExceptionAuthorized&&clientAnalyticsCurrentSourceEffectiveFiles!==CLIENT_ANALYTICS_CURRENT_SOURCE_FILES.length)
  errors.push(`CLIENT_ANALYTICS_CURRENT_SOURCE_EXACT_BLOB_COUNT expected=${CLIENT_ANALYTICS_CURRENT_SOURCE_FILES.length} actual=${clientAnalyticsCurrentSourceEffectiveFiles}`);
const clientMarketEventDrivenEffectiveFiles=Math.max(clientMarketEventDrivenAppliedFiles,clientAnalyticsCurrentSourceEffectiveFiles===CLIENT_ANALYTICS_CURRENT_SOURCE_FILES.length?1:0);
if(clientMarketEventDrivenExceptionAuthorized&&clientMarketEventDrivenEffectiveFiles!==CLIENT_MARKET_EVENT_DRIVEN_FILES.length)
  errors.push(`CLIENT_MARKET_EVENT_DRIVEN_EXACT_BLOB_COUNT expected=${CLIENT_MARKET_EVENT_DRIVEN_FILES.length} actual=${clientMarketEventDrivenEffectiveFiles}`);
if(!clientContractEventDrivenExceptionAuthorized)errors.push('CLIENT_CONTRACT_EVENT_DRIVEN_GOVERNANCE_NOT_AUTHORIZED');
if(clientContractEventDrivenExceptionAuthorized&&clientContractEventDrivenAppliedFiles!==CLIENT_CONTRACT_EVENT_DRIVEN_FILES.length)errors.push(`CLIENT_CONTRACT_EVENT_DRIVEN_EXACT_BLOB_COUNT expected=${CLIENT_CONTRACT_EVENT_DRIVEN_FILES.length} actual=${clientContractEventDrivenAppliedFiles}`);
if(!clientBackgroundManifestEventDrivenExceptionAuthorized)errors.push('CLIENT_BACKGROUND_MANIFEST_EVENT_DRIVEN_GOVERNANCE_NOT_AUTHORIZED');
if(clientBackgroundManifestEventDrivenExceptionAuthorized&&clientBackgroundManifestEventDrivenAppliedFiles!==CLIENT_BACKGROUND_MANIFEST_EVENT_DRIVEN_FILES.length)errors.push(`CLIENT_BACKGROUND_MANIFEST_EVENT_DRIVEN_EXACT_BLOB_COUNT expected=${CLIENT_BACKGROUND_MANIFEST_EVENT_DRIVEN_FILES.length} actual=${clientBackgroundManifestEventDrivenAppliedFiles}`);
const clientContractEventDrivenSupersedesLegacyContractVisualBlob=
  clientContractEventDrivenExceptionAuthorized&&
  clientContractEventDrivenAppliedFiles===CLIENT_CONTRACT_EVENT_DRIVEN_FILES.length;
if(!clientPostreleaseIssue430ExceptionAuthorized)errors.push('CLIENT_POSTRELEASE_ISSUE430_GOVERNANCE_NOT_AUTHORIZED');
if(clientPostreleaseIssue430ExceptionAuthorized&&clientPostreleaseIssue430AppliedFiles!==CLIENT_POSTRELEASE_ISSUE430_FILES.length&&!clientContractEventDrivenSupersedesLegacyContractVisualBlob)errors.push(`CLIENT_POSTRELEASE_ISSUE430_EXACT_BLOB_COUNT expected=${CLIENT_POSTRELEASE_ISSUE430_FILES.length} actual=${clientPostreleaseIssue430AppliedFiles}`);
const clientSectionTypography110EffectiveFiles=clientSectionTypography110AppliedFiles+clientPostreleaseIssue430AppliedFiles+(clientContractEventDrivenSupersedesLegacyContractVisualBlob?CLIENT_SECTION_TYPOGRAPHY_110_FILES.length:0);
if(clientSectionTypography110ExceptionAuthorized&&clientSectionTypography110EffectiveFiles!==CLIENT_SECTION_TYPOGRAPHY_110_FILES.length){
  errors.push(`CLIENT_SECTION_TYPOGRAPHY_110_EXACT_BLOB_COUNT expected=${CLIENT_SECTION_TYPOGRAPHY_110_FILES.length} actual=${clientSectionTypography110EffectiveFiles}`);
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

console.log(`CLIENT_PORTAL_VISUAL_FREEZE=PASS baseline=${policy.baseline_release_commit} protected=${Object.keys(protectedFiles).length} applications_owner_exception=${applicationExceptionAuthorized?'approved':'none'} deals_loader_owner_exception=${dealsLoaderExceptionAuthorized?'approved':'none'} client_load_hotfix_pr429_exception=${clientLoadHotfixExceptionAuthorized?'approved':'none'} owner_visual_delta_exception=${ownerVisualDeltaExceptionAuthorized?'approved':'none'} owner_visual_delta_applied_files=${ownerVisualDeltaAppliedFiles} client_multicontext_430_exception=${clientMultiContext430ExceptionAuthorized?'approved':'none'} client_multicontext_430_applied_files=${clientMultiContext430AppliedFiles} client_section_typography_110_exception=${clientSectionTypography110ExceptionAuthorized?'approved':'none'} client_section_typography_110_applied_files=${clientSectionTypography110AppliedFiles} client_section_typography_qa_wiring_exact_files=${pr431TypographyQaWiringExactFiles} pr431_two_bug_scoped_freeze_exception=${pr431TwoBugScopedFreezeExceptionAuthorized?'approved':'none'} pr431_two_bug_scoped_applied_files=${pr431TwoBugScopedAppliedFiles} pr431_direct_fix_governance=${pr431DirectFixGovernanceAuthorized?'approved':'none'} pr431_direct_fix_exact_files=${pr431DirectFixExactFiles} deals_functional_runtime=${approvedNewRuntime.size?'approved':'none'} selected_context_delta=${clientLoadHotfixApproval?.authorized_delta||'none'} home_stale_fail_open_delta=${clientLoadHotfixApproval?.authorized_home_delta||'none'} functional_runtime_visual_guard=pass application_business_v2_owner_scope=${applicationBusinessV2VisualExceptionAuthorized?'approved':'none'} client_rail_admin_mirror=${clientRailAdminMirrorExceptionAuthorized?'approved':'none'} client_rail_admin_mirror_applied_files=${clientRailAdminMirrorAppliedFiles} client_rail_670=${clientRail670ExceptionAuthorized?'approved':'none'} client_rail_670_applied_files=${clientRail670AppliedFiles} client_event_driven_refresh=${clientEventDrivenRefreshExceptionAuthorized?'approved':'none'} client_event_driven_refresh_applied_files=${clientEventDrivenRefreshEffectiveFiles} client_deal_attention_payments_exit=${clientDealAttentionPaymentsExitExceptionAuthorized&&clientDealAttentionPaymentsExitAppliedFiles===1?'approved':'none'} client_market_event_driven=${clientMarketEventDrivenExceptionAuthorized?'approved':'none'} client_market_event_driven_applied_files=${clientMarketEventDrivenAppliedFiles} client_contract_event_driven=${clientContractEventDrivenExceptionAuthorized?'approved':'none'} client_contract_event_driven_applied_files=${clientContractEventDrivenAppliedFiles} client_contract_legacy_visual_supersession=${clientContractEventDrivenSupersedesLegacyContractVisualBlob?'approved':'none'} client_background_manifest_event_driven=${clientBackgroundManifestEventDrivenExceptionAuthorized?'approved':'none'} client_background_manifest_event_driven_applied_files=${clientBackgroundManifestEventDrivenAppliedFiles} client_company_directory_event_driven=${clientCompanyDirectoryEventDrivenExceptionAuthorized?'approved':'none'} client_sidebar_command_nav=${clientSidebarCommandNavExceptionAuthorized&&approvedNewRuntime.has('client-sidebar-command-nav-v1.js')?'approved':'none'} client_deals_stage_tabs=${clientDealsStageTabsExceptionAuthorized&&clientDealsStageTabsExact?'approved':'none'} client_deals_visual_hierarchy=${clientDealsVisualHierarchyExceptionAuthorized?'approved':'none'} visual_css_change=${clientDealsVisualHierarchyExceptionAuthorized?'OWNER_APPROVED_DEALS_V2':ownerVisualDeltaAppliedFiles?'OWNER_APPROVED_EXACT':'none'}`);
console.log('VISUAL_FREEZE_EXACT_EXCEPTION=PASS');