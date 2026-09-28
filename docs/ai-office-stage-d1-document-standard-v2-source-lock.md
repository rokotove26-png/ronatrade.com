# RONA AI Office — Stage D.1 Document Standard V2 Source Lock

Date: 2026-09-29  
Mode: CURRENT_STATE_FIRST -> PRODUCTION_CURRENT -> SOURCE_LOCK -> DELTA_ONLY  
Production write status: **NOT EXECUTED — separate Owner write approval required**

## Scope

Prepare the deterministic, fail-closed production materialization path for `RONA-DOC-STANDARD v2` and the three canonical document assets: signature, seal and letterhead. This stage does not create business facts, does not expand authority and does not silently replace any asset.

## Current production baseline

`RONA-DOC-STANDARD` version 1 is production-active. Its current rules use Arial Narrow 12 pt, justified body text, canonical signature hash `7479526756c5d39b64ea7223d707ca20984cd8ea2cd1f9fadbf2e6df93b3d085` and canonical seal hash `0d6f641853949f961eb79859b123fd48df41e84493cca121200254d673e6ca2b`, with the seal at 35 x 35 mm. The canonical asset table is empty before Stage D.1 materialization.

## Source-locked assets

### Signature and seal source

Project file: `Канонические подпись и печать.docx`  
Project file id: `file_00000000600481f48807658da7ee71ff`  
Whole-file SHA-256: `8418f9d1b1d8b81937ac25b5f771c3494ec92c72cd97da6aa86191f6c2e2676d`

- Seal: exact ZIP member `word/media/image1.jpg`, 535 x 535 px, SHA-256 `0d6f641853949f961eb79859b123fd48df41e84493cca121200254d673e6ca2b`.
- Signature: exact ZIP member `word/media/image2.png`, 500 x 500 px, SHA-256 `7479526756c5d39b64ea7223d707ca20984cd8ea2cd1f9fadbf2e6df93b3d085`.
- No extraction transform, redraw, recolor or substitute is permitted.

### Letterhead source

Project file: `Фирменный бланк(1).docx`  
Project file id: `file_00000000b57c81f489a1cd0e61a55597`  
Whole-file SHA-256: `dc7f591881b829b3888df96ad01167a4cfc056865850b140113bdf8aa53994ca`

Canonical blank A4 letterhead is materialized as a direct page-1 render, without redraw or reconstruction, using LibreOffice `25.2.3.2` through the project DOCX rendering workflow. Rendered PNG: 1414 x 2000 px, SHA-256 `fe663c16e65ce65827285d3990a7324b23fcc4ff7de797effaf0546a404a984b`.

## V2 layout contract

The Stage D.1 activation function materializes `RONA-DOC-STANDARD v2.0` only after all three exact asset byte hashes pass preflight. V2 records:

- Arial Narrow, 12.5 pt;
- body alignment `JUSTIFY`;
- first-line indent required, while the numeric value remains document-profile controlled rather than invented;
- controlled paragraph and heading-to-text spacing;
- centered section titles;
- English-style corporate layout;
- canonical letterhead only;
- canonical signature only;
- canonical seal only, 35 x 35 mm in the main signature section next to the seller signature;
- alternative, extracted-from-other-files, redrawn or silently substituted assets prohibited.

## Activation model

The schema migration only installs the source manifest, V2 rules, fail-closed preflight and Owner-gated activation function. It does **not** activate V2 and does **not** insert arbitrary bytes.

Exact asset bytes are generated from the source-locked project files by `scripts/ai-office-stage-d1-materialize-document-assets.py`. The script verifies all source and member hashes and emits deterministic SQL containing the exact binary assets. Applying that generated SQL is the separate production write.

Rollback is non-destructive: V2 becomes `RETIRED`, V1 becomes `ACTIVE`, and the three Stage D.1 assets become `RETIRED` while their provenance remains available for audit.

## Source conflict handling

The 2026-08-27 consolidated order remains a draft / not-in-force source and is not promoted as authority. Stage D.1 uses current production state plus the explicit Owner target for V2; stale 12 pt or obsolete role wording from that draft is not imported into the new standard.
