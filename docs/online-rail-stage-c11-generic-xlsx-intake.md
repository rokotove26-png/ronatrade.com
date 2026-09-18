# ONLINE RAIL / #644 — Stage C1.1 Generic XLSX Source Intake

Status: repository candidate for System Administrator acceptance. No production migration, Edge Function deployment, PR merge, or production business-data write is authorized by this stage.

## 1. Purpose

C1.1 removes any runtime dependency on a particular workbook filename or worksheet name. The previously inspected reference workbook is retained only as a regression fixture. Production intake accepts the next XLSX attached by the owner to the Rail Logistics AI conversation without requiring a filename convention.

Canonical file identity is SHA-256 of the original workbook bytes. `file_name` is provenance metadata only. The immutable private object key is `rail/source/<sha256>/original.xlsx` in `rona-portal-private`.

Consequences:

- same workbook bytes under different filenames reuse one `source_object` and are registered as duplicate-file receipts;
- different workbook bytes under the same filename create different canonical sources;
- filename never participates in Deal/GU-12 matching;
- original workbook bytes are not committed to GitHub and are not included in QA artifacts.

## 2. Private storage gate

Fresh production inspection showed that `rona-portal-private` is private, has a 50 MiB file-size limit, and allows the official XLSX MIME type. `storage.objects` has RLS enabled. C1.1 therefore reuses the existing bucket and does not create a new storage domain.

The Rail intake tool writes with `upsert=false`. If the content-addressed key already exists, it re-downloads the private object and verifies SHA-256 and byte size before treating it as identical. Parse, preview, and guarded ingest re-download and verify the bytes again, so a storage-object mutation fails closed instead of silently changing source identity.

## 3. Source registry

Migration `20260919020000_rail_xlsx_source_intake_c11.sql` adds:

- one SHA-256 canonical identity constraint for Rail XLSX `source_objects`;
- append-only `rail_xlsx_source_receipts_v1` for each owner/chat receipt;
- `rail_xlsx_source_capture_register_v1(...)`, callable by `service_role` only through the controlled gateway.

The canonical `source_object` stores SHA, source policy/contract, time domain and private storage locator. Receipt provenance stores original filename, SHA, byte size, reported and canonical MIME, received time, private bucket/key, ChatGPT file reference, fixed Rail role/identity and audited request IDs.

No Deal, shipment, rail wagon, movement, GEO or other business fact is created by source capture.

## 4. Header-driven workbook discovery

The parser does not look for a worksheet named `дисл` or any other fixed sheet name. It scans worksheets and the first bounded header rows for exactly one header contract containing these mandatory normalized headers:

- `номер вагона`
- `код операции`
- `дата операции`
- `код станции совершения операции`
- `станция совершения операции`
- `код станции назначения вагона`
- `наименование станции назначения`

If no sheet matches, intake fails closed. If more than one sheet/header row matches, intake fails as ambiguous rather than selecting one heuristically.

For each data row, `RAIL_XLSX_SOURCE_ROW_V1` records the actual worksheet name and physical Excel row number, plus every header cell's raw type and raw value. Numeric zero is preserved as numeric zero. Eight-digit wagon validation does not reconstruct stripped leading zeros.

Local operation time may be parsed into `event_at_local`, but timezone remains `UNRESOLVED` and `parsed_event_at` remains null until a source-specific time authority exists.

Operation codes are kept RAW_ONLY. Station names/codes are not geocoded.

## 5. Controlled Rail AI interface

The Rail Logistics Pilot candidate exposes four tools only to the fixed `RAIL_LOGISTICS / AI-RAIL-LOGISTICS / rona-mcp-rail-logistics-pilot` context:

1. `rail_xlsx_source_capture` — receives the attached ChatGPT file object, downloads original bytes, computes SHA-256, stores private source, registers canonical source + receipt.
2. `rail_xlsx_parse` — verifies private bytes and builds header-discovered canonical source rows.
3. `rail_xlsx_import_preview` — resolves only exact authoritative wagon mappings and exact GU-12 mappings; filename is excluded from the matching contract.
4. `rail_xlsx_guarded_ingest` — re-verifies bytes, parse fingerprint and preview token and then calls the accepted B1.5 `rail_xlsx_dislocation_ingest_v1` for canonical rows.

The source-capture tool declares the top-level `workbook` argument as a ChatGPT file parameter. This is the attachment handoff needed for the owner workflow: attach XLSX to the Rail AI conversation, after which the AI can sequence capture → parse → preview → guarded ingest.

Guarded ingest does not call the `rail_wagons` projection, create Deals, infer business status from operation codes or create GEO.

## 6. Matching rules

Filename, worksheet name and chat filename are prohibited matching inputs.

Current automatic matching inputs are deliberately narrow:

- exact authoritative `wagon_number -> rail_wagons -> rail_document -> deal`;
- exact GU-12 from the workbook, when present, -> active `rail_documents.gu12_number -> deal`.

Zero match -> `TO_VERIFY`. One consistent exact scope -> `MATCHED`. Multiple or inconsistent exact scopes -> `CONFLICT`. Route/station/cargo similarity does not auto-bind a Deal.

## 7. Production gate

C1.1 is non-production. Before activation System Administrator must accept the migration, Edge Function tool surface, private-storage service-role use and production deployment plan. Until that acceptance:

- PR #648 remains open and unmerged;
- migration `20260919020000_rail_xlsx_source_intake_c11.sql` is not applied to production;
- `rona-mcp-gateway` is not deployed from this candidate;
- #644 remains open.