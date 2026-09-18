# Online Rail #644 — Stage B1.5 XLSX dislocation architecture

Status: **ARCHITECTURE CANDIDATE / NOT MERGED / NOT DEPLOYED / MIGRATION NOT APPLIED**

Base release:
`release/public-go-live-v1.1@8be4acc7bd88d697c1b8a3396c1ef57f37cafd24`.

PR:
`#648`.

Accepted baseline remains unchanged:
- separate XLSX history;
- MOVIZOR isolation;
- Deal ownership;
- unresolved local-time support without fabricated UTC;
- append-only resolution/correction overlays;
- no fabricated GEO;
- Stage A/A.1 untouched;
- no Finance / Payments / Cash / Deals semantic change.

## 1. Immutable evidence and canonical row locator

Evidence table:
`portal_private.rail_xlsx_dislocation_events_v1`.

The canonical row locator is:

`source_object_id + source_sheet_name + source_row_number`.

The unique source locator is therefore file/object-scoped and sheet-aware. Reference sheet:
`дисл`.

Direct INSERT to evidence is not granted to `service_role`.
Evidence writes go through:
`portal_private.rail_xlsx_dislocation_ingest_v1(...)`.

Evidence remains UPDATE/DELETE protected.

## 2. Canonical source_row

`source_row` must satisfy:
`RAIL_XLSX_SOURCE_ROW_V1`.

Exact top-level shape:

```json
{
  "schemaVersion": "RAIL_XLSX_SOURCE_ROW_V1",
  "sheetName": "дисл",
  "rowNumber": 2,
  "cells": [
    {
      "columnIndex": 1,
      "header": "номер вагона",
      "rawType": "STRING",
      "rawValue": "12345678"
    }
  ]
}
```

Cells must be strictly ordered by `columnIndex`.
Each cell contains exactly:
- `columnIndex`;
- `header`;
- `rawType`;
- `rawValue`.

Allowed raw types:
`STRING / NUMBER / BOOLEAN / BLANK / DATE_SERIAL / ERROR`.

Raw XLSX values are preserved. Numeric `rawValue: 0` remains numeric zero even when a later normalization maps an optional business code to NULL.

Leading zeros are never reconstructed by guess. If Excel supplied a numeric value that has already lost a leading zero, ingest must not pad it to manufacture a valid business identifier.

`source_row_fingerprint` is calculated from this validated deterministic JSONB representation.

## 3. Wagon number

Normalized canonical `wagon_number` must satisfy exactly:

`^[0-9]{8}$`.

The rule exists both:
- as a table CHECK constraint;
- inside guarded ingest.

The normalized value must also equal the raw `номер вагона` cell after whitespace-only normalization. No zero-padding or other reconstruction is permitted.

## 4. Time contract

Evidence always keeps:
- `raw_timestamp`;
- `event_at_local timestamp without time zone`.

When timezone is unresolved:
- `source_timezone_status='UNRESOLVED'`;
- `parsed_event_at=NULL`;
- no UTC/timestamptz is fabricated.

Unresolved local events are comparable only inside the exact `source_time_domain`.

Reference domain:

`EXPEDITOR_XLSX_FILE_SHA256:bc7429db2fbc411cb43607c54f87b824d4c8ad928353914c6e94c935870d5cc5:LOCAL_WALL_CLOCK_UNRESOLVED_V1`.

## 5. Source-policy verification

Ingest accepts evidence only when canonical `source_objects` metadata verifies:

- `source_system='RAIL_AI'`;
- `source_object_type='XLSX_WAGON_DISLOCATION'`;
- `source_version='RAIL_XLSX_DISLOCATION_V1'`;
- `raw_snapshot.sourcePolicy='EXPEDITOR_XLSX_VIA_RAIL_AI'`;
- `raw_snapshot.sourceContractVersion='RAIL_XLSX_DISLOCATION_CONTRACT_V1'`;
- non-empty `raw_snapshot.sourceTimeDomain`;
- valid SHA-256;
- canonical source receipt timestamp.

`rail_wagons.source_timestamp` uses this source receipt timestamp, never the railway event timestamp.

Duplicate-file SHA rejection remains the responsibility of the importer/import-batch admission layer and is explicitly covered by QA. The B1.3 evidence row does not silently collapse different source objects solely because they share a semantic event.

## 6. Resolution decisions and business authority

Resolution table:
`portal_private.rail_xlsx_resolution_decisions_v1`.

Allowed business authority types are closed:

- `OWNER_EXPLICIT_INSTRUCTION`;
- `RAIL_LOGISTICS_VERIFIED_DECISION`.

`actor_ref uuid` is mandatory.

No new authority registry is introduced. B1.3 reuses the existing immutable audited substrate:

### Owner authority

`actor_ref` resolves to:
`portal_private.audit_events.event_id`.

Required owner authority record:
- append-only existing audit table;
- `actor_role='ADMIN'`;
- non-null `actor_user_id`;
- `result='SUCCESS'`;
- `action='RAIL_XLSX_OWNER_RESOLUTION_INSTRUCTION'`;
- entity is the exact XLSX evidence event;
- metadata uses `RAIL_XLSX_OWNER_AUTHORITY_V1`;
- metadata must match evidence ID, resulting status, Deal and rail document.

### Rail Logistics authority

`actor_ref` resolves to:
`portal_private.ai_coordination_records.record_id`.

Required record:
- immutable existing coordination table;
- `functional_role='RAIL_LOGISTICS'`;
- `identity_id='AI-RAIL-LOGISTICS'`;
- `record_type='FUNCTIONAL_CONCLUSION'`;
- `status='APPROVED'`;
- exact evidence target;
- payload contract `RAIL_XLSX_RAIL_LOGISTICS_AUTHORITY_V1`;
- payload must match evidence ID, resulting status, Deal and rail document.

`service_role` and `SYSTEM_ADMIN` are technical executors only. They are not accepted as independent business-authority values.

The immutable evidence row is not modified by a later `TO_VERIFY -> MATCHED` decision.

## 7. Correction / supersession

Correction table:
`portal_private.rail_xlsx_correction_decisions_v1`.

Allowed authorities:
- `OWNER_EXPLICIT_CORRECTION`;
- `RAIL_LOGISTICS_VERIFIED_EXPEDITOR_CORRECTION`.

`actor_ref` is mandatory and resolves to the same existing audited substrates:
- Owner correction -> immutable `audit_events`;
- Rail correction -> immutable approved `RAIL_LOGISTICS` coordination record.

A correction is legal only when:

- old and new evidence IDs are different;
- wagon number is identical;
- effective Deal is resolved and identical;
- effective rail document / GU-12 is resolved and identical;
- old evidence has not already been superseded by an incompatible successor;
- new evidence has its own source provenance and canonical row locator;
- authority reference is valid;
- non-empty reason/evidence and provenance are supplied.

A correction does **not** require the same `event_identity_fingerprint` or the same `source_time_domain`. The correction may be correcting time/domain itself.

Deal/GU-12 rebinding through correction is forbidden. Rebinding belongs to the resolution-decision layer.

A new file is never automatically considered a correction.

## 8. Latest candidates vs one business-current position

Candidate/audit layers remain:

- `rail_xlsx_dislocation_latest_state_v1`;
- `rail_xlsx_dislocation_latest_trusted_v1`.

B1.5 narrows **business-current eligibility** to the TRUSTED subset only.

`portal_private.rail_xlsx_dislocation_current_position_v1`
is built from active rows of `rail_xlsx_dislocation_latest_trusted_v1`, not from every latest observation.

The business rule is:

- exactly one TRUSTED comparison domain for an effective Deal + wagon -> that TRUSTED observation remains current;
- two or more TRUSTED incomparable comparison domains -> `CROSS_DOMAIN_AMBIGUOUS`;
- zero TRUSTED observations -> no trusted business-current row;
- TO_VERIFY / UNRESOLVED / CONFLICT observations never participate in business-current selection.

Therefore a pending observation in another domain cannot nullify an existing single TRUSTED current.

For `CROSS_DOMAIN_AMBIGUOUS`:
- current station = NULL;
- current station code = NULL;
- current operation = NULL;
- current event/document provenance = NULL;
- wagon is excluded from `positionGroups[]`;
- wagon is excluded from `rail_wagons` projection.

Even identical station/operation values in two different TRUSTED incomparable domains remain ambiguous.

`portal_private.rail_xlsx_dislocation_current_audit_v1`
is intentionally broader than current selection. It is built from all active rows of `rail_xlsx_dislocation_latest_state_v1` and retains every observation that is not the selected current event.

This means audit/details retains:
- all candidates for CROSS_DOMAIN_AMBIGUOUS wagons;
- TO_VERIFY / UNRESOLVED / CONFLICT observations alongside a TRUSTED current;
- all observations when no TRUSTED current exists;
- non-selected TRUSTED candidates within the one comparable trusted domain.

Pending evidence is never hidden merely because a trusted current exists.

## 9. rail_wagons

`rail_wagons` remains a current projection, never history.

B1.3 does not create missing `rail_wagons` rows because the current production `status` column does not safely separate technical registration lifecycle from railway operational status.

Projection refresh consumes only:

`rail_xlsx_dislocation_current_position_v1`

with:
- `position_status='TRUSTED'`;
- `comparison_domain_count=1`.

Cross-domain ambiguity therefore cannot update the current projection.

Source provenance fields are separated:
- `position_source_system='RAIL_AI'`;
- `position_source_policy='EXPEDITOR_XLSX_VIA_RAIL_AI'`.

V0057 / P0005 remain raw operation codes only and are not mapped to `rail_wagons.status`.

## 10. Deal read model

RPC:
`public.rona_admin_rail_deal_read_model_v1`.

`wagonPositions[]` is driven by the single-current layer and therefore contains one row per Deal+wagon.

`positionAuditDetails[]` contains all non-current active candidates, including pending TO_VERIFY / UNRESOLVED / CONFLICT observations even when a TRUSTED current exists.

`positionGroups[]` contains trusted single-current wagons only.

Planned route remains independent from actual dislocation.

Coordinates remain NULL until a separate source-locked station directory supplies trusted GEO.

## 11. Reference XLSX

Reference SHA-256:

`bc7429db2fbc411cb43607c54f87b824d4c8ad928353914c6e94c935870d5cc5`.

Reference facts remain:

- 9 rows / 9 wagons;
- 4 × Анисовка `625501`;
- 5 × Могилев I `156505`;
- destination Киргили `742705`;
- sheet `дисл`;
- initial resolution `TO_VERIFY`;
- timezone unresolved;
- `parsed_event_at=NULL`;
- Анисовка raw time `1809260451` -> local wall-clock `2026-09-18 04:51`;
- Могилев I raw time `1709262012` -> local wall-clock `2026-09-17 20:12`;
- Deal candidate remains `DEAL-2026-004`;
- GU-12 candidate remains `1308903120`;
- V0057/P0005 are operation codes only.

The QA fixture uses synthetic 8-digit `99xxxxxx` wagon identifiers solely to test schema semantics. They are not production business facts.

## 12. Production gate

No production migration/write is authorized.

Required next gates:

1. System Administrator B1.5 source review.
2. Rail AI narrow re-review of the TRUSTED current-eligibility delta.
3. Non-production PostgreSQL migration rehearsal.
4. Actual reference XLSX dry-run through the real importer mapping.
5. Security/RLS/regression review.
6. Separate merge/apply authorization.

PR #648 remains open.
#644 remains open.
