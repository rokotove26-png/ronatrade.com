#!/usr/bin/env python3
"""Targeted public Telegram document discovery for RONA market ingest.

Extends the credential-free t.me/s collector with Telegram's public channel
search pages. This avoids relying on the default preview position for very large
channels, where the anonymous preview can expose an old message window.
"""

from __future__ import annotations

from urllib.parse import quote

import telegram_public_market_ingest as base


REGULAR_COLLECT = base.collect_public_messages
SEARCH_TERMS = {
    "samantahlil": ("Platts", "Marketscan", "Oilgram", "LPGaswire", "پلتز"),
    "platts_digits": ("Platts", "Marketscan", "Oilgram", "LPGaswire"),
}


def parse_document_search_page(session, channel: str, term: str) -> list[dict]:
    page_url = f"https://t.me/s/{channel}?q={quote(term, safe='')}"
    soup = base.BeautifulSoup(base.fetch_html(session, page_url), "lxml")
    found: list[dict] = []

    for element in soup.select(".tgme_widget_message[data-post]"):
        message_id = base.parse_message_id(element.get("data-post", ""), channel)
        if message_id is None:
            continue
        timestamp = base.parse_timestamp(element)
        if not timestamp:
            continue
        doc_urls, doc_title = base.document_candidates(element, page_url)
        if not doc_urls:
            continue
        found.append({
            "message_id": message_id,
            "message_timestamp": timestamp,
            "caption": base.caption_text(element),
            "media_urls": doc_urls,
            "file_name": doc_title,
            "is_document": True,
        })
    return found


def collect_public_messages_with_search(session, channel: str, limit: int) -> list[dict]:
    merged: dict[int, dict] = {}
    regular_error: Exception | None = None

    try:
        for item in REGULAR_COLLECT(session, channel, limit):
            merged[int(item["message_id"])] = item
    except Exception as exc:
        regular_error = exc
        print(base.json.dumps({
            "event": "REGULAR_PREVIEW_DEGRADED",
            "channel": channel,
            "error": type(exc).__name__,
            "code": str(exc)[:160],
        }, ensure_ascii=False))

    search_success = 0
    for term in SEARCH_TERMS.get(channel.casefold(), ("Platts", "Marketscan", "Oilgram", "LPGaswire")):
        try:
            matches = parse_document_search_page(session, channel, term)
            search_success += 1
            for item in matches:
                merged[int(item["message_id"])] = item
            print(base.json.dumps({
                "event": "PUBLIC_SEARCH_PAGE",
                "channel": channel,
                "term": term,
                "documents": len(matches),
            }, ensure_ascii=False))
        except Exception as exc:
            print(base.json.dumps({
                "event": "PUBLIC_SEARCH_DEGRADED",
                "channel": channel,
                "term": term,
                "error": type(exc).__name__,
                "code": str(exc)[:160],
            }, ensure_ascii=False))

    if not merged:
        if regular_error is not None and search_success == 0:
            raise regular_error
        raise RuntimeError("PUBLIC_PREVIEW_AND_SEARCH_EMPTY")

    # Prefer documents discovered through public search. Keep recent preview media
    # as a secondary source so the existing non-PDF market flow is preserved.
    ranked = sorted(
        merged.values(),
        key=lambda item: (1 if item.get("is_document") else 0, int(item["message_id"])),
        reverse=True,
    )
    return ranked[:limit]


base.collect_public_messages = collect_public_messages_with_search


if __name__ == "__main__":
    base.main()
