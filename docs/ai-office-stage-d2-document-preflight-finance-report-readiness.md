# RONA AI Office — Stage D.2 Document Generation Preflight + Finance Report Readiness

Date: 2026-09-29  
Mode: CURRENT_STATE_FIRST -> PRODUCTION_CURRENT -> SOURCE_LOCK -> COMPETENCE_GATE -> DELTA_ONLY  
Production write status: **NOT EXECUTED — separate Owner write approval required**

## Current production baseline

- RONA-DOC-STANDARD v2.0 is ACTIVE.
- Exact canonical letterhead, seal and signature bytes are materialized and pass SHA-256 preflight.
- SYSTEM_ADMIN state version is 94 with no state conflicts.
- FINANCE_CANONICAL_REPORT_REGISTRY_V1 currently contains no approved report rows.

## Competence split

This stage is MIXED_SCOPE.

SYSTEM_ADMIN owns the technical enforcement layer:
- document generation preflight contract;
- fail-closed standard/asset checks;
- projection of preflight readiness into role current-state resources;
- technical guard preventing ACTIVE Finance report rows without source-lock and Owner approval.

FINANCE owns report content, methodology and reporting format semantics. SYSTEM_ADMIN must not invent or choose a Finance report type.

## Document generation preflight

Repository audit found no current server-side document generator in this repository. Existing owner acceptance code registers uploaded PDFs; it does not generate document layout.

Therefore Stage D.2 adds a reusable fail-closed database preflight/assert contract and projects its result into RONA_ROLE_STATE_RECOVERY_V6. Any future or external document-producing workflow must call the assert contract before generation/issuance.

Ready requires:
- one ACTIVE RONA-DOC-STANDARD version 2;
- Stage D.1 exact-byte preflight ready;
- all three canonical assets ACTIVE;
- source-lock required;
- no alternative/redrawn/silent-substitution assets.

No binary asset content is exposed through current-state projection.

## Finance canonical report catalog

The canonical report registry is intentionally empty. Project/source search and current production state do not provide an Owner-approved, source-locked Finance report template or methodology sufficient to create an ACTIVE report row.

Stage D.2 therefore does **not** invent or populate a report type.

Instead it adds:
- an ACTIVE-row guard requiring Owner approval, non-empty authoritative sources, source_ref and either template_ref or methodology_ref;
- a readiness projection that reports SOURCE_ABSENT while no approved rows exist;
- explicit semantics that Finance is the content owner and SYSTEM_ADMIN may only materialize source-locked, Owner-approved definitions.

## Next gate

After this repository preparation:
1. Apply Stage D.2 schema delta only with separate Owner approval.
2. Obtain a Finance/Owner-approved source-locked report definition before any catalog population.
3. Then refresh Pilot catalogs and perform six-role fresh-chat acceptance.
