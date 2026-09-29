#!/usr/bin/env python3
"""Build deterministic SQL that materializes the exact Stage D.1 canonical document assets.

This script never connects to production. It reads source-locked local files, verifies their
hashes, extracts the canonical signature/seal bytes, verifies the already-rendered canonical
letterhead PNG, and emits one SQL payload. Applying that SQL is a separate Owner-gated write.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import struct
import sys
import zipfile
from pathlib import Path

ASSET_DOCX_SHA = "8418f9d1b1d8b81937ac25b5f771c3494ec92c72cd97da6aa86191f6c2e2676d"
LETTERHEAD_DOCX_SHA = "dc7f591881b829b3888df96ad01167a4cfc056865850b140113bdf8aa53994ca"
SIGNATURE_SHA = "7479526756c5d39b64ea7223d707ca20984cd8ea2cd1f9fadbf2e6df93b3d085"
SEAL_SHA = "0d6f641853949f961eb79859b123fd48df41e84493cca121200254d673e6ca2b"
LETTERHEAD_PNG_SHA = "fe663c16e65ce65827285d3990a7324b23fcc4ff7de797effaf0546a404a984b"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_exact(path: Path, expected: str) -> bytes:
    data = path.read_bytes()
    actual = sha256(data)
    if actual != expected:
        raise SystemExit(f"SOURCE_HASH_MISMATCH {path}: expected={expected} actual={actual}")
    return data


def png_size(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("LETTERHEAD_NOT_PNG")
    return struct.unpack(">II", data[16:24])


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def asset_sql(
    *,
    asset_key: str,
    version: int,
    asset_type: str,
    mime_type: str,
    content: bytes,
    width_px: int,
    height_px: int,
    physical_width_mm: str | None,
    physical_height_mm: str | None,
    source_ref: str,
    usage_rules_json: str,
) -> str:
    digest = sha256(content)
    b64 = base64.b64encode(content).decode("ascii")
    pwidth = physical_width_mm if physical_width_mm is not None else "null"
    pheight = physical_height_mm if physical_height_mm is not None else "null"
    return f"""
-- {asset_key} sha256={digest}
update portal_private.owner_canonical_document_assets
   set status='RETIRED',updated_at=clock_timestamp()
 where asset_key={sql_quote(asset_key)}
   and status='ACTIVE'
   and version<>{version};

insert into portal_private.owner_canonical_document_assets(
  asset_key,version,asset_type,status,mime_type,sha256,content,
  width_px,height_px,physical_width_mm,physical_height_mm,
  usage_rules,owner_approved_at,source_ref
) values(
  {sql_quote(asset_key)},{version},{sql_quote(asset_type)},'ACTIVE',{sql_quote(mime_type)},
  {sql_quote(digest)},decode({sql_quote(b64)},'base64'),
  {width_px},{height_px},{pwidth},{pheight},
  {sql_quote(usage_rules_json)}::jsonb,clock_timestamp(),{sql_quote(source_ref)}
)
on conflict(asset_key,version) do update
set asset_type=excluded.asset_type,
    status='ACTIVE',
    mime_type=excluded.mime_type,
    sha256=excluded.sha256,
    content=excluded.content,
    width_px=excluded.width_px,
    height_px=excluded.height_px,
    physical_width_mm=excluded.physical_width_mm,
    physical_height_mm=excluded.physical_height_mm,
    usage_rules=excluded.usage_rules,
    source_ref=excluded.source_ref,
    updated_at=clock_timestamp();

DO $asset_check$
DECLARE v_hash text;
BEGIN
  SELECT encode(extensions.digest(content,'sha256'),'hex')
    INTO v_hash
  FROM portal_private.owner_canonical_document_assets
  WHERE asset_key={sql_quote(asset_key)} AND version={version};
  IF v_hash IS DISTINCT FROM {sql_quote(digest)} THEN
    RAISE EXCEPTION 'CANONICAL_ASSET_BYTE_HASH_MISMATCH {asset_key}: %',v_hash;
  END IF;
END
$asset_check$;
""".strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--signature-seal-docx", required=True, type=Path)
    ap.add_argument("--letterhead-docx", required=True, type=Path)
    ap.add_argument("--letterhead-png", required=True, type=Path)
    ap.add_argument("--output-sql", required=True, type=Path)
    args = ap.parse_args()

    read_exact(args.signature_seal_docx, ASSET_DOCX_SHA)
    read_exact(args.letterhead_docx, LETTERHEAD_DOCX_SHA)
    letterhead = read_exact(args.letterhead_png, LETTERHEAD_PNG_SHA)
    if png_size(letterhead) != (1414, 2000):
        raise SystemExit(f"LETTERHEAD_DIMENSION_MISMATCH actual={png_size(letterhead)}")

    with zipfile.ZipFile(args.signature_seal_docx) as z:
        seal = z.read("word/media/image1.jpg")
        signature = z.read("word/media/image2.png")

    if sha256(seal) != SEAL_SHA:
        raise SystemExit("SEAL_HASH_MISMATCH")
    if sha256(signature) != SIGNATURE_SHA:
        raise SystemExit("SIGNATURE_HASH_MISMATCH")

    statements = [
        "begin;",
        asset_sql(
            asset_key="RONA-CANONICAL-SIGNATURE",
            version=1,
            asset_type="SIGNATURE",
            mime_type="image/png",
            content=signature,
            width_px=500,
            height_px=500,
            physical_width_mm=None,
            physical_height_mm=None,
            source_ref="PROJECT_FILE:file_00000000600481f48807658da7ee71ff|member=word/media/image2.png|sha256=" + SIGNATURE_SHA,
            usage_rules_json='{"canonical_only":true,"alternative_signatures_prohibited":true,"redraw_prohibited":true,"placement_each_page_ru":"Продавец","placement_each_page_en":"Supplier","main_signature_block_both_language_sides":true}',
        ),
        asset_sql(
            asset_key="RONA-CANONICAL-SEAL",
            version=1,
            asset_type="SEAL",
            mime_type="image/jpeg",
            content=seal,
            width_px=535,
            height_px=535,
            physical_width_mm="35",
            physical_height_mm="35",
            source_ref="PROJECT_FILE:file_00000000600481f48807658da7ee71ff|member=word/media/image1.jpg|sha256=" + SEAL_SHA,
            usage_rules_json='{"canonical_only":true,"alternative_seals_prohibited":true,"redraw_prohibited":true,"placement":"MAIN_SIGNATURE_SECTION_ONLY_NEXT_TO_SELLER_SIGNATURE","seal_on_each_page":false,"physical_width_mm":35,"physical_height_mm":35}',
        ),
        asset_sql(
            asset_key="RONA-CANONICAL-LETTERHEAD",
            version=1,
            asset_type="LETTERHEAD",
            mime_type="image/png",
            content=letterhead,
            width_px=1414,
            height_px=2000,
            physical_width_mm="210",
            physical_height_mm="297",
            source_ref="PROJECT_FILE:file_00000000b57c81f489a1cd0e61a55597|source_sha256=" + LETTERHEAD_DOCX_SHA + "|render_sha256=" + LETTERHEAD_PNG_SHA,
            usage_rules_json='{"canonical_only":true,"redraw_or_recreate_prohibited":true,"derivation":"DIRECT_PAGE_1_RENDER_LIBREOFFICE_25_2_3_2_NO_REDRAW","source_docx_sha256":"' + LETTERHEAD_DOCX_SHA + '"}',
        ),
        "select portal_private.owner_activate_document_standard_v2_v1();",
        "commit;",
    ]

    sql = "\n\n".join(statements) + "\n"
    args.output_sql.write_text(sql, encoding="utf-8")
    print(f"OUTPUT_SQL={args.output_sql}", file=sys.stderr)
    print(f"OUTPUT_SQL_SHA256={sha256(sql.encode('utf-8'))}", file=sys.stderr)
    print(f"SIGNATURE_SHA256={sha256(signature)}", file=sys.stderr)
    print(f"SEAL_SHA256={sha256(seal)}", file=sys.stderr)
    print(f"LETTERHEAD_SHA256={sha256(letterhead)}", file=sys.stderr)


if __name__ == "__main__":
    main()
