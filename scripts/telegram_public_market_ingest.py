#!/usr/bin/env python3
"""RONA Trade public Telegram market collector.

Credential-free, read-only collector for public Telegram channel previews (t.me/s).
It never logs in, joins channels, or sends messages. Original binaries use the
existing OIDC-protected private ingest flow. PDF extraction uses embedded text and
tables only; OCR is not used.
"""

from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin, urlparse

import pdfplumber
import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

DEFAULT_CHANNELS = "Samantahlil,platts_digits"
DEFAULT_LIMIT = 80
MAX_PAGES_PER_CHANNEL = 12
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_TEXT_CHARS = 1_000_000
MAX_TABLES = 180
MAX_TABLE_ROWS = 120
MAX_TABLE_COLS = 30
MAX_CELL_CHARS = 800
REQUEST_TIMEOUT = 45
UPLOAD_TIMEOUT = 240
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


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
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_cell(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text[:MAX_CELL_CHARS] if text else None


def extract_pdf(path: pathlib.Path) -> tuple[str | None, list[dict[str, Any]], str, str | None]:
    text_parts: list[str] = []
    tables: list[dict[str, Any]] = []
    notes: list[str] = []
    text_len = 0
    try:
        reader = PdfReader(str(path), strict=False)
        for page_index, page in enumerate(reader.pages):
            if text_len >= MAX_TEXT_CHARS:
                notes.append("TEXT_TRUNCATED_AT_1M_CHARS")
                break
            try:
                value = (page.extract_text() or "").strip()
            except Exception:
                value = ""
            if value:
                remaining = MAX_TEXT_CHARS - text_len
                part = f"\n--- PAGE {page_index + 1} ---\n{value[:remaining]}"
                text_parts.append(part)
                text_len += len(part)
    except Exception as exc:
        notes.append(f"PYPDF:{type(exc).__name__}")

    try:
        with pdfplumber.open(str(path)) as pdf:
            for page_index, page in enumerate(pdf.pages):
                if len(tables) >= MAX_TABLES:
                    notes.append("TABLES_TRUNCATED")
                    break
                try:
                    page_tables = page.extract_tables() or []
                except Exception:
                    page_tables = []
                for table_index, table in enumerate(page_tables):
                    if len(tables) >= MAX_TABLES:
                        break
                    rows = [
                        [safe_cell(v) for v in (row or [])[:MAX_TABLE_COLS]]
                        for row in (table or [])[:MAX_TABLE_ROWS]
                    ]
                    if rows:
                        tables.append({
                            "page": page_index + 1,
                            "table_index": table_index + 1,
                            "rows": rows,
                        })
    except Exception as exc:
        notes.append(f"PDFPLUMBER:{type(exc).__name__}")

    text = "".join(text_parts).strip() or None
    if text and tables:
        state = "TEXT_AND_TABLES_EXTRACTED"
    elif text:
        state = "TEXT_EXTRACTED"
    elif tables:
        state = "TEXT_AND_TABLES_EXTRACTED"
    else:
        state = "BINARY_ONLY"
    return text, tables, state, ";".join(notes) or None


def allowed_media_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme != "https":
        return False
    host = (parsed.hostname or "").lower()
    return (
        host == "t.me"
        or host.endswith(".t.me")
        or host == "telesco.pe"
        or host.endswith(".telesco.pe")
        or host == "telegram.org"
        or host.endswith(".telegram.org")
        or host == "telegram-cdn.org"
        or host.endswith(".telegram-cdn.org")
    )


def normalize_url(value: str, base_url: str) -> str | None:
    value = (value or "").strip()
    if not value or value.startswith("tg://"):
        return None
    url = urljoin(base_url, value)
    return url if allowed_media_url(url) else None


def parse_message_id(value: str, channel: str) -> int | None:
    if "/" not in value:
        return None
    left, right = value.rsplit("/", 1)
    if left.casefold() != channel.casefold() or not right.isdigit():
        return None
    return int(right)


def parse_timestamp(element: Any) -> str | None:
    time_el = element.select_one("time[datetime]")
    if not time_el:
        return None
    raw = (time_el.get("datetime") or "").strip()
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def caption_text(element: Any) -> str | None:
    node = element.select_one(".tgme_widget_message_text")
    if not node:
        return None
    text = node.get_text(separator="\n", strip=True)
    return text[:100_000] if text else None


def unique_urls(values: list[str], base_url: str) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        url = normalize_url(str(value), base_url)
        if url and url not in seen:
            seen.add(url)
            result.append(url)
    return result


def document_candidates(element: Any, base_url: str) -> tuple[list[str], str | None]:
    title_node = element.select_one(".tgme_widget_message_document_title")
    title = title_node.get_text(strip=True) if title_node else None
    wrap = element.select_one("a.tgme_widget_message_document_wrap")
    if not wrap:
        return [], title
    values: list[str] = []
    attrs = ("href", "src", "data-src", "data-url", "data-web-document-url", "data-webdocument-url")
    for attr in attrs:
        if wrap.get(attr):
            values.append(str(wrap.get(attr)))
    for node in wrap.select("[href], [src], [data-src], [data-url], [data-web-document-url], [data-webdocument-url]"):
        for attr in attrs:
            if node.get(attr):
                values.append(str(node.get(attr)))
    return unique_urls(values, base_url), title


def photo_candidates(element: Any, base_url: str) -> list[str]:
    values: list[str] = []
    for node in element.select(".tgme_widget_message_photo_wrap"):
        style = node.get("style", "")
        for match in re.finditer(r"url\((?:'|\")?(.*?)(?:'|\")?\)", style):
            values.append(match.group(1))
    return unique_urls(values, base_url)


def fetch_html(session: requests.Session, url: str) -> str:
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            response = session.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            if response.status_code == 429:
                time.sleep(2 + attempt * 2)
                continue
            response.raise_for_status()
            return response.text
        except Exception as exc:
            last_exc = exc
            if attempt < 2:
                time.sleep(1 + attempt)
    raise RuntimeError(f"PUBLIC_PREVIEW_HTTP_FAILED:{type(last_exc).__name__ if last_exc else 'UNKNOWN'}")


def collect_public_messages(session: requests.Session, channel: str, limit: int) -> list[dict[str, Any]]:
    messages: dict[int, dict[str, Any]] = {}
    before: int | None = None
    previous_min: int | None = None

    for _ in range(MAX_PAGES_PER_CHANNEL):
        page_url = f"https://t.me/s/{channel}" if before is None else f"https://t.me/s/{channel}?before={before}"
        soup = BeautifulSoup(fetch_html(session, page_url), "lxml")
        page_ids: list[int] = []
        for element in soup.select(".tgme_widget_message[data-post]"):
            message_id = parse_message_id(element.get("data-post", ""), channel)
            if message_id is None:
                continue
            page_ids.append(message_id)
            if message_id in messages:
                continue
            timestamp = parse_timestamp(element)
            if not timestamp:
                continue
            doc_urls, doc_title = document_candidates(element, page_url)
            photos = photo_candidates(element, page_url)
            messages[message_id] = {
                "message_id": message_id,
                "message_timestamp": timestamp,
                "caption": caption_text(element),
                "media_urls": doc_urls or photos,
                "file_name": doc_title,
                "is_document": bool(doc_urls),
            }

        if len(messages) >= limit or not page_ids:
            break
        current_min = min(page_ids)
        if previous_min is not None and current_min >= previous_min:
            break
        previous_min = current_min
        before = current_min
        time.sleep(0.3)

    if not messages:
        raise RuntimeError("PUBLIC_PREVIEW_EMPTY_OR_UNAVAILABLE")
    return [messages[key] for key in sorted(messages, reverse=True)[:limit]]


def infer_mime(path: pathlib.Path, content_type: str | None, filename: str | None) -> str | None:
    ctype = (content_type or "").split(";", 1)[0].strip().lower()
    ext = pathlib.Path(filename or "").suffix.lower()
    with path.open("rb") as fh:
        prefix = fh.read(16)
    if prefix.startswith(b"%PDF-"):
        return "application/pdf"
    if prefix.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if prefix.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if prefix.startswith(b"RIFF") and len(prefix) >= 12 and prefix[8:12] == b"WEBP":
        return "image/webp"
    if ctype in {"application/pdf", "image/jpeg", "image/png", "image/webp"}:
        return ctype
    if ext == ".pdf":
        return "application/pdf"
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return None


def sanitize_filename(value: str | None, channel: str, message_id: int, default_ext: str) -> str:
    name = pathlib.Path((value or "").strip()).name.replace("\x00", "").strip()
    if not name:
        name = f"telegram-{channel}-{message_id}{default_ext}"
    return name[:240]


def download_candidate(
    session: requests.Session,
    url: str,
    path: pathlib.Path,
    referer: str,
    expected_filename: str | None,
) -> str:
    if not allowed_media_url(url):
        raise RuntimeError("MEDIA_URL_NOT_ALLOWED")
    response = session.get(
        url,
        headers={**HEADERS, "Referer": referer, "Accept": "*/*"},
        stream=True,
        timeout=REQUEST_TIMEOUT,
        allow_redirects=True,
    )
    response.raise_for_status()
    if not allowed_media_url(response.url):
        raise RuntimeError("MEDIA_REDIRECT_NOT_ALLOWED")
    advertised = response.headers.get("content-length")
    if advertised and advertised.isdigit() and int(advertised) > MAX_FILE_BYTES:
        raise RuntimeError("MEDIA_TOO_LARGE")
    total = 0
    with path.open("wb") as fh:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_FILE_BYTES:
                raise RuntimeError("MEDIA_TOO_LARGE")
            fh.write(chunk)
    if total <= 0:
        raise RuntimeError("MEDIA_EMPTY")
    mime = infer_mime(path, response.headers.get("content-type"), expected_filename)
    if not mime:
        path.unlink(missing_ok=True)
        raise RuntimeError("MEDIA_UNSUPPORTED_OR_HTML")
    return mime


def download_first_valid(
    session: requests.Session,
    urls: list[str],
    path: pathlib.Path,
    referer: str,
    expected_filename: str | None,
) -> str:
    last_error = "NO_MEDIA_CANDIDATE"
    for url in urls:
        path.unlink(missing_ok=True)
        try:
            return download_candidate(session, url, path, referer, expected_filename)
        except Exception as exc:
            last_error = f"{type(exc).__name__}:{str(exc)[:100]}"
    raise RuntimeError(last_error)


def upload_signed(url: str, path: pathlib.Path, mime: str) -> None:
    with path.open("rb") as fh:
        response = requests.put(
            url,
            data=fh,
            headers={"Content-Type": mime, "Cache-Control": "max-age=3600", "x-upsert": "false"},
            timeout=UPLOAD_TIMEOUT,
        )
    if not response.ok and response.status_code != 409:
        raise RuntimeError(f"SIGNED_UPLOAD_HTTP_{response.status_code}")


def normalized_filename(filename: str, mime: str) -> str:
    path = pathlib.Path(filename)
    ext = path.suffix.lower()
    stem = path.stem or "telegram-document"
    if mime == "application/pdf" and ext != ".pdf":
        return f"{stem}.pdf"
    if mime == "image/jpeg" and ext not in {".jpg", ".jpeg"}:
        return f"{stem}.jpg"
    if mime == "image/png" and ext != ".png":
        return f"{stem}.png"
    if mime == "image/webp" and ext != ".webp":
        return f"{stem}.webp"
    return filename


def collect() -> int:
    ingest_url = required_env("RONA_TELEGRAM_INGEST_URL")
    oidc = required_env("RONA_INGEST_OIDC_TOKEN")
    run_key = required_env("RONA_TELEGRAM_RUN_KEY")
    channels = [
        item.strip().lstrip("@")
        for item in os.environ.get("TELEGRAM_CHANNELS", DEFAULT_CHANNELS).split(",")
        if item.strip()
    ]
    limit = max(1, min(300, int(os.environ.get("TELEGRAM_MAX_MESSAGES", str(DEFAULT_LIMIT)))))
    counters = Counters()
    per_channel_errors: list[str] = []
    session = requests.Session()

    post_json(ingest_url, oidc, "run-status", {
        "run_key": run_key,
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
                urls = list(message.get("media_urls") or [])
                if not urls:
                    continue
                message_id = int(message["message_id"])
                source_url = f"https://t.me/{channel}/{message_id}"
                default_ext = ".bin" if message.get("is_document") else ".jpg"
                filename = sanitize_filename(message.get("file_name"), channel, message_id, default_ext)
                suffix = pathlib.Path(filename).suffix or default_ext
                local_path = temp_root / f"{channel}-{message_id}{suffix}"

                try:
                    mime = download_first_valid(session, urls, local_path, source_url, filename)
                    filename = normalized_filename(filename, mime)
                    size = local_path.stat().st_size
                    digest = sha256_file(local_path)
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
                    }

                    prepared = post_json(ingest_url, oidc, "prepare", base_meta)
                    if prepared.get("upload_required"):
                        upload_signed(str(prepared["signed_upload_url"]), local_path, mime)
                    else:
                        counters.duplicate_files += 1

                    if mime == "application/pdf":
                        extracted_text, extracted_tables, extraction_state, extraction_note = extract_pdf(local_path)
                    else:
                        extracted_text, extracted_tables, extraction_state, extraction_note = None, [], "BINARY_ONLY", "OCR_NOT_USED"

                    result = post_json(ingest_url, oidc, "finalize", {
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
                        "sha256": digest,
                        "document_id": result.get("document_id"),
                        "extraction_state": extraction_state,
                    }, ensure_ascii=False))
                except Exception as exc:
                    counters.failed_files += 1
                    local_path.unlink(missing_ok=True)
                    print(json.dumps({
                        "event": "FILE_FAILED",
                        "channel": channel,
                        "message_id": message_id,
                        "file_name": filename,
                        "error": type(exc).__name__,
                        "code": str(exc)[:160],
                    }, ensure_ascii=False))

    if counters.accepted_files == 0:
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
