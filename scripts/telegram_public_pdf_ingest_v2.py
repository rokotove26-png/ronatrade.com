#!/usr/bin/env python3
"""RONA Trade Telegram PDF ingest V2.

Goals:
- read PDF attachments from configured public Telegram market channels;
- never treat Telegram HTML as a PDF;
- refresh GitHub OIDC during long runs;
- optionally use TGStat's sanctioned API as a binary mirror when Telegram's
  anonymous public preview exposes only document metadata;
- keep all resulting documents internal/fail-closed through the existing RONA
  private ingest endpoint.

TGSTAT_API_TOKEN is optional. If it is absent or the TGStat plan does not permit
third-party channel access, the collector still records Telegram metadata but it
never fabricates a PDF binary.
"""

from __future__ import annotations

import base64
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import requests

import telegram_public_market_ingest as base
import telegram_public_market_ingest_resilient as resilient

OIDC_AUDIENCE = "rona-telegram-ingest"
TGSTAT_POST_GET = "https://api.tgstat.ru/posts/get"
TGSTAT_CHANNEL_POSTS = "https://api.tgstat.ru/channels/posts"
TGSTAT_PROVENANCE = "TELEGRAM_DISCOVERED_TGSTAT_MIRROR_BINARY_FETCHED"
DIRECT_PROVENANCE = "TELEGRAM_PUBLIC_PREVIEW_BINARY_FETCHED"
PDF_ONLY = os.environ.get("TELEGRAM_PDF_ONLY", "1").strip().lower() not in {"0", "false", "no"}

# Scan enough anonymous preview pages to reach document posts that are not in the
# first ~80 mixed text/photo messages. Processing remains PDF-only by default.
base.MAX_PAGES_PER_CHANNEL = max(base.MAX_PAGES_PER_CHANNEL, 20)
base.REQUEST_TIMEOUT = min(base.REQUEST_TIMEOUT, 25)
resilient.SEARCH_TERMS["samantahlil"] = (
    "Platts", "Marketscan", "Oilgram", "LPGaswire", "SPR", "S&P Global", "pdf", "پلتز"
)
resilient.SEARCH_TERMS["platts_digits"] = (
    "Platts", "Marketscan", "Oilgram", "LPGaswire", "S&P Global", "pdf"
)


def _jwt_exp(token: str) -> int:
    try:
        part = token.split(".")[1]
        part += "=" * (-len(part) % 4)
        payload = json.loads(base64.urlsafe_b64decode(part.encode("ascii")))
        return int(payload.get("exp") or 0)
    except Exception:
        return 0


_oidc_cache: dict[str, Any] = {"token": "", "exp": 0}


def _fresh_oidc(force: bool = False) -> str:
    now = int(time.time())
    cached = str(_oidc_cache.get("token") or "")
    exp = int(_oidc_cache.get("exp") or 0)
    if not force and cached and (exp == 0 or exp - now > 90):
        return cached

    request_url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "").strip()
    request_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "").strip()
    if request_url and request_token:
        sep = "&" if "?" in request_url else "?"
        response = requests.get(
            f"{request_url}{sep}audience={OIDC_AUDIENCE}",
            headers={"Authorization": f"bearer {request_token}"},
            timeout=20,
        )
        response.raise_for_status()
        value = str(response.json().get("value") or "").strip()
        if not value:
            raise RuntimeError("GITHUB_OIDC_TOKEN_MISSING")
        _oidc_cache["token"] = value
        _oidc_cache["exp"] = _jwt_exp(value)
        return value

    # Local/manual compatibility. This value is never printed.
    fallback = os.environ.get("RONA_INGEST_OIDC_TOKEN", "").strip()
    if fallback:
        _oidc_cache["token"] = fallback
        _oidc_cache["exp"] = _jwt_exp(fallback)
        return fallback
    raise RuntimeError("GITHUB_OIDC_ENV_MISSING")


def post_json_refreshing(
    base_url: str,
    _ignored_oidc: str,
    route: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    last_code = "INGEST_UNKNOWN"
    for attempt in range(2):
        token = _fresh_oidc(force=attempt > 0)
        response = requests.post(
            f"{base_url.rstrip('/')}/{route.lstrip('/')}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            timeout=base.REQUEST_TIMEOUT,
        )
        try:
            data = response.json()
        except Exception as exc:
            if attempt == 0 and response.status_code in {401, 403}:
                continue
            raise RuntimeError(f"INGEST_INVALID_JSON_HTTP_{response.status_code}") from exc
        code = str(data.get("code") or f"INGEST_HTTP_{response.status_code}")
        last_code = code
        if response.ok and data.get("ok") is True:
            return data
        if attempt == 0 and (response.status_code in {401, 403} or code == "GITHUB_OIDC_DENIED"):
            continue
        raise RuntimeError(code)
    raise RuntimeError(last_code)


def strict_infer_mime(path: Any, _content_type: str | None, _filename: str | None) -> str | None:
    """Trust file signatures, never a .pdf suffix or an HTML response header."""
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
    return None


def allowed_media_url_v2(url: str) -> bool:
    if _original_allowed_media_url(url):
        return True
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and (host == "static.tgcnt.ru" or host.endswith(".tgcnt.ru"))


def _tgstat_url(value: Any) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    if raw.startswith("//"):
        raw = "https:" + raw
    if not allowed_media_url_v2(raw):
        return None
    host = (urlparse(raw).hostname or "").lower()
    return raw if host == "static.tgcnt.ru" or host.endswith(".tgcnt.ru") else None


def _telegram_message_id(link: str, channel: str) -> int | None:
    clean = str(link or "").strip().rstrip("/")
    match = re.search(r"(?:https?://)?t\.me/(?:s/)?([^/]+)/(\d+)$", clean, flags=re.I)
    if not match or match.group(1).casefold() != channel.casefold():
        return None
    return int(match.group(2))


def _tgstat_request(session: requests.Session, url: str, params: dict[str, Any]) -> dict[str, Any] | None:
    token = os.environ.get("TGSTAT_API_TOKEN", "").strip()
    if not token:
        return None
    # Never log response.url or exception detail: the API token is a query parameter.
    try:
        response = session.get(url, params={"token": token, **params}, timeout=20)
        data = response.json()
    except Exception as exc:
        print(json.dumps({"event": "TGSTAT_DEGRADED", "error": type(exc).__name__}, ensure_ascii=False))
        return None
    if not response.ok or data.get("status") != "ok":
        error_code = str(data.get("error") or data.get("status") or f"HTTP_{response.status_code}")[:80]
        print(json.dumps({"event": "TGSTAT_DEGRADED", "code": error_code}, ensure_ascii=False))
        return None
    return data


def _tgstat_post_media(session: requests.Session, source_url: str) -> dict[str, Any] | None:
    data = _tgstat_request(session, TGSTAT_POST_GET, {"postId": source_url})
    if not data:
        return None
    response = data.get("response") or {}
    media = response.get("media") or {}
    return media if isinstance(media, dict) else None


def _tgstat_item_to_message(
    session: requests.Session,
    channel: str,
    item: dict[str, Any],
) -> dict[str, Any] | None:
    link = str(item.get("link") or "").strip()
    if link and not link.startswith("http"):
        link = "https://" + link.lstrip("/")
    message_id = _telegram_message_id(link, channel)
    if message_id is None:
        return None

    media = item.get("media") or {}
    if not isinstance(media, dict) or media.get("media_type") != "mediaDocument":
        return None
    file_name = str(media.get("file_name") or "").strip() or None
    mime = str(media.get("mime_type") or "").strip().lower()
    if PDF_ONLY and not (mime == "application/pdf" or (file_name or "").lower().endswith(".pdf")):
        return None

    file_url = _tgstat_url(media.get("file_url"))
    if not file_url:
        detailed = _tgstat_post_media(session, link)
        if detailed:
            media = detailed
            file_name = str(media.get("file_name") or file_name or "").strip() or file_name
            mime = str(media.get("mime_type") or mime or "").strip().lower()
            file_url = _tgstat_url(media.get("file_url"))

    try:
        timestamp = datetime.fromtimestamp(int(item.get("date") or 0), tz=timezone.utc).isoformat()
    except Exception:
        timestamp = datetime.now(timezone.utc).isoformat()
    size = media.get("file_size") or media.get("size")
    return {
        "message_id": message_id,
        "message_timestamp": timestamp,
        "caption": str(item.get("text") or "").strip()[:100_000] or None,
        "media_urls": [file_url] if file_url else [],
        "file_name": file_name,
        "document_extra": f"{size} bytes" if size else None,
        "is_document": True,
        "has_photo": False,
        "_binary_provenance": TGSTAT_PROVENANCE if file_url else None,
    }


def collect_tgstat_documents(session: requests.Session, channel: str, limit: int) -> list[dict[str, Any]]:
    if not os.environ.get("TGSTAT_API_TOKEN", "").strip():
        return []
    data = _tgstat_request(
        session,
        TGSTAT_CHANNEL_POSTS,
        {"channelId": f"@{channel}", "limit": min(50, max(1, limit)), "hideDeleted": 1},
    )
    if not data:
        return []
    response = data.get("response") or {}
    items = response.get("items") or []
    result: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        parsed = _tgstat_item_to_message(session, channel, item)
        if parsed:
            result.append(parsed)
    print(json.dumps({"event": "TGSTAT_CHANNEL_DOCUMENTS", "channel": channel, "documents": len(result)}, ensure_ascii=False))
    return result


def _strip_post_html_candidate(message: dict[str, Any], channel: str) -> dict[str, Any]:
    if not message.get("is_document"):
        return message
    message_id = int(message["message_id"])
    canonical = f"https://t.me/{channel}/{message_id}".rstrip("/")
    urls = []
    for url in list(message.get("media_urls") or []):
        normalized = str(url).split("?", 1)[0].rstrip("/")
        if normalized == canonical:
            continue
        urls.append(url)
    message["media_urls"] = urls
    return message


def collect_regular_pdf_preview(session: requests.Session, channel: str, limit: int) -> list[dict[str, Any]]:
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
            parsed = resilient.parse_preview_element(element, channel, page_url)
            if parsed is None:
                continue
            if PDF_ONLY and not parsed.get("is_document"):
                continue
            parsed = _strip_post_html_candidate(parsed, channel)
            messages[int(parsed["message_id"])] = parsed
        if len(messages) >= limit or not page_ids:
            break
        current_min = min(page_ids)
        if previous_min is not None and current_min >= previous_min:
            break
        previous_min = current_min
        before = current_min
        time.sleep(0.2)
    return list(messages.values())


def collect_public_messages_v2(session: requests.Session, channel: str, limit: int) -> list[dict[str, Any]]:
    merged: dict[int, dict[str, Any]] = {}
    errors: list[str] = []
    try:
        for item in collect_regular_pdf_preview(session, channel, limit):
            merged[int(item["message_id"])] = item
    except Exception as exc:
        errors.append(type(exc).__name__)
        print(json.dumps({"event": "REGULAR_PREVIEW_DEGRADED", "channel": channel, "error": type(exc).__name__}, ensure_ascii=False))

    try:
        for item in resilient.collect_search_preview(session, channel):
            if PDF_ONLY and not item.get("is_document"):
                continue
            item = _strip_post_html_candidate(item, channel)
            merged[int(item["message_id"])] = item
    except Exception as exc:
        errors.append(type(exc).__name__)

    for item in collect_tgstat_documents(session, channel, limit):
        message_id = int(item["message_id"])
        existing = merged.get(message_id)
        if existing:
            # Prefer actual mirrored bytes while retaining Telegram timestamp/caption when present.
            existing["media_urls"] = list(item.get("media_urls") or []) + list(existing.get("media_urls") or [])
            existing["file_name"] = item.get("file_name") or existing.get("file_name")
            existing["document_extra"] = item.get("document_extra") or existing.get("document_extra")
            existing["_binary_provenance"] = item.get("_binary_provenance")
        else:
            merged[message_id] = item

    if not merged:
        raise RuntimeError("PDF_SOURCES_EMPTY" + (":" + ",".join(errors) if errors else ""))
    return sorted(merged.values(), key=lambda x: int(x["message_id"]), reverse=True)[:limit]


_original_allowed_media_url = base.allowed_media_url
_original_process_message = resilient.process_message
base.infer_mime = strict_infer_mime
base.allowed_media_url = allowed_media_url_v2
base.post_json = post_json_refreshing
resilient.collect_public_messages = collect_public_messages_v2


def process_message_v2(*args: Any, **kwargs: Any) -> None:
    # Signature: session, temp_root, ingest_url, oidc, channel, message, counters.
    message = args[5] if len(args) > 5 else kwargs.get("message")
    old_note = resilient.BINARY_NOTE
    try:
        resilient.BINARY_NOTE = (
            str(message.get("_binary_provenance"))
            if isinstance(message, dict) and message.get("_binary_provenance")
            else DIRECT_PROVENANCE
        )
        _original_process_message(*args, **kwargs)
    finally:
        resilient.BINARY_NOTE = old_note


resilient.process_message = process_message_v2


def main() -> None:
    resilient.main()


if __name__ == "__main__":
    main()
