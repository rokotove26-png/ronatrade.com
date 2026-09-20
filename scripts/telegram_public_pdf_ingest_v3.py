#!/usr/bin/env python3
"""RONA Trade Telegram PDF ingest V3.

Extends V2 with a credential-free binary fallback through two independently
validated public RSSHub instances whose /telegram/media route streams the
original Telegram document via MTProto. Telegram public preview remains the
source of channel/message metadata. Bytes are accepted only after V2 file-magic
validation and continue through the existing private SHA-256/extraction ingest.
"""

from __future__ import annotations

from datetime import timezone
import json
from email.utils import parsedate_to_datetime
import re
from typing import Any
from urllib.parse import urlparse

import telegram_public_market_ingest as base
import telegram_public_market_ingest_resilient as resilient
import telegram_public_pdf_ingest_v2 as v2

RSSHUB_MIRRORS = (
    "https://rsshub.jamesflare.com",
    "https://rsshub-container.folo.is",
)
RSSHUB_HOSTS = {urlparse(value).hostname for value in RSSHUB_MIRRORS}
RSSHUB_PROVENANCE = "TELEGRAM_DISCOVERED_RSSHUB_MTPROTO_MIRROR_BINARY_FETCHED"
RSSHUB_REPORT_HINTS = (
    "platts",
    "marketscan",
    "oilgram",
    "lpgaswire",
    "eum",
    "argus",
    "petromarket",
    "crude oil marketwire",
)

_original_collect = v2.collect_public_messages_v2
_original_allowed = v2.allowed_media_url_v2


def allowed_media_url_v3(url: str) -> bool:
    if _original_allowed(url):
        return True
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    return (
        parsed.scheme == "https"
        and host in RSSHUB_HOSTS
        and path.startswith("/telegram/media/")
        and ".." not in path
    )


def _rsshub_urls(channel: str, message_id: int) -> list[str]:
    safe_channel = "".join(ch for ch in channel if ch.isalnum() or ch in {"_", "-"})
    if safe_channel != channel or message_id <= 0:
        return []
    return [f"{root}/telegram/media/{safe_channel}/{message_id}" for root in RSSHUB_MIRRORS]


def _rsshub_media(url: str, channel: str) -> tuple[str, int] | None:
    raw = str(url or "").strip()
    if not raw:
        return None
    if raw.startswith("//"):
        raw = "https:" + raw
    try:
        parsed = urlparse(raw)
    except Exception:
        return None
    host = (parsed.hostname or "").lower()
    match = re.match(r"^/telegram/media/([^/]+)/(\d+)$", parsed.path or "", flags=re.I)
    if (
        host not in RSSHUB_HOSTS
        or not match
        or match.group(1).casefold() != channel.casefold()
    ):
        return None
    message_id = int(match.group(2))
    if message_id <= 0:
        return None
    return f"https://{host}{parsed.path}", message_id


def _rsshub_filename(label: str, message_id: int) -> str:
    text = " ".join(str(label or "").split())
    match = re.search(r"([^<>/]{1,220}\.(?:pdf|jpg|jpeg|png|webp))\b", text, flags=re.I)
    if match:
        return match.group(1).strip()
    return f"telegram-rsshub-{message_id}.bin"


def _rsshub_report_candidate(title: str, filename: str) -> bool:
    haystack = f"{title} {filename}".casefold()
    return any(hint in haystack for hint in RSSHUB_REPORT_HINTS)


def collect_rsshub_feed_messages(session: Any, channel: str, limit: int) -> list[dict[str, Any]]:
    errors: list[str] = []
    for root in RSSHUB_MIRRORS:
        feed_url = f"{root}/telegram/channel/{channel}"
        try:
            response = session.get(feed_url, headers=base.HEADERS, timeout=base.REQUEST_TIMEOUT)
            response.raise_for_status()
            soup = base.BeautifulSoup(response.text, "xml")
            messages: dict[int, dict[str, Any]] = {}
            for item in soup.find_all("item"):
                title_node = item.find("title")
                title = title_node.get_text(" ", strip=True) if title_node else ""
                pub_node = item.find("pubDate")
                if not pub_node:
                    continue
                try:
                    timestamp = parsedate_to_datetime(pub_node.get_text(strip=True))
                    if timestamp.tzinfo is None:
                        timestamp = timestamp.replace(tzinfo=timezone.utc)
                    timestamp_text = timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
                except Exception:
                    continue

                desc_node = item.find("description")
                description_html = ""
                if desc_node is not None:
                    description_html = str(desc_node.string or desc_node.get_text() or "")
                fragment = base.BeautifulSoup(description_html, "html.parser")
                for node in fragment.select("a[href],img[src]"):
                    raw_url = node.get("href") or node.get("src")
                    media = _rsshub_media(str(raw_url or ""), channel)
                    if not media:
                        continue
                    media_url, message_id = media
                    label = node.get_text(" ", strip=True)
                    filename = _rsshub_filename(label, message_id)
                    is_document = filename.lower().endswith(".pdf")
                    if not is_document or not _rsshub_report_candidate(title, filename):
                        continue
                    existing = messages.get(message_id)
                    payload = {
                        "message_id": message_id,
                        "message_timestamp": timestamp_text,
                        "caption": title or None,
                        "media_urls": [media_url],
                        "file_name": filename,
                        "document_extra": "RSSHUB_FEED_DISCOVERY",
                        "is_document": True,
                        "has_photo": False,
                        "_binary_provenance": RSSHUB_PROVENANCE,
                    }
                    if not existing:
                        messages[message_id] = payload
                    elif media_url not in existing["media_urls"]:
                        existing["media_urls"].append(media_url)

            if messages:
                print(json.dumps({
                    "event": "RSSHUB_FEED_DISCOVERY",
                    "channel": channel,
                    "mirror": root,
                    "documents": len(messages),
                }, ensure_ascii=False))
                return sorted(
                    messages.values(),
                    key=lambda item: int(item["message_id"]),
                    reverse=True,
                )[:limit]
            errors.append(f"{root}:EMPTY")
        except Exception as exc:
            errors.append(f"{root}:{type(exc).__name__}")
    raise RuntimeError("RSSHUB_FEED_EMPTY:" + ",".join(errors)[:160])


def collect_public_messages_v3(session: Any, channel: str, limit: int) -> list[dict[str, Any]]:
    preview_error: Exception | None = None
    try:
        messages = _original_collect(session, channel, limit)
    except Exception as exc:
        preview_error = exc
        messages = []

    if not messages:
        try:
            messages = collect_rsshub_feed_messages(session, channel, limit)
        except Exception as rss_exc:
            if preview_error is not None:
                raise RuntimeError(
                    f"PUBLIC_PREVIEW_AND_RSSHUB_EMPTY:{type(preview_error).__name__}:{str(rss_exc)[:100]}"
                ) from rss_exc
            raise

    for message in messages:
        if not message.get("is_document"):
            continue
        message_id = int(message.get("message_id") or 0)
        mirrors = _rsshub_urls(channel, message_id)
        existing = [str(url) for url in list(message.get("media_urls") or []) if str(url)]
        # Direct/TGStat URLs keep priority. RSSHub stays the credential-free
        # binary fallback. Feed discovery is used only when public preview
        # discovery itself is unavailable.
        message["media_urls"] = existing + [url for url in mirrors if url not in existing]
        if not message.get("_binary_provenance") and mirrors:
            message["_binary_provenance"] = RSSHUB_PROVENANCE
    return messages


base.allowed_media_url = allowed_media_url_v3
resilient.collect_public_messages = collect_public_messages_v3


def main() -> None:
    v2.main()


if __name__ == "__main__":
    main()
