# RONA Trade — Audit of legacy Analytics visual owners (V6)

**Date:** 2026-10-11 | **Actor:** AI-SYSTEM-ADMIN | **Scope:** Admin and Client Analytics visual/runtime chain only
**Authoritative baseline:** release/public-go-live-v1.1 @ `112cfd7ce3f5d5c855128582d18d67bbd7437e3d`.
**Owner instruction:** safely deactivate/delete recurring obsolete visual layers; keep current Admin R4 and Client V20.

## Confirmed root cause and technical evidence

1. **Competing Admin Analytics table writer — ACTIVE before V6.**
   The compressed historical Admin owner UI in `functions/portal/owner-ui-chunks/chunk3.js` and `chunk4.js` defines `renderAnalytics()`. It builds an obsolete table with 7/30/90-day selector and writes `replacePage('analytics',c)`. The original startup `renderAdmin()`, navigation `renderOwnedAdminPage('analytics')`, and authority refresh `ownerAdminRenderCurrent()` still called that writer. This could overwrite the approved `#rona-analytics-v2` chart whenever the owner core re-rendered.
   **Corrective action:** `patchRetiredAnalyticsOwner()` in `functions/portal/admin-main-ui-current.js` structurally excises the complete writer body, the `analytics:renderAnalytics` route and the bootstrap call from *served materialized JavaScript* after applying all existing Payments/Deals/Rail/Operations source transformations. It is fail-closed on source drift. The current-only router and lazy Analytics module remain active, including refresh.

2. **Retired Admin V455 DOM scrub — STILL LOADED before V6.**
   Current Admin HTML loaded `/portal/admin-approved-analytics-v455-ui` on every page. That endpoint registered page-change DOM cleanup callbacks even though obsolete. This is a redundant visual modifier.
   **Corrective action:** remove the script tag in the current-only Admin HTML and delete its dedicated JS endpoint. Do not remove unrelated `admin-approved-shell-v455-ui` (current sidebar visual owner).

3. **Obsolete V13 LPG SVG repainter — STILL APPENDED before V6.**
   `functions/portal/analytics-v2-ui.js` appended a second SVG writer, `LPG_GAP_RUNTIME`, including its own `MutationObserver`, event handlers and SVG path rewriting. It had an Admin pathname guard, but the redundant writer remained in the canonical payload.
   **Corrective action:** remove the import/append and delete dedicated V13 runtime. Preserve R4 `adminCompactChart()` as the **only** chart-point/path owner for Admin.

4. **Other historical modules — not presently loaded by current router.**
   `remaining-sections-r2-base.js` contains old `renderAnalytics()`, but its current served wrapper `remaining-sections-ui.js` strips the old implementation and route before delivery. Source `remaining-sections-owner-v3-ui.js` / `remaining-sections-owner-v4-ui.js` are historical multi-purpose endpoints with non-Analytics sections; no current Admin HTML/fast shell loads them. Delete neither shared historical component indiscriminately: this would risk access/news/radio and break historical traceability.

5. **Client Analytics owner — PROTECTED.**
   Frozen Client V20 `assets/portal-runtime/client-market-intelligence-v1.js` uses canonical `#rona-analytics-v2`, scrubs known substitute nodes, and enforces published/effective-client source. Its byte-locked source and HTML attachment script stay unchanged. Current client graph runtime is not replaced by an Admin renderer.

## Immutable contract and scope

- Canonical Admin R4 hydration blob: `a7407d85d8cffca79a44a43465c211ca858d37a0`; approved base compressed visual blob: `64903cd0f64acd1250c103456ea12104e81445e0`.
- Client V20 runtime blob: `417bf3773613a54b0aa4420f0978cf94d4d04a02`.
- Market source window: last 30 Europe/Moscow calendar dates, real verified non-null dates only. No synthetic dates, no database/forecast/price/invoice/publication/IAM changes.
- Supabase source MD5: daily monitor `5a0fdacc196efc889cb8c047f0164330`, Admin canonical `a7f0ff21a938e0554684b3ef90c9d005`. Edge production v106 verify_jwt=true; no Edge change in V6.
- Current visual design, source IDs, product switch, hover data and authorized client contract-price distinctions must remain unchanged.

## QA proof required prior to release

- Static actual emitted `/portal/main-ui` no `renderAnalytics()`, no `replacePage('analytics'...)`, no `analytics:renderAnalytics`, while current router/refresh remains.
- Canonical `/portal/analytics-v2-ui` contains exactly one R4 `adminCompactChart()` and no V13 second writer.
- `portal/admin.html` has no V455 Analytics loader; deleted V455/V13 endpoints do not materialize in deployment.
- Existing Admin R3/R4 browser QA, including repeated DT/LPG toggle, source failure recovery, no interpolation and 30-day data.
- Client V20 frozen visual, published source, tenant scope and current pricing all PASS, plus Cloudflare exact-SHA production smoke.
- Owner authenticated visual acceptance remains separate and cannot be inferred from automated tests.

## Rollback strategy

Use the precise previous release `112cfd7ce3f5d5c855128582d18d67bbd7437e3d` as a rollback reference. Prefer reverting only the V6 source/HTML/test deltas instead of rolling back other business changes. Historical file blobs for retired endpoints are pinned in `governance/analytics-v6-single-owner-retirement-20261011.json`; do not delete Git history or rewrite immutable R4 approval.

## Non-blocking historical QA debt

Some unrelated old workflows assert `data-page="claims"` despite Claims having been retired in current Admin source, or reject any Admin HTML byte change even when the only V6 change is the single approved obsolete Analytics script removal. Those gates must be corrected to require the actual canonical Claims absence and the **exact** approved HTML delta, never globally relaxed. Existing unrelated role, client context and sidebar failures must not be represented as all-green.
