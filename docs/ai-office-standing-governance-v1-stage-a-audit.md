# RONA AI Office Standing Governance V1 — Stage A Read-Only Audit

Date: 2026-09-29  
Mode: CURRENT_STATE_FIRST -> PRODUCTION_CURRENT -> SOURCE_LOCK -> DELTA_ONLY  
Repository baseline: `539a5fffaed3504f199d9f1f9f1f055a98548d59`  
Supabase project: `sxawrwzeobaqwwmlkzws`

## Owner target

Build a persistent AI-office model where a fresh Pilot chat restores the employee from production state rather than chat memory; each role knows its identity, official title, corporate mailbox and office directory; refuses out-of-scope owner tasks and routes them to the correct role; processes role-scoped tasks/handoffs automatically; follows canonical LK/authority rules; uses only canonical corporate document assets; and preserves canonical Finance report formats.

No authority expansion is permitted.

## Current canonical topology

Humans:
- OWNER
- TREASURY

Canonical AI roles:
- FINANCE
- OPERATIONS_DIRECTOR
- COMMERCIAL_DIRECTOR
- LEGAL
- RAIL_LOGISTICS
- SYSTEM_ADMIN

Compatibility only:
- ACCOUNTING -> FINANCE
- EXECUTIVE_DIRECTOR -> OPERATIONS_DIRECTOR
- MARKET_ANALYST -> COMMERCIAL_DIRECTOR

The canonical authority registry contains no ACCOUNTING or EXECUTIVE_DIRECTOR actor rows. MARKET_ANALYST remains LEGACY_AI.

## Confirmed production foundations

### Role recovery

`RONA_ROLE_STATE_RECOVERY_V5` / `RONA_ROLE_ROUTING_CONTRACT_V4` are production-current.

V5 currently exposes:
- active_tasks
- bootstrap
- checkpoint
- coordination
- dependency_graph
- exception_cockpit_summary
- global_role_policies
- routing_capabilities
- state_conflicts

It does not expose:
- identity_profile
- office_directory
- mailbox status
- canonical document resource catalog
- canonical report catalog

Therefore a V6 recovery contract is required.

### Role policies

Current durable policy counts:
- FINANCE: 13
- LEGAL: 1
- OPERATIONS_DIRECTOR: 2
- SYSTEM_ADMIN: 1
- COMMERCIAL_DIRECTOR: 0
- RAIL_LOGISTICS: 0

The standing office rules are therefore not uniformly materialized across all six roles.

### Runtime

Production core runtime is newer than the stale checkpoint:
- `rona-core-runtime-minute-v1`: ACTIVE, every minute
- command: `select portal_private.run_core_runtime_minute_v5();`
- dependency materialization runs on the V5 wrapper five-minute gate
- standalone heartbeat cron is disabled after consolidation

Audited coordination and staff tasks already feed the AI runtime queue.

### Autonomous executor

`rona-ai-model-executor` is ACTIVE and fail-closed coordination-only.

Safe properties to preserve:
- no autonomous business mutation
- no autonomous System Admin write
- output limited to NO_ACTION / FUNCTIONAL_CONCLUSION / HANDOFF_REQUEST / BUSINESS_CHANGE_PROPOSAL
- current-state-first input
- missing/conflicting authority remains HOLD/TO_VERIFY

Residual canonical drift:
- MARKET_ANALYST is still listed as an autonomous role and action target
- System Admin is excluded from autonomous intake
- role rules contain legacy Accounting / Market / Executive Director wording
- executor consumes `AI_READ_ONLY_V1`, not the same V5/V6 recovery contract as Pilot chats

### Corporate mail

Production role-mail synchronization is already stronger than the requested hourly polling:
- `rona-role-mail-sync-inbox`: ACTIVE every 5 minutes
- mailboxes:
  - exec_director@ronaoil.com
  - lawyer@ronaoil.com
  - finance@ronaoil.com
  - analyst@ronaoil.com
  - rail_spec@ronaoil.com

Finance already has a mailbox-to-Finance intake pipeline.

The other role mailboxes synchronize, but do not yet have one generic mail -> role-runtime intake contract.

Internal AI-to-AI work must remain on audited coordination, not internal email.

### Competence / role permissions

`staff_role_domain_permissions` still contains active compatibility-era rows for:
- ACCOUNTING
- EXECUTIVE_DIRECTOR
- MARKET_ANALYST

Those enum values may be retained for history/compatibility, but new competence routing must canonicalize them and must not treat them as separate current employees.

A deterministic canonical competence contract is required for all new task acceptance and routing.

### Documents

Production `RONA-DOC-STANDARD v1` is ACTIVE.

Confirmed current v1:
- Arial Narrow 12 pt
- justified body
- canonical signature hash:
  `7479526756c5d39b64ea7223d707ca20984cd8ea2cd1f9fadbf2e6df93b3d085`
- canonical seal hash:
  `0d6f641853949f961eb79859b123fd48df41e84493cca121200254d673e6ca2b`
- seal: 35 x 35 mm
- alternative signature/seal prohibited

Project source `Канонические подпись и печать.docx` contains assets matching those production hashes exactly.

Project source `Фирменный бланк(1).docx` SHA-256:
`dc7f591881b829b3888df96ad01167a4cfc056865850b140113bdf8aa53994ca`

`owner_canonical_document_assets` is currently empty.

Owner now requires a new standard:
- Arial Narrow 12.5 pt
- justified body
- first-line indent
- controlled spacing between headings and text blocks
- English-style corporate layout
- canonical letterhead only
- canonical signature/seal only
- seal 35 x 35 mm

This must be RONA-DOC-STANDARD v2, not a silent edit of v1.

### Finance canonical reports

Finance has durable payment/reconciliation/LK policies and current read models, including Cash Source Projection, but there is no canonical report registry table.

No report type will be invented. A report registry must be populated only from owner-approved / source-locked outputs.

## Source conflict found

The 2026-08-27 consolidated order file is explicitly a DRAFT / NOT IN FORCE and must not be promoted as-is.

It contains stale values, including:
- an older Operations Director personal name;
- old 12 pt document standard;
- prose treating Accounting as a separate authority contour.

It may be used only as source lineage for non-conflicting rules.

## Implementation delta

### Stage B — identity + governance + V6
1. Create `ai_staff_directory_v1`.
2. Materialize the five known role-bound identities and the assistant directory record without creating a seventh canonical AI role.
3. Leave gender fields TO_CONFIRM; never infer.
4. Leave SYSTEM_ADMIN personal identity/mailbox TO_CONFIRM until Owner supplies them.
5. Create canonical competence registry/contract.
6. Add standing governance policy for all six roles.
7. Create `RONA_ROLE_STATE_RECOVERY_V6` with compact:
   - identity_profile
   - office_directory
   - competence_contract
   - mailbox
   - canonical_document_resources
   - canonical_report_catalog
8. Keep V5 compatibility bridge.

### Stage C — runtime + mail
1. Canonicalize executor role targets.
2. Remove MARKET_ANALYST as a new autonomous target; map legacy input to COMMERCIAL_DIRECTOR.
3. Feed the same standing governance / competence data to autonomous executor.
4. Generalize external mail intake from Finance-only to Ops/Legal/Commercial/Rail.
5. Preserve audited coordination as the internal staff channel.
6. Preserve all owner/authority gates and fail-closed behavior.

### Stage D — documents + reports + app acceptance
1. Materialize RONA-DOC-STANDARD v2.
2. Materialize canonical signature/seal/letterhead asset records.
3. Add document preflight.
4. Create canonical Finance report registry without inventing reports.
5. Refresh/re-publish Pilot tool catalogs after schema changes.
6. Fresh-chat acceptance for all six roles.

## Write gate

No Supabase write was executed during Stage A.

Per SYSTEM_ADMIN governance, each Supabase write requires a separate explicit Owner confirmation. GitHub preparation may proceed before that confirmation.
