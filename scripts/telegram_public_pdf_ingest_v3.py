#!/usr/bin/env python3
"""RONA Trade Telegram PDF ingest V3.

Extends V2 with a credential-free binary fallback through two independently
validated public RSSHub instances whose /telegram/media route streams the
original Telegram document via MTProto. Telegram public preview remains the
source of channel/message metadata. Bytes are accepted only after V2 file-magic
validation and continue through the existing private SHA-256/extraction ingest.
"""

from __future__ import annotations

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


def collect_public_messages_v3(session: Any, channel: str, limit: int) -> list[dict[str, Any]]:
    messages = _original_collect(session, channel, limit)
    for message in messages:
        if not message.get("is_document"):
            continue
        message_id = int(message.get("message_id") or 0)
        mirrors = _rsshub_urls(channel, message_id)
        existing = [str(url) for url in list(message.get("media_urls") or []) if str(url)]
        # TGStat/direct Telegram URLs, when present, keep priority. RSSHub is the
        # credential-free fallback for the common public-preview metadata-only case.
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
