# P1 Client Intake Stage 2 — global actionable submit-path audit

Scope: all current server-accepted Client actionable submission families plus known price/terms subtypes and an unknown-future fail-closed path. Candidate implementation only; production is unchanged.

Every row is mapped to the same logical invariant:

`successful actionable submission -> durable intake id + Client projection + Admin projection + routing state`.

| # | UI action / actionable class | API endpoint | immutable source table | canonical intake | durable id | Client projection | Admin projection | routing policy | responsible role | task requirement | idempotency | audit | reconciliation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Published-price application | `POST /v1/client/applications` | `client_applications` | `client_intake_v1` | `durable_id` | client projection view | admin projection view | `CLIENT_APPLICATION_PUBLISHED_PRICE_V1` | OPERATIONS_DIRECTOR | yes | source submit key + unique source | intake audit | yes |
| 2 | Client-proposed price application | `POST /v1/client/applications` | `client_applications` | same | same | same | same | `CLIENT_APPLICATION_PROPOSED_PRICE_V1` | OPERATIONS_DIRECTOR | yes | source submit key + unique source | yes | yes |
| 3 | Legacy/compatibility `CLIENT_APPLICATION_SUBMIT` event | `POST /v1/events` | `portal_reverse_events` | same | same | same | same | declarative Client application-event policy | OPERATIONS_DIRECTOR | yes | reverse-event idempotency + unique source | yes | yes |
| 4 | Delivered-price calculation | `POST /v1/events` / `CLIENT_MESSAGE_SUBMIT` + `DELIVERED_PRICE_CALCULATION_REQUEST_V1` | `portal_reverse_events` | same | same | same | same | `DELIVERED_PRICE_CALCULATION_REQUEST_V1` | OPERATIONS_DIRECTOR | yes | reverse-event idempotency + unique source | yes | yes |
| 5 | Commercial terms request | `POST /v1/events` / message subtype `COMMERCIAL_TERMS_REQUEST_V1` | `portal_reverse_events` | same | same | same | same | `COMMERCIAL_TERMS_REQUEST_V1` | OPERATIONS_DIRECTOR | yes | same | yes | yes |
| 6 | Generic Client communication | `POST /v1/client/messages` -> reverse event | `portal_reverse_events` | same | same | same | same | `CLIENT_MESSAGE_SUBMIT_V1` | OPERATIONS_DIRECTOR | yes | same | yes | yes |
| 7 | Client claim | `POST /v1/events` / `CLIENT_CLAIM_SUBMIT` | `portal_reverse_events` | same | same | same | same | `CLIENT_CLAIM_SUBMIT_V1` | LEGAL | yes | same | yes | yes |
| 8 | Client payment proof | `POST /v1/events` / `CLIENT_PAYMENT_PROOF_SUBMIT` | `portal_reverse_events` | same | same | same | same | `CLIENT_PAYMENT_PROOF_SUBMIT_V1` | ACCOUNTING | yes | same | yes | yes |
| 9 | Client document acknowledgement | `POST /v1/events` / `CLIENT_DOCUMENT_ACK` | `portal_reverse_events` | same | same | same | same | `CLIENT_DOCUMENT_ACK_V1` | LEGAL | yes | same | yes | yes |
| 10 | Future/unknown `CLIENT_*` actionable type | `POST /v1/events` | `portal_reverse_events` | same | same | visible fail-closed | visible fail-closed | no silent fallback: `ROUTING_POLICY_MISSING` | unresolved | no task until policy exists; durable outbox is DEAD_LETTER | same | yes | reconciliation keeps it visible/diagnosable |

## Existing routing source comparison

Production `staff_role_for_reverse_event` maps claim/document acknowledgement to LEGAL, payment proof to ACCOUNTING, and defaults other event types to OPERATIONS_DIRECTOR. The candidate registry preserves those known responsibilities. For `DELIVERED_PRICE_CALCULATION_REQUEST_V1`, no newer authoritative routing policy was discovered; the candidate explicitly sets OPERATIONS_DIRECTOR with `task_required=true`, `client_visible=true`, `admin_visible=true`, and `acknowledgement_required=true` as required by the Owner instruction.

## Exactly-once controls

- canonical intake uniqueness: `(source_kind, source_record_id)`;
- source idempotency uniqueness per source kind when present;
- outbox uniqueness: `(intake_id, stage_key)`;
- task link primary key: `(intake_id, stage_key)` plus unique staff task id;
- worker first reuses any already-existing task associated with the underlying application/reverse event before creating a new one;
- reconciliation calls the same idempotent ensure functions and cannot create a second intake or routing stage.

## Visibility and fail-closed behavior

Known policies require both Client and Admin visibility. Unknown actionable types are also visible in both projections but enter `DEAD_LETTER / ROUTING_POLICY_MISSING` rather than being silently dropped or guessed. This prevents a successful actionable submit from becoming dual-invisible.

## Audit result

`GLOBAL_SUBMIT_PATH_COUNT=10`

`GLOBAL_SUBMIT_PATH_AUDIT=PASS` for the candidate architecture. Production remains unchanged until independent System Administrator review and a separate release command.
