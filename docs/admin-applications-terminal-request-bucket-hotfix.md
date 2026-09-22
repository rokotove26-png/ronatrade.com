# Admin Applications — historical completed request bucket hotfix

Incident: after durable Client Intake reconciliation, an old 500 t `DELIVERED_PRICE_CALCULATION_REQUEST_V1` from 2026-08-30 appeared in the active `В работе` bucket.

The record is not a new application and was not newly submitted. Its historical staff task was completed on 2026-08-30. Stage 2.4 correctly projects standalone completed requests as `owner_status=COMPLETED`, `status=COMPLETED`, `lifecycle_state=ARCHIVED`.

Root cause is downstream Admin bucketing: `application2BBucket` does not recognize terminal `COMPLETED/DONE/CLOSED` request states or `ARCHIVED` lifecycle. Such rows fall through to `WORK`.

Correction is presentation-only and generic: preserve existing bucket rules, but force terminal owner/status values and archived lifecycle into `COMPLETED`. Supplier-approved handoff remains actionable and is not classified as terminal. The overlay triggers one refresh so an already-open page is re-rendered against corrected semantics.

No raw source changes. No deletion of historical records. No application lifecycle mutation. No Payments/Finance change. No incident ID or expected-value hardcode in runtime code.
