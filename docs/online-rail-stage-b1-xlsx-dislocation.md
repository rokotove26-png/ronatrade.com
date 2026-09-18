# Online Rail #644 — Stage B1 XLSX dislocation history + Deal read model

Status: **ARCHITECTURE CANDIDATE / NOT DEPLOYED / NOT MERGED**

Base: `release/public-go-live-v1.1@8be4acc7bd88d697c1b8a3396c1ef57f37cafd24`.

## Scope

Stage B1 adds a permanent design for wagon dislocation supplied as XLSX to the Rail AI Specialist.

It deliberately does **not**:
- reuse `portal_private.rail_movement_events` (MOVIZOR-only);
- create a second Deal registry;
- enable MOVIZOR, provider polling or Client publication;
- infer coordinates from station text;
- mutate Finance, Payments, Cash or Deal semantics;
- apply any production migration.

Stage A / A.1 contracts remain unchanged:
- `RAIL_MAP_VIEWPORT_STATE_V1`;
- Deal-owned selector;
- `DATA_CHANGE_ONLY`;
- `RAIL_MAP_DATA_CONTRACT_V1`;
- source policy `EXPEDITOR_XLSX_VIA_RAIL_AI`;
- single-owner Rail runtime.

## Existing production facts used by the design

Current source substrate:
- `portal_private.import_batches` — import batch identity and file-level checksum;
- `portal_private.source_objects` — immutable source object snapshot and checksum;
- `portal_private.rail_documents` — canonical GU-12/document relation to Deal;
- `portal_private.deals` — the existing canonical Deal registry;
- `portal_private.rail_wagons` — current projection;
- `portal_private.rail_movement_events` — preserved as MOVIZOR-specific history.

The live Admin bootstrap currently exposes rail wagon station/operation fields from `rail_wagons`. Stage B1 introduces a separate Admin read-model RPC rather than rewriting the existing bootstrap in this candidate.

## Write model

### `portal_private.rail_xlsx_dislocation_events_v1`

Append-only evidence row.

Source-lock fields:
- `import_batch_id`;
- `source_object_id`;
- `source_checksum_sha256`;
- `source_row_number`;
- `source_row_fingerprint`;
- `source_row` JSONB.

Normalized observation:
- `wagon_number`;
- canonical `deal_key` / immutable `deal_id_snapshot`;
- canonical `rail_document_key` / `rail_document_id_snapshot`;
- `gu12_number_snapshot`;
- `station_name`;
- `station_code`;
- `operation`;
- `raw_timestamp`;
- `parsed_event_at`;
- `source_timezone`;
- `source_timezone_status`;
- `resolution_status`;
- `resolution_evidence`;
- `provenance`;
- `semantic_fingerprint`;
- `event_identity_fingerprint`.

Allowed resolution states are exactly:
`MATCHED / TO_VERIFY / UNRESOLVED / CONFLICT`.

Allowed timezone states:
`EXPLICIT_OFFSET / SOURCE_DECLARED / UNKNOWN / INVALID`.

A parsed UTC timestamp is accepted only when source timezone is explicit or source-declared. Unknown timezone remains unparsed/fail-closed.

### Append-only guarantee

A trigger rejects UPDATE and DELETE with `RAIL_XLSX_DISLOCATION_APPEND_ONLY`.

History is never rewritten.

## Idempotency and conflict rules

### Same physical source row

Uniqueness: `(source_object_id, source_row_number)`.

Re-ingesting the same row with the same raw-row fingerprint and semantic fingerprint returns:
`IDEMPOTENT_REPLAY`.

If the same file row is later interpreted differently, ingest fails with:
`RAIL_XLSX_SOURCE_ROW_REINTERPRETATION_CONFLICT`.

### Same business fact across files

`semantic_fingerprint` is source-independent and derived from normalized:
- wagon;
- station code/name;
- operation;
- event-time identity.

This lets repeated evidence be recognized without collapsing provenance rows.

### Same wagon / same moment

`event_identity_fingerprint` is based on wagon + event-time identity.

If one identity has more than one distinct semantic fingerprint, effective state becomes `CONFLICT`.

No existing row is overwritten.

## Effective/latest views

### `rail_xlsx_dislocation_effective_v1`

Derives effective conflict/resolution status from immutable history.

### `rail_xlsx_dislocation_latest_state_v1`

Returns the newest comparable observation for each:
`Deal + rail document/GU-12 + wagon`.

Important fail-closed rule:
if the newest moment is CONFLICT / TO_VERIFY, the latest-state view remains in that state. It does not pretend the older trusted observation is the newest fact.

### `rail_xlsx_dislocation_latest_trusted_v1`

Returns the latest **trusted** observation only.

This view is the only XLSX source allowed to refresh `rail_wagons`.

## `rail_wagons` integration

`rail_wagons` remains a current projection, not a history table.

Stage B1 adds position provenance only:
- `position_source_system`;
- `position_source_event_id`;
- `position_source_object_id`;
- `position_semantic_fingerprint`;
- `position_resolution_status`.

`rail_xlsx_refresh_wagon_projection_v1()`:
- creates a wagon only when the XLSX row is canonically MATCHED to existing Deal + rail document;
- updates only position fields;
- reads only `latest_trusted_v1`;
- never clears or overwrites the current trusted position because a newer untrusted/conflicting observation arrived;
- never overwrites a position owned by another source.

The newest untrusted/conflicting observation remains visible through the read model, independently of the trusted current projection.

## Deal-owned Admin read model

RPC:
`public.rona_admin_rail_deal_read_model_v1(p_deal_id text default null)`.

Authorization:
existing `portal_private.owner_r1_actor('ADMIN')` gate.

Hierarchy:
`Deal -> rail documents / GU-12 -> wagon inventory -> current trusted projection + newest XLSX observation`.

No new Deal identifier is created.

Response root:
- `modelVersion = RONA_ADMIN_RAIL_DEAL_READ_MODEL_V1`;
- `selectionOwner = DEAL`;
- `selectionKey = deal_key`;
- `sourcePolicy = EXPEDITOR_XLSX_VIA_RAIL_AI`;
- `deals[]`.

Each Deal contains:
- `railDocuments[]`;
- `plannedRoute[]`;
- `wagonPositions[]`;
- `positionGroups[]`;
- unresolved/conflict count.

## plannedRoute[] contract

Planned route and actual dislocation remain independent.

B1 does not geocode `route_text`.

For each rail document the read model returns:
- document / GU-12 relation;
- source route text;
- `points: []`;
- `geometry: null`;
- status `TEXT_ONLY_NOT_GEOCODED` or `SOURCE_NOT_AVAILABLE`;
- source provenance.

A later source-locked route/station-directory layer may populate trusted geometry. B1 does not.

## wagonPositions[] contract

Fields:
- `wagonNumber`;
- `railDocumentKey`;
- `railDocumentId`;
- `gu12Number`;
- `station`;
- `stationCode`;
- `operation`;
- `eventTimestamp` — newest comparable XLSX observation timestamp;
- `latestTrustedEventTimestamp`;
- `positionStatus` — TRUSTED / TO_VERIFY / UNRESOLVED / CONFLICT;
- `latestObservationEventId`;
- `latestObservationVariantCount`;
- `trustedCoordinates: null`;
- `coordinateProvenance: null`;
- source provenance for the trusted projected position.

When newest XLSX state is not TRUSTED, station/code/operation in the public read model fail closed to null even if `rail_wagons` retains an older trusted projection internally.

## positionGroups[] / map clustering contract

Grouping key:
1. `ESR:<station_code>` when authoritative code exists;
2. otherwise normalized `STATION:<station_name>`.

Only newest TRUSTED positions participate in a station group.

One group contains:
- `clusterKey`;
- station;
- station code;
- `wagonCount`;
- `wagonNumbers[]`;
- latest event timestamp;
- `trustedCoordinates: null`;
- `coordinateProvenance: null`.

UI may render one point/cluster only when a separate source-locked station directory provides trusted coordinates. Multiple wagons at the same station then share that point and expand to the list of wagon numbers.

## Coordinate policy

No coordinates are created from:
- station name;
- route text;
- browser geocoding;
- inferred route geometry.

B1 intentionally returns coordinates as null.

A future station directory must have independent source-lock and provenance. Its coordinates must be joined without altering the XLSX station fact.

## Production gate

This migration is a repository candidate only.

Before production use:
1. System Administrator architecture acceptance.
2. Rail AI importer mapping review against this schema.
3. First XLSX dry-run with no authoritative write.
4. SQL migration rehearsal in a non-production environment.
5. Security/RLS and regression gates.
6. Separate authorization to apply migration.
