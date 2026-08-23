#!/usr/bin/env python3
"""RONA Trade Telegram market collector.

Read-only MTProto collector for market-source documents. It never sends Telegram
messages, never joins channels automatically, and never prints API credentials or
session material. Original binaries are uploaded to a private Supabase bucket via
an OIDC-authorized signed-upload flow; extracted text/tables are finalized only
after the server re-verifies SHA-256 and file size.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import pathlib
import tempfile
import traceback
from dataclasses import dataclass
from datetime import timezone
from typing import Any

import requests
from pypdf import PdfReader
import pdfplumber
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.types import DocumentAttributeFilename

DEFAULT_CHANNELS = "platts_digits,Samantahlil"
DEFAULT_LIMIT = 80
MAX_TEXT_CHARS = 1_000_000
MAX_TABLES = 180
MAX_TABLE_ROWS = 120
MAX_TABLE_COLS = 30
MAX_CELL_CHARS = 800
REQUEST_TIMEOUT = 90
UPLOAD_TIMEOUT = 240


@dataclass
class Counters:
    scanned_messages: int = 0
    accepted_files: int = 0
    duplicate_files: int = 0
    failed_files: int = 0


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name}_MISSING")
    return value


def post_json(base_url: str, oidc: str, route: str, payload: dict[str, Any]) -> dict[str, Any]:
    response = requests.post(
        f"{base_url.rstrip('/')}/{route.lstrip('/')}",
        headers={"Authorization": f"Bearer {oidc}", "Content-Type": "application/json"},
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        timeout=REQUEST_TIMEOUT,
    )
    try:
        data = response.json()
    except Exception as exc:
        raise RuntimeError(f"INGEST_INVALID_JSON_HTTP_{response.status_code}") from exc
    if not response.ok or data.get("ok") is not True:
        raise RuntimeError(str(data.get("code") or f"INGEST_HTTP_{response.status_code}"))
    return data


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_cell(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text[:MAX_CELL_CHARS] if text else None


def extract_pdf(path: pathlib.Path) -> tuple[str | None, list[dict[str, Any]], str, str | None]:
    """Extract embedded text and table structure without OCR."""
    text_parts: list[str] = []
    tables: list[dict[str, Any]] = []
    note_parts: list[str] = []
    try:
        reader = PdfReader(str(path), strict=False)
        for index, page in enumerate(reader.pages):
            if sum(len(x) for x in text_parts) >= MAX_TEXT_CHARS:
                note_parts.append("TEXT_TRUNCATED_AT_1M_CHARS")
                break
            try:
                value = page.extract_text() or ""
            except Exception:
                value = ""
            value = value.strip()
            if value:
                remaining = MAX_TEXT_CHARS - sum(len(x) for x in text_parts)
                text_parts.append(f"\n--- PAGE {index + 1} ---\n{value[:remaining]}")
    except Exception as exc:
        note_parts.append(f"PYPDF:{type(exc).__name__}")

    try:
        with pdfplumber.open(str(path)) as pdf:
            for page_index, page in enumerate(pdf.pages):
                if len(tables) >= MAX_TABLES:
                    note_parts.append("TABLES_TRUNCATED")
                    break
                try:
                    page_tables = page.extract_tables() or []
                except Exception:
                    page_tables = []
                for table_index, table in enumerate(page_tables):
                    if len(tables) >= MAX_TABLES:
                        break
                    normalized = []
                    for row in (table or [])[:MAX_TABLE_ROWS]:
                        normalized.append([safe_cell(v) for v in (row or [])[:MAX_TABLE_COLS]])
                    if normalized:
                        tables.append({
                            "page": page_index + 1,
                            "table_index": table_index + 1,
                            "rows": normalized,
                        })
    except Exception as exc:
        note_parts.append(f"PDFPLUMBER:{type(exc).__name__}")

    text = "".join(text_parts).strip() or None
    if text and tables:
        state = "TEXT_AND_TABLES_EXTRACTED"
    elif text:
        state = "TEXT_EXTRACTED"
    elif tables:
        state = "TEXT_AND_TABLES_EXTRACTED"
    else:
        state = "BINARY_ONLY"
    return text, tables, state, ";".join(note_parts) or None


def document_filename(message: Any) -> str | None:
    doc = getattr(message, "document", None)
    if not doc:
        return None
    for attr in getattr(doc, "attributes", []) or []:
        if isinstance(attr, DocumentAttributeFilename) and attr.file_name:
            return str(attr.file_name)
    return None


def normalize_mime(filename: str, document_mime: str | None, is_photo: bool) -> str | None:
    if is_photo:
        return "image/jpeg"
    mime = (document_mime or "").lower().strip()
    ext = pathlib.Path(filename).suffix.lower()
    if mime == "application/pdf" or ext == ".pdf":
        return "application/pdf"
    if mime in {"image/jpeg", "image/png", "image/webp"}:
        return mime
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return None


def upload_signed(url: str, path: pathlib.Path, mime: str) -> None:
    with path.open("rb") as fh:
        response = requests.put(
            url,
            data=fh,
            headers={
                "Content-Type": mime,
                "Cache-Control": "max-age=3600",
                "x-upsert": "false",
            },
            timeout=UPLOAD_TIMEOUT,
        )
    # A deterministic object can remain after a prior upload whose finalize step
    # failed. In that case 409 is safe: finalize will download and verify bytes.
    if not response.ok and response.status_code != 409:
        raise RuntimeError(f"SIGNED_UPLOAD_HTTP_{response.status_code}")


async def collect() -> int:
    api_id = int(required_env("TELEGRAM_API_ID"))
    api_hash = required_env("TELEGRAM_API_HASH")
    session_value = required_env("TELEGRAM_SESSION")
    ingest_url = required_env("RONA_TELEGRAM_INGEST_URL")
    oidc = required_env("RONA_INGEST_OIDC_TOKEN")
    run_key = required_env("RONA_TELEGRAM_RUN_KEY")
    channels = [x.strip().lstrip("@") for x in os.environ.get("TELEGRAM_CHANNELS", DEFAULT_CHANNELS).split(",") if x.strip()]
    limit = max(1, min(300, int(os.environ.get("TELEGRAM_MAX_MESSAGES", str(DEFAULT_LIMIT)))))
    counters = Counters()
    per_channel_errors: list[str] = []

    post_json(ingest_url, oidc, "run-status", {
        "run_key": run_key,
        "status": "STARTED",
        "channels": channels,
    })

    client = TelegramClient(StringSession(session_value), api_id, api_hash, auto_reconnect=False, request_retries=2)
    await client.connect()
    try:
        if not await client.is_user_authorized():
            post_json(ingest_url, oidc, "run-status", {
                "run_key": run_key,
                "status": "BLOCKED",
                "channels": channels,
                "error_code": "TELEGRAM_SESSION_NOT_AUTHORIZED",
            })
            raise RuntimeError("TELEGRAM_SESSION_NOT_AUTHORIZED")

        with tempfile.TemporaryDirectory(prefix="rona-telegram-") as tmp:
            temp_root = pathlib.Path(tmp)
            for channel in channels:
                try:
                    entity = await client.get_entity(channel)
                    async for message in client.iter_messages(entity, limit=limit):
                        counters.scanned_messages += 1
                        doc = getattr(message, "document", None)
                        photo = getattr(message, "photo", None)
                        if not doc and not photo:
                            continue

                        filename = document_filename(message)
                        if not filename:
                            filename = f"telegram-{channel}-{message.id}.jpg" if photo else f"telegram-{channel}-{message.id}.bin"
                        mime = normalize_mime(filename, getattr(doc, "mime_type", None), bool(photo))
                        if not mime:
                            continue

                        suffix = pathlib.Path(filename).suffix or (".pdf" if mime == "application/pdf" else ".jpg")
                        local_path = temp_root / f"{channel}-{message.id}{suffix}"
                        downloaded = await client.download_media(message, file=str(local_path))
                        if not downloaded or not local_path.exists():
                            counters.failed_files += 1
                            continue

                        size = local_path.stat().st_size
                        if size <= 0 or size > 64 * 1024 * 1024:
                            counters.failed_files += 1
                            continue
                        digest = sha256_file(local_path)
                        msg_dt = message.date
                        if msg_dt.tzinfo is None:
                            msg_dt = msg_dt.replace(tzinfo=timezone.utc)
                        caption = (message.message or "").strip() or None
                        base_meta = {
                            "channel": channel,
                            "message_id": int(message.id),
                            "message_timestamp": msg_dt.astimezone(timezone.utc).isoformat(),
                            "source_url": f"https://t.me/{channel}/{message.id}",
                            "telegram_caption": caption,
                            "file_name": filename,
                            "file_size": size,
                            "mime_type": mime,
                            "sha256": digest,
                        }

                        try:
                            prepared = post_json(ingest_url, oidc, "prepare", base_meta)
                            if prepared.get("upload_required"):
                                upload_signed(str(prepared["signed_upload_url"]), local_path, mime)
                            else:
                                counters.duplicate_files += 1

                            if mime == "application/pdf":
                                extracted_text, extracted_tables, extraction_state, extraction_note = extract_pdf(local_path)
                            else:
                                extracted_text, extracted_tables, extraction_state, extraction_note = None, [], "BINARY_ONLY", "OCR_NOT_USED"

                            final_payload = {
                                **base_meta,
                                "storage_path": prepared["storage_path"],
                                "extracted_text": extracted_text,
                                "extracted_tables": extracted_tables,
                                "extraction_state": extraction_state,
                                "extraction_note": extraction_note,
                            }
                            result = post_json(ingest_url, oidc, "finalize", final_payload)
                            counters.accepted_files += 1
                            print(json.dumps({
                                "event": "INGESTED",
                                "channel": channel,
                                "message_id": int(message.id),
                                "file_name": filename,
                                "sha256": digest,
                                "document_id": result.get("document_id"),
                                "extraction_state": extraction_state,
                            }, ensure_ascii=False))
                        except Exception as exc:
                            counters.failed_files += 1
                            print(json.dumps({
                                "event": "FILE_FAILED",
                                "channel": channel,
                                "message_id": int(message.id),
                                "file_name": filename,
                                "sha256": digest,
                                "error": type(exc).__name__,
                                "code": str(exc)[:160],
                            }, ensure_ascii=False))
                except Exception as exc:
                    per_channel_errors.append(f"{channel}:{type(exc).__name__}")
                    print(json.dumps({"event": "CHANNEL_FAILED", "channel": channel, "error": type(exc).__name__}, ensure_ascii=False))
    finally:
        await client.disconnect()

    if per_channel_errors and counters.accepted_files == 0:
        status = "FAILED"
    elif per_channel_errors or counters.failed_files:
        status = "PARTIAL"
    else:
        status = "SUCCESS"
    post_json(ingest_url, oidc, "run-status", {
        "run_key": run_key,
        "status": status,
        "channels": channels,
        "scanned_messages": counters.scanned_messages,
        "accepted_files": counters.accepted_files,
        "duplicate_files": counters.duplicate_files,
        "failed_files": counters.failed_files,
        "error_code": ";".join(per_channel_errors)[:200] if per_channel_errors else None,
    })
    print(json.dumps({"event": "RUN_COMPLETE", "status": status, **counters.__dict__}, ensure_ascii=False))
    return 0 if status in {"SUCCESS", "PARTIAL"} else 2


def main() -> None:
    try:
        code = asyncio.run(collect())
    except Exception as exc:
        # Deliberately do not dump environment/session data or Telethon internals.
        print(json.dumps({"event": "RUN_FATAL", "error": type(exc).__name__, "code": str(exc)[:200]}, ensure_ascii=False))
        code = 2
    raise SystemExit(code)


if __name__ == "__main__":
    main()
