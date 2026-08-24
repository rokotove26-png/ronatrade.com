#!/usr/bin/env python3
"""Resilient credential-free Telegram market collector for RONA Trade.

Reads only Telegram's public web preview/search pages. It never logs in, joins a
channel, sends a message, or uses Telegram API credentials. When Telegram exposes
a directly downloadable PDF/image, the original bytes are ingested. When the
public preview exposes only document metadata/caption (the common case for PDF
attachments), a deterministic UTF-8 metadata snapshot is ingested instead and is
explicitly marked as metadata-only. No OCR is used and no client publication is
performed by this collector.
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import tempfile
import time
from typing import Any
from urllib.parse import quote

import requests

import telegram_public_market_ingest as base

DEFAULT_CHANNELS = "Samantahlil,platts_digits"
DEFAULT_LIMIT = 80
SEARCH_TERMS = {
    "samantahlil": ("Platts", "Marketscan", "Oilgram", "LPGaswire", "پلتز"),
    "platts_digits": ("Platts", "Marketscan", "Oilgram", "LPGaswire"),
}
PUBLIC_INGEST_SOURCE = "TELEGRAM_PUBLIC_PREVIEW"
PUBLIC_RUN_SOURCE = "GITHUB_ACTIONS_PUBLIC_PREVIEW"
SNAPSHOT_NOTE = "TELEGRAM_PUBLIC_PREVIEW_METADATA_ONLY;ORIGINAL_BINARY_UNAVAILABLE_WITHOUT_TELEGRAM_AUTH"
BINARY_NOTE = "TELEGRAM_PUBLIC_PREVIEW_BINARY_FETCHED"


def parse_preview_element(element: Any, channel: str, page_url: str) -> dict[str, Any] | None:
    message_id = base.parse_message_id(element.get("data-post", ""), channel)
    if message_id is None:
        return None
    timestamp = base.parse_timestamp(element)
    if not timestamp:
        return None

    doc_urls, doc_title = base.document_candidates(element, page_url)
    photos = base.photo_candidates(element, page_url)
    caption = base.caption_text(element)
    document_node = element.select_one(".tgme_widget_message_document_wrap")
    is_document = bool(document_node or doc_title)
    extra_node = element.select_one(".tgme_widget_message_document_extra")
    document_extra = extra_node.get_text(" ", strip=True)[:500] if extra_node else None

    if not (is_document or photos or caption):
        return None

    return {
        "message_id": message_id,
        "message_timestamp": timestamp,
        "caption": caption,
        "media_urls": doc_urls or photos,
        "file_name": doc_title,
        "document_extra": document_extra,
        "is_document": is_document,
        "has_photo": bool(photos),
    }


def collect_regular_preview(session: requests.Session, channel: str, limit: int) -> list[dict[str, Any]]:
    messages: dict[int, dict[str, Any]] = {}
    before: int | None = None
    previous_min: int | None = None

    for _ in range(base.MAX_PAGES_PER_CHANNEL):
        page_url = f"https://t.me/s/{channel}" if before is None else f"https://t.me/s/{channel}?before={before}"
        soup = base.BeautifulSoup(base.fetch_html(session, page_url), "lxml")
        page_ids: list[int] = []
        for element in soup.select(".tgme_widget_message[data-post]"):
            message_id = base.parse_message_id(element.get("data-post", ""), channel)
            if message_id is not None:
                page_ids.append(message_id)
            parsed = parse_preview_element(element, channel, page_url)
            if parsed is not None:
                messages[int(parsed["message_id"])] = parsed

        if len(messages) >= limit or not page_ids:
            break
        current_min = min(page_ids)
        if previous_min is not None and current_min >= previous_min:
            break
        previous_min = current_min
        before = current_min
        time.sleep(0.3)

    return list(messages.values())


def collect_search_preview(session: requests.Session, channel: str) -> list[dict[str, Any]]:
    messages: dict[int, dict[str, Any]] = {}
    terms = SEARCH_TERMS.get(channel.casefold(), ("Platts", "Marketscan", "Oilgram", "LPGaswire"))
    for term in terms:
        page_url = f"https://t.me/s/{channel}?q={quote(term, safe='')}"
        try:
            soup = base.BeautifulSoup(base.fetch_html(session, page_url), "lxml")
            found = 0
            for element in soup.select(".tgme_widget_message[data-post]"):
                parsed = parse_preview_element(element, channel, page_url)
                if parsed is None:
                    continue
                # Search pages are used mainly to surface report attachments that
                # may be outside the anonymous preview's current message window.
                if not parsed.get("is_document"):
                    continue
                messages[int(parsed["message_id"])] = parsed
                found += 1
            print(json.dumps({
                "event": "PUBLIC_SEARCH_PAGE",
                "channel": channel,
                "term": term,
                "documents": found,
            }, ensure_ascii=False))
        except Exception as exc:
            print(json.dumps({
                "event": "PUBLIC_SEARCH_DEGRADED",
                "channel": channel,
                "term": term,
                "error": type(exc).__name__,
                "code": str(exc)[:160],
            }, ensure_ascii=False))
    return list(messages.values())


def collect_public_messages(session: requests.Session, channel: str, limit: int) -> list[dict[str, Any]]:
    merged: dict[int, dict[str, Any]] = {}
    regular_error: Exception | None = None
    try:
        for item in collect_regular_preview(session, channel, limit):
            merged[int(item["message_id"])] = item
    except Exception as exc:
        regular_error = exc
        print(json.dumps({
            "event": "REGULAR_PREVIEW_DEGRADED",
            "channel": channel,
            "error": type(exc).__name__,
            "code": str(exc)[:160],
        }, ensure_ascii=False))

    for item in collect_search_preview(session, channel):
        merged[int(item["message_id"])] = item

    if not merged:
        if regular_error is not None:
            raise regular_error
        raise RuntimeError("PUBLIC_PREVIEW_AND_SEARCH_EMPTY")

    ranked = sorted(
        merged.values(),
        key=lambda item: (1 if item.get("is_document") else 0, int(item["message_id"])),
        reverse=True,
    )
    return ranked[:limit]


def safe_snapshot_stem(value: str | None, channel: str, message_id: int) -> str:
    raw = pathlib.Path((value or "").strip()).stem or f"telegram-{channel}-{message_id}"
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", raw).strip("-._")
    return (cleaned or f"telegram-{channel}-{message_id}")[:150]


def metadata_snapshot(channel: str, message: dict[str, Any], source_url: str) -> tuple[str, str]:
    message_id = int(message["message_id"])
    original_name = (message.get("file_name") or "").strip() or "NOT_EXPOSED_IN_PUBLIC_PREVIEW"
    original_extra = (message.get("document_extra") or "").strip() or "NOT_EXPOSED_IN_PUBLIC_PREVIEW"
    caption = (message.get("caption") or "").strip() or "[no visible caption]"
    availability = (
        "ORIGINAL_BINARY_UNAVAILABLE_WITHOUT_TELEGRAM_AUTH"
        if message.get("is_document")
        else "PUBLIC_POST_TEXT_SNAPSHOT"
    )
    text = "\n".join([
        "RONA Trade Telegram public-preview source snapshot",
        f"Channel: @{channel}",
        f"Message ID: {message_id}",
        f"Message timestamp: {message['message_timestamp']}",
        f"Source URL: {source_url}",
        f"Original document title: {original_name}",
        f"Original document metadata: {original_extra}",
        f"Binary availability: {availability}",
        "",
        "Visible Telegram text/caption:",
        caption,
        "",
        "Provenance: TELEGRAM_PUBLIC_PREVIEW",
    ])
    stem = safe_snapshot_stem(message.get("file_name"), channel, message_id)
    return f"{stem}.telegram-preview.txt", text


def join_note(*parts: str | None) -> str | None:
    values = [str(x).strip() for x in parts if x and str(x).strip()]
    return ";".join(values) or None


def process_message(
    session: requests.Session,
    temp_root: pathlib.Path,
    ingest_url: str,
    oidc: str,
    channel: str,
    message: dict[str, Any],
    counters: base.Counters,
) -> None:
    message_id = int(message["message_id"])
    source_url = f"https://t.me/{channel}/{message_id}"
    urls = list(message.get("media_urls") or [])
    original_filename = base.sanitize_filename(
        message.get("file_name"),
        channel,
        message_id,
        ".bin" if message.get("is_document") else ".jpg",
    )
    local_path = temp_root / f"{channel}-{message_id}.download"
    binary_error: str | None = None
    mime: str | None = None

    if urls:
        try:
            mime = base.download_first_valid(session, urls, local_path, source_url, original_filename)
        except Exception as exc:
            binary_error = f"{type(exc).__name__}:{str(exc)[:120]}"
            local_path.unlink(missing_ok=True)

    if mime:
        filename = base.normalized_filename(original_filename, mime)
        if mime == "application/pdf":
            extracted_text, extracted_tables, extraction_state, extraction_note = base.extract_pdf(local_path)
            extraction_note = join_note(BINARY_NOTE, extraction_note)
        else:
            extracted_text, extracted_tables = None, []
            extraction_state = "BINARY_ONLY"
            extraction_note = join_note(BINARY_NOTE, "OCR_NOT_USED")
    else:
        if not (message.get("is_document") or message.get("caption")):
            counters.failed_files += 1
            print(json.dumps({
                "event": "FILE_FAILED",
                "channel": channel,
                "message_id": message_id,
                "file_name": original_filename,
                "error": "PUBLIC_MEDIA_UNAVAILABLE",
                "code": binary_error or "NO_PUBLIC_MEDIA_OR_TEXT",
            }, ensure_ascii=False))
            return

        filename, snapshot_text = metadata_snapshot(channel, message, source_url)
        local_path = temp_root / f"{channel}-{message_id}.txt"
        local_path.write_text(snapshot_text, encoding="utf-8", newline="\n")
        mime = "text/plain"
        extracted_text = snapshot_text
        extracted_tables = []
        extraction_state = "TEXT_EXTRACTED"
        extraction_note = SNAPSHOT_NOTE
        print(json.dumps({
            "event": "PUBLIC_METADATA_FALLBACK",
            "channel": channel,
            "message_id": message_id,
            "original_file_name": message.get("file_name"),
            "binary_error": binary_error,
        }, ensure_ascii=False))

    size = local_path.stat().st_size
    if size <= 0 or size > base.MAX_FILE_BYTES:
        counters.failed_files += 1
        local_path.unlink(missing_ok=True)
        return
    digest = base.sha256_file(local_path)
    base_meta = {
        "channel": channel,
        "message_id": message_id,
        "message_timestamp": message["message_timestamp"],
        "source_url": source_url,
        "telegram_caption": message.get("caption"),
        "file_name": filename,
        "file_size": size,
        "mime_type": mime,
        "sha256": digest,
        "ingest_source": PUBLIC_INGEST_SOURCE,
    }

    try:
        prepared = base.post_json(ingest_url, oidc, "prepare", base_meta)
        if prepared.get("upload_required"):
            base.upload_signed(str(prepared["signed_upload_url"]), local_path, mime)
        else:
            counters.duplicate_files += 1

        result = base.post_json(ingest_url, oidc, "finalize", {
            **base_meta,
            "storage_path": prepared["storage_path"],
            "extracted_text": extracted_text,
            "extracted_tables": extracted_tables,
            "extraction_state": extraction_state,
            "extraction_note": extraction_note,
        })
        counters.accepted_files += 1
        print(json.dumps({
            "event": "INGESTED",
            "channel": channel,
            "message_id": message_id,
            "file_name": filename,
            "mime_type": mime,
            "sha256": digest,
            "document_id": result.get("document_id"),
            "extraction_state": extraction_state,
            "ingest_source": PUBLIC_INGEST_SOURCE,
        }, ensure_ascii=False))
    except Exception as exc:
        counters.failed_files += 1
        print(json.dumps({
            "event": "FILE_FAILED",
            "channel": channel,
            "message_id": message_id,
            "file_name": filename,
            "error": type(exc).__name__,
            "code": str(exc)[:160],
        }, ensure_ascii=False))
    finally:
        local_path.unlink(missing_ok=True)


def collect() -> int:
    ingest_url = base.required_env("RONA_TELEGRAM_INGEST_URL")
    oidc = base.required_env("RONA_INGEST_OIDC_TOKEN")
    run_key = base.required_env("RONA_TELEGRAM_RUN_KEY")
    channels = [
        item.strip().lstrip("@")
        for item in os.environ.get("TELEGRAM_CHANNELS", DEFAULT_CHANNELS).split(",")
        if item.strip()
    ]
    limit = max(1, min(300, int(os.environ.get("TELEGRAM_MAX_MESSAGES", str(DEFAULT_LIMIT)))))
    counters = base.Counters()
    per_channel_errors: list[str] = []
    session = requests.Session()

    base.post_json(ingest_url, oidc, "run-status", {
        "run_key": run_key,
        "source": PUBLIC_RUN_SOURCE,
        "status": "STARTED",
        "channels": channels,
    })

    with tempfile.TemporaryDirectory(prefix="rona-telegram-public-") as tmp:
        temp_root = pathlib.Path(tmp)
        for channel in channels:
            try:
                messages = collect_public_messages(session, channel, limit)
            except Exception as exc:
                per_channel_errors.append(f"{channel}:{str(exc)[:80]}")
                print(json.dumps({
                    "event": "CHANNEL_FAILED",
                    "channel": channel,
                    "error": type(exc).__name__,
                    "code": str(exc)[:160],
                }, ensure_ascii=False))
                continue

            for message in messages:
                counters.scanned_messages += 1
                process_message(session, temp_root, ingest_url, oidc, channel, message, counters)

    if counters.accepted_files == 0:
        status = "FAILED"
    elif per_channel_errors or counters.failed_files:
        status = "PARTIAL"
    else:
        status = "SUCCESS"

    base.post_json(ingest_url, oidc, "run-status", {
        "run_key": run_key,
        "source": PUBLIC_RUN_SOURCE,
        "status": status,
        "channels": channels,
        "scanned_messages": counters.scanned_messages,
        "accepted_files": counters.accepted_files,
        "duplicate_files": counters.duplicate_files,
        "failed_files": counters.failed_files,
        "error_code": ";".join(per_channel_errors)[:200] if per_channel_errors else None,
    })
    print(json.dumps({
        "event": "RUN_COMPLETE",
        "status": status,
        "source": PUBLIC_RUN_SOURCE,
        **counters.__dict__,
    }, ensure_ascii=False))
    return 0 if status in {"SUCCESS", "PARTIAL"} else 2


def main() -> None:
    try:
        code = collect()
    except Exception as exc:
        print(json.dumps({
            "event": "RUN_FATAL",
            "error": type(exc).__name__,
            "code": str(exc)[:200],
        }, ensure_ascii=False))
        code = 2
    raise SystemExit(code)


if __name__ == "__main__":
    main()
