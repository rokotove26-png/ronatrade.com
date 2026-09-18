# Online Rail #644 — Stage B1.1 XLSX dislocation architecture

Status: **ARCHITECTURE CANDIDATE / NOT MERGED / NOT DEPLOYED / MIGRATION NOT APPLIED**

Base release remains:
`release/public-go-live-v1.1@8be4acc7bd88d697c1b8a3396c1ef57f37cafd24`.

PR:
`#648`.

## Preserved contracts

B1.1 does not change Stage A/A.1 runtime.

Preserved:
- `RAIL_MAP_VIEWPORT_STATE_V1`;
- Deal-owned selector;
- `DATA_CHANGE_ONLY`;
- `RAIL_MAP_DATA_CONTRACT_V1`;
- source policy `EXPEDITOR_XLSX_VIA_RAIL_AI`;
- single-owner Rail;
- MOVIZOR isolation;
- no fabricated coordinates;
- no Finance / Payments / Cash / Deals semantic change.

`portal_private.rail_movement_events` remains MOVIZOR-only and is not reused for XLSX.

## 1. Immutable XLSX evidence

Table:
`portal_private.rail_xlsx_dislocation_events_v1`.

Each evidence row keeps:
- import batch;
- source object/file;
- file checksum;
- raw source row;
- source row fingerprint;
- wagon number;
- canonical Deal/document relation if known;
- station name / ESR code;
- operation;
- raw timestamp;
- parsed local wall-clock;
- UTC timestamp only when timezone is actually known;
- source timezone state;
- source time-domain;
- verified source policy/system/type/version/contract snapshots;
- provenance;
- semantic and event-identity fingerprints.

UPDATE and DELETE are blocked.

Direct table INSERT by `service_role` is revoked.
Evidence can be inserted only through:
`portal_private.rail_xlsx_dislocation_ingest_v1(...)`.

## 2. Local railway time / unresolved timezone

New field:
`event_at_local timestamp without time zone`.

`raw_timestamp` is always retained.

If timezone is absent:
- `source_timezone_status='UNRESOLVED'`;
- `event_at_local` contains the parsed local wall-clock;
- `parsed_event_at` MUST remain NULL;
- no UTC/timestamptz value is fabricated.

Unresolved local events are comparable only inside the same exact:
`source_time_domain`.

There is deliberately no cross-domain ordering for unresolved local time.

If timezone later becomes authoritative, that does not rewrite evidence. A new source/evidence or later architecture step may carry resolved UTC with its own provenance.

## 3. Verified XLSX source policy

The read model may label data:
`EXPEDITOR_XLSX_VIA_RAIL_AI`
only because ingest verifies the canonical source object contract.

Required source object metadata:
- `source_system='RAIL_AI'`;
- `source_object_type='XLSX_WAGON_DISLOCATION'`;
- `source_version='RAIL_XLSX_DISLOCATION_V1'`;
- `raw_snapshot.sourcePolicy='EXPEDITOR_XLSX_VIA_RAIL_AI'`;
- `raw_snapshot.sourceContractVersion='RAIL_XLSX_DISLOCATION_CONTRACT_V1'`;
- non-empty `raw_snapshot.sourceTimeDomain`;
- valid SHA-256 checksum;
- canonical source receipt timestamp from `source_objects.source_timestamp`, falling back only to `import_batches.source_timestamp`.

Mismatch fails closed with:
`RAIL_XLSX_SOURCE_POLICY_CONTRACT_MISMATCH`.

## 4. Append-only resolution decisions

Evidence resolution is immutable.

Table:
`portal_private.rail_xlsx_resolution_decisions_v1`.

A decision records:
- evidence event ID;
- resulting status;
- canonical Deal binding;
- canonical rail document / GU-12 binding;
- actor source;
- actor reference;
- decided_at;
- reason/evidence;
- provenance;
- decision fingerprint.

Legal transition example:
original evidence remains `TO_VERIFY`;
an owner/Rail-AI confirmation appends a decision with `resulting_status='MATCHED'`.

Effective state is derived from evidence + latest valid decision.
The original XLSX row is never modified.

## 5. Explicit correction / supersession

Table:
`portal_private.rail_xlsx_correction_decisions_v1`.

A correction decision records:
- new correction evidence event;
- `correction_of_event_id`;
- relation `CORRECTION_OF` or `SUPERSEDES`;
- actor/source;
- decided_at;
- reason/evidence;
- provenance.

A new file or differing later row is **never automatically treated as a correction**.

Old evidence remains immutable.
Effective/latest views exclude explicitly superseded evidence only after an append-only correction decision exists.

## 6. Conflict rules

Same source object + same row:
- identical raw/semantic fingerprints => `IDEMPOTENT_REPLAY`;
- different interpretation => `RAIL_XLSX_SOURCE_ROW_REINTERPRETATION_CONFLICT`.

Same wagon + same event-time identity with different active semantic facts:
effective state = `CONFLICT`.

A confirmed explicit correction may supersede old evidence; until then the conflict remains fail closed.

## 7. Latest-state vs latest-trusted

`rail_xlsx_dislocation_latest_state_v1`:
- includes timezone-unresolved evidence;
- orders unresolved local time only within the exact source time-domain;
- exposes TO_VERIFY / UNRESOLVED / CONFLICT;
- supports the reference XLSX before timezone resolution.

`rail_xlsx_dislocation_latest_trusted_v1`:
- only effective `MATCHED` / trusted evidence;
- still remains scoped to a comparison domain;
- does not fabricate UTC for unresolved local time.

## 8. rail_wagons integration

`rail_wagons` stays a current projection and not a history table.

B1.1 adds position provenance fields including:
- position source system/event/object;
- semantic fingerprint;
- position resolution;
- local event time;
- source time-domain;
- timezone status.

Critical correction:
`rail_wagons.source_timestamp` is populated from canonical source-file receipt timestamp
(`source_objects.source_timestamp`, fallback `import_batches.source_timestamp`),
NOT from railway event time.

Railway event time remains in:
- `operation_at` / `last_position_at` only when UTC is actually known;
- `position_event_at_local` when only local wall-clock is known.

### rail_wagons.status safety

The current production constraint allows:
`REGISTERED, LOADED, IN_TRANSIT, DELAYED, DETACHED, ARRIVED, UNLOADED, EMPTY_RETURN, CLOSED`.

There is no separate production column proving that `REGISTERED` is purely a technical registration lifecycle distinct from railway operational status.

Therefore B1.1 **does not create new rail_wagons rows**.

`rail_xlsx_refresh_wagon_projection_v1()` updates an existing compatible wagon row only.
Missing canonical wagon rows are reported as:
`missingWagonRowsNotCreated`.

This avoids presenting `REGISTERED` as inferred operational railway state.

## 9. Deal read model

RPC:
`public.rona_admin_rail_deal_read_model_v1`.

Authorization:
existing `portal_private.owner_r1_actor('ADMIN')`.

Hierarchy:
`Deal -> rail documents / GU-12 -> XLSX latest-state / latest-trusted`.

The read model does not require a `rail_wagons` row in order to expose XLSX evidence.

This is required for the initial reference XLSX where the canonical Deal relation is still TO_VERIFY.

### plannedRoute[]

Independent from actual dislocation.

B1.1 does not geocode route text.
It returns:
- source route text;
- source document relation;
- `points=[]`;
- `geometry=null`;
- source provenance.

### wagonPositions[]

Includes:
- wagon number;
- rail document / GU-12;
- station;
- station code / ESR;
- operation;
- `eventTimestamp` (nullable UTC);
- `eventAtLocal`;
- raw timestamp;
- timezone / timezone status;
- source time-domain;
- comparison domain;
- position status;
- effective resolution status;
- resolution decision;
- trusted coordinates = null;
- source provenance.

Therefore the reference XLSX remains visible in `wagonPositions[]` before timezone is resolved.

## 10. Grouping contract

Trusted rows group by:
1. `ESR:<station_code>`;
2. otherwise normalized `STATION:<station_name>`.

Group contains:
- cluster key;
- station;
- station code;
- wagon count;
- wagon numbers;
- UTC timestamp when available;
- local wall-clock;
- source time-domains;
- coordinates null.

A visible map point may appear only after an independent source-locked station directory supplies trusted coordinates.

## 11. Reference XLSX architecture dry-run

Required reference case:
- 9 rows / 9 wagons;
- 4 rows: Анисовка `625501`;
- 5 rows: Могилев I `156505`;
- timezone absent;
- canonical business context: `DEAL-2026-004`;
- initial resolution: `TO_VERIFY`.

The deterministic QA fixture uses explicit `QA-REF-WAGON-...` identifiers rather than inventing production wagon numbers.

Dry-run proves:
- all 9 rows retain local wall-clock;
- all 9 have NULL UTC;
- all 9 remain queryable in latest/read model inside one source time-domain;
- an append-only owner/Rail-AI resolution decision can overlay one or more evidence rows from `TO_VERIFY` to effective `MATCHED`;
- evidence itself stays unchanged;
- a later differing row is not correction until explicit correction/supersession decision is appended.

Reference canonical relation verified read-only:
- Deal: `DEAL-2026-004`;
- GU-12: `1308903120`;
- rail document: `RONA-S002-IN-2026-002`.

## 12. Production gate

Migration is repository-only.

Before any production apply:
1. System Administrator B1.1 architecture acceptance.
2. Rail AI field-by-field mapping review.
3. Non-production PostgreSQL migration rehearsal.
4. Reference XLSX dry-run against the actual importer mapping.
5. RLS/security and regression checks.
6. Separate authorization to merge/apply.

#644 remains OPEN.
