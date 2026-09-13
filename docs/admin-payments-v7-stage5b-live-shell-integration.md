# Admin Payments V7 — Stage 5B live shell recovery and real route integration

Status: `PREPRODUCTION_FRONTEND_INTEGRATION_READY / FRONTEND_PRODUCTION_DEPLOY=HOLD`.

Stage 5B does not deploy frontend or backend code and does not execute production DDL/DML. It source-locks the currently deployed Admin shell, recovers that exact source in a controlled test workspace, retires the legacy Payments renderer in the recovered source, and validates the V7 route in the real shell structure.

## 1. CURRENT_STATE_FIRST — exact live lineage

The live source was not inferred from branch names. Repository history, release source, shell asset markers, Cloudflare production checks, and the current Owner-visible legacy Payments behavior were reconciled.

Canonical live lineage:

- `LIVE_ADMIN_SOURCE_COMMIT=86133bfa66f044944434aeb0baed07af5d84621e`
- release branch: `release/public-go-live-v1.1`
- `LIVE_ADMIN_ENTRYPOINT=assets/portal-admin-shell-fast-v1.js`
  - blob: `995c4b51db010fea9f1a8ee047db386d4cd94f9d`
  - runtime marker: `single-owner-v3`
  - loads `/portal/main-ui?v=20260826-single-owner`
- native Admin HTML: `portal-src/current/admin.html`
  - blob: `935afdf6eb1ff58eae806cb4381f8b93bed1a02a`
  - contains the existing sidebar/topbar/navigation and native `data-page="payments"` / `#page-payments` route
- `LIVE_MAIN_UI_SOURCE=functions/portal/main-ui/index.js -> functions/portal/admin-main-ui-current.js -> functions/portal/owner-ui-chunks`
  - `functions/portal/main-ui/index.js` blob: `1acb0809481e57ea47e050b3b3b55e6f576cefb0`
  - `functions/portal/admin-main-ui-current.js` blob: `11f5da8ad96272a69f882a2ff66fdf0a1f5d8d1c`
- `LIVE_PAYMENTS_RENDERER=functions/portal/owner-ui-chunks/chunk3.js::renderPayments`
  - blob: `653f7dbec0d19aee55274567aee9dd03a8a88f05`
  - legacy renderer reads `financeFragment()` and contains the primary table `Поступило от клиентов`
- production Cloudflare lineage for the source-locked release:
  - Workers project: `ronatrade-com`
  - production build ID: `a634bbd0-b254-4e59-b197-38151b84518d`
  - version ID: `0334e818-63e1-455f-8082-49876096255e`
  - repository `admin-shell-live-production` semantic custom-domain verification: PASS.

The later `feat/admin-payments-v7-native-data-driven-owner-dashboard` and `hotfix/restore-admin-approved-v455-runtime-20260831` branches were inspected but are not used merely because of their names. Their current Admin source differs from the source-locked production release and therefore is not the Stage 5B baseline.

## 2. Controlled live-source recovery

`scripts/admin-payments-v7-stage5b-live-source.mjs` is the source-lock and recovery mechanism. CI checks the exact Git blobs above, materializes the following source from `LIVE_ADMIN_SOURCE_COMMIT`, and only then applies the Stage 5B Payments change:

- `assets/portal-admin-shell-fast-v1.js`
- `portal-src/current/admin.html`
- `functions/portal/main-ui/index.js`
- `functions/portal/main-ui/application-passport-runtime.js`
- `functions/portal/admin-main-ui-current.js`
- `functions/portal/admin-operations-command-center-v4.js`
- `functions/portal/owner-ui-chunks/chunk0.js` … `chunk18.js`

The integration fails closed if the exact legacy `renderPayments()` source marker drifts. It never constructs a replacement Admin shell.

## 3. Real Payments route replacement

The recovered live `admin-main-ui-current.js` is patched at build/integration time so that exactly one `renderPayments()` remains in the assembled `/portal/main-ui` script.

The new route renderer reads only:

`window.__RONA_OWNER_AI_SYNC_SNAPSHOT__.paymentsV7Projection`

This browser object is the unwrapped `adminSync.data.paymentsV7Projection` returned by the backend integration.

For Admin → Payments:

- `financeFragment` is not referenced by the V7 `renderPayments()`;
- legacy `Поступило от клиентов` is removed from the Payments route;
- `financeFragment` is left in the shared Admin runtime for Cash/other existing consumers;
- one route owner is emitted: `admin-payments-v7-native`;
- no Payments `MutationObserver`, rebinding, takeover, repeated recovery loop, or second renderer is added;
- native header/sidebar/navigation and the current router remain byte-for-byte recovered source, not a new shell.

## 4. Global KPI contract

First screen order is fixed as:

`Платежи -> 4 global KPI cards -> one Deal board -> optional Owner queue`.

Global cards are calculated only from `projection.deals`:

1. `К получению` -> aggregation of authoritative `total_to_receive`, grouped by currency;
2. `Получено` -> authoritative `verified_received`, grouped by currency;
3. `Ожидается` -> authoritative `expected_not_due`, grouped by currency;
   - `future_conditional` is a separate `Conditional` subline and is never added to primary expected;
4. `Потрачено / Остаток` -> only authoritative `actual_spend` / `remaining_execution`; otherwise the card is `TO_VERIFY`.

Currencies are never converted or combined with FX assumptions in the UI.

Responsive contract:

- desktop: KPI `4 x 1`;
- medium: `2 x 2`;
- mobile: `1 x 4`;
- Deal metric cells use the same 4/2/1 responsive degradation;
- all cards use `min-width:0` and wrapping rules; browser proof checks Payments-route horizontal overflow.

## 5. Deal board and Owner queue

Deal rows are created only by iterating `projection.deals`. No production Deal ID, client, amount, percentage, currency, or current counterparty literal exists in integration logic.

Owner queue is rendered only from `projection.owner_exception_queue`. If it is empty, no Owner-decision section exists in DOM.

Top-level technical phrases were removed. Provenance remains under the per-Deal `Паспорт` disclosure.

## 6. Real-shell browser acceptance

`scripts/admin-payments-v7-stage5b-browser-proof.mjs` compiles both the exact recovered legacy main UI and the Stage 5B patched main UI, serves the exact Admin HTML and exact shell loader, feeds an Admin sync payload, and drives the native `button[data-page="payments"]` route in headless Chrome.

It proves:

- before: legacy Payments content and the stale `362 600 USD` fixture are visible;
- after: exactly one `.rona-payments-v7` owner exists;
- all current V7 acceptance values render and `362 600 USD` does not;
- four global KPI cards precede the Deal board;
- empty Owner queue is absent;
- Payments -> Home -> Payments leaves exactly one renderer;
- topbar/sidebar/navigation DOM identity remains preserved;
- desktop / medium / mobile KPI grid is 4 / 2 / 1 columns;
- Payments route has no horizontal overflow.

CI uploads:

- `before-live-legacy-desktop.png`
- `after-v7-desktop.png`
- `after-v7-medium.png`
- `after-v7-mobile.png`
- `browser-proof.json`.

## 7. Gates

- `FRONTEND_PRODUCTION_DEPLOY=HOLD`
- `BACKEND_DEPLOY=UNCHANGED`
- `PRODUCTION_DDL=UNCHANGED`
- `PRODUCTION_BUSINESS_DATA_MUTATION=UNCHANGED`
- `MERGE=HOLD`

No production frontend mutation is part of Stage 5B.
