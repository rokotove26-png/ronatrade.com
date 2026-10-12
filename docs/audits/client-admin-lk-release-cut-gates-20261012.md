# RONA Trade Client/Admin LK — Release Cut and Fail-Closed Gates
**Date:** 2026-10-12. **Owner intent:** finish technical remediation safely through production release.  
**State:** TECHNICAL HOLD — NOT APPROVED FOR MERGE/DEPLOY.  
**Source of truth:** [PR #1172](https://github.com/rokotove26-png/ronatrade.com/pull/1172), live checks and deployed-function registry; never treat this document as a release signature.

## 1. Verified facts
- Release base: `release/public-go-live-v1.1` @ `f8f0233a33b321e8fc54a7e404cd85e3eff21718`. Leave production unchanged until signoff.
- A separate, non-production [Owner Business V2 Chromium V6 run](https://github.com/rokotove26-png/ronatrade.com/actions/runs/38304781735) passed. The source-locked run shows Client B application visibility, expanded-row preservation on refresh, A/B/A isolation, correct visible Passport source and USD 113,500 in the synthetic fixture.
- Frozen runtime `assets/portal-runtime/client-contract-download-v3.js` Git blob `af6fa41946cd14b432f4b1f360a3a5c0d2489f46` is unchanged in this PR.
- Test-only build preview corrects double scaling 1.10 × 1.10 = 1.21 into 1.10. See `scripts/qa-client-typography-110-preview-v1.mjs`; the patch applies to disposable `dist`, not checked-in source.
- Independent real Chromium geometry checks prove all 11 nav labels are inside their button bounds. Historical `scrollHeight`-based clip signals come from an absolute decorative `::after` pseudo-element, not clipped text. See `scripts/qa-client-typography-nav-geometry-v1.mjs`.
- Read-only direct Client deal-document boundary regression in `tests/security/client-deal-documents-read-boundary-v1.test.mjs` passes in focused audit: GET-only, same-origin, auth/contract scope, canonical-resource intersection, no blind impersonation propagation.
- Supabase `rona-portal-api` v106 is active. Its deployed Payments V8 source pin resolves to the same Git blob (`c500db8239ca82612096119f7dcd19f873eb2838`) as the release branch. Legacy `rona-temp-upload-order-20260816` v13 is active and requires authenticated `CLIENT` role for document workflow state.
- SQL hardening proposal `20261012173000_revoke_unneeded_public_api_grants_v1.sql` is **not deployed**. Separate security/domain review needed.
- Admin Shell Resilience source-true Access lookup has been corrected; focused QA passes. Historical Owner V4/V5 source and exact SHA wiring are protected.

## 2. Exact proposed visual source delta (NOT APPLIED)
**File:** `assets/portal-runtime/client-contract-download-v3.js`  
**Function:** `ownerSectionTypoApply(targets)`.

Old:
```js
const baselines=items.map(el=>parseFloat(getComputedStyle(el).fontSize));
```

New:
```js
const baselines=items.map(el=>{const original=Number(el.getAttribute(OWNER_TYPO_BASE_ATTR));return Number.isFinite(original)&&original>0?original:parseFloat(getComputedStyle(el).fontSize)});
```

This uses the pre-global-scaling element baseline. Invariant: 110% effective text scale exactly once; do not shrink fonts, expand fixed frames, change portal markup or enable hidden overflow.

## 3. Authorization and release blockers
| Gate | Observed condition | Required outcome |
| --- | --- | --- |
| Frozen visual runtime and workflow | `Client Portal visual freeze` fails on PR body Owner marker; protected QA workflow uses exact blobs | Explicit truthful `OWNER_VISUAL_APPROVAL:` for the **exact** visual delta; exact-post-blob governance/code review; original freeze still enabled |
| Historical V4/V5 Owner QA | Original synthetic Client B fixture and Passport mocks do not reflect Business V2 and canonical deal state | Source-locked, independently approved succession of the protected QA workflow; do **not** unilaterally modify its exact SHA |
| Rail #670, Multi-Client #430, Admin Prices | Exact-parent/delta-only/single-domain workflows reject mixed 27+ file PR | Split into scope-correct narrowly reviewed PRs; never weaken gates to force green |
| Document Admin impersonation | Legacy document service requires CLIENT role; Admin impersonation read path may fail | Authenticated role-based QA, business/legal domain acceptance; no automatic role expansion or write-capable legacy bypass |
| Database migration | Proposed SQL unexecuted; no independently verified security/domain approval | Verify RLS/GRANT impact separately, backup, transactional check, explicit domain/Owner signoff and rollback |
| Operational release | Owner UAT, runtime/deploy source pin and rollback not fully signed | Run authenticated Client/Admin smoke and capture Owner UAT approval **after** all applicable gates pass |

## 4. Safe release order
1. Preserve `f8f0233...` release SHA, deployed Edge versions, current source/blob and exact rollback reference.
2. Isolate a narrow visual patch PR from release base. **Do not** merge all unrelated audit/SQL/rail/price mutations into a visual release; branch creation was blocked in this session and must be resolved through an authorized mechanism.
3. Apply exact code delta above only after Owner visual authorization and exact-governance review. Complete scoped regression at 1366 px and 1920 px, 1440 px diagnostic and real content clipping guard.
4. Conduct independent Client/ Admin tests for authorized multi-client selection, applications, Passport provenance, payments, document reads, Admin Access, and fail-closed impersonation.
5. Ensure project build, security checks, Owner QA, rollout protection and each **applicable** scoped CI contract are green; do not infer release readiness from a single V6 PASS.
6. Review staging runtime and rollback together with Owner. Release only through the approved production deployment process; verify live SHA and browser smoke after cutover.
7. If any acceptance fails: stop rollout; restore exactly the recorded release branch/source/deployment pins. No database changes unless independently approved.

## 5. Coordination and restrictions
RONA SYSTEM_ADMIN competence covers technical assessment, code QA and handoff. Operations/Legal handoff attempts for this unregistered SYSTEM checkpoint returned `TARGET_NOT_FOUND_OR_OUT_OF_SCOPE` (403). No fictional role acceptance or implicit human Owner UAT is recorded. No PR merge, Cloudflare rollout, Edge redeploy or SQL execution performed.

**Exit:** Owner and required domain signoffs + all applicable checks green + source/rollback parity + live rollout smoke. Until then: `DRAFT/HOLD`.
