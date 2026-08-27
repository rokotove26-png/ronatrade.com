#!/usr/bin/env python3
import datetime as dt
import email.utils
import hashlib
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

BASE = "https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-ai-read-extras/public-market-ingest"
TOKEN = os.environ.get("RONA_INGEST_OIDC_TOKEN", "")
RUN_KEY = os.environ.get("RONA_PUBLIC_MARKET_RUN_KEY", "")
UA = "RONA-Trade-Market-Collector/1.0"
QUERIES = [
    "Россия бензин дизель НПЗ экспорт топливо when:2d",
    "Беларусь бензин дизель НПЗ нефтепродукты when:2d",
    "Казахстан бензин дизель СУГ НПЗ экспорт when:2d",
    "Узбекистан бензин дизель СУГ нефтепродукты when:2d",
    "Кыргызстан бензин дизель СУГ нефтепродукты when:2d",
    "Таджикистан бензин дизель нефтепродукты when:2d",
    "Армения Азербайджан бензин дизель СУГ when:2d",
    "Молдова бензин дизель нефтепродукты when:2d",
    "CIS gasoline diesel LPG refinery fuel supply when:2d",
]

def request(url, method="GET", payload=None, timeout=20):
    headers = {"User-Agent": UA, "Accept": "application/json, application/rss+xml, application/xml"}
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
        headers["Authorization"] = "Bearer " + TOKEN
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read(700000)

def post(path, payload):
    body = request(BASE + "/" + path, method="POST", payload=payload, timeout=25)
    return json.loads(body.decode("utf-8", "replace") or "{}")

def clean_markup(value):
    value = html.unescape(str(value or ""))
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()

def parse_date(value):
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return None

def collect_google_news():
    rows = []
    errors = []
    for query in QUERIES:
        rss_url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": query, "hl": "ru", "gl": "RU", "ceid": "RU:ru"})
        try:
            root = ET.fromstring(request(rss_url))
            for item in root.findall(".//item")[:20]:
                title = clean_markup(item.findtext("title"))
                link = clean_markup(item.findtext("link"))
                description = clean_markup(item.findtext("description"))
                source = item.find("source")
                source_name = clean_markup(source.text if source is not None else "") or "Google News source"
                if not title or not link.startswith("https://"):
                    continue
                rows.append({
                    "ingest_source": "OPEN_WEB_GNEWS",
                    "source_name": source_name,
                    "source_url": link,
                    "source_published_at": parse_date(item.findtext("pubDate") or ""),
                    "title": title,
                    "content_text": (title + "\n" + description)[:30000],
                    "metadata": {"collector": "GOOGLE_NEWS_RSS", "query": query, "rss_url": rss_url},
                })
        except Exception as exc:
            errors.append("GNEWS:" + type(exc).__name__)
    return rows, errors

def dedupe(rows):
    seen = set()
    result = []
    for row in rows:
        key = re.sub(r"\W+", " ", row["title"].lower(), flags=re.UNICODE).strip()
        fingerprint = hashlib.sha256(key.encode("utf-8")).hexdigest()
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        result.append(row)
    return result

def main():
    if not TOKEN or not RUN_KEY:
        return 2
    counts = {"scanned_items": 0, "accepted_items": 0, "duplicate_items": 0, "filtered_items": 0, "failed_items": 0}
    post("run-status", {"run_key": RUN_KEY, "status": "STARTED", **counts})
    rows, errors = collect_google_news()
    counts["scanned_items"] = len(rows)
    unique = dedupe(rows)
    counts["duplicate_items"] = len(rows) - len(unique)
    for row in unique[:120]:
        if len(row["content_text"]) < 40:
            counts["filtered_items"] += 1
            continue
        row["run_key"] = RUN_KEY
        row["discovered_at"] = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
        try:
            response = post("source", row)
            if response.get("duplicate"):
                counts["duplicate_items"] += 1
            else:
                counts["accepted_items"] += 1
        except Exception as exc:
            counts["failed_items"] += 1
            errors.append("POST:" + type(exc).__name__)
    if counts["accepted_items"] > 0 and errors:
        status = "PARTIAL"
    elif counts["scanned_items"] > 0 and counts["failed_items"] == 0:
        status = "SUCCESS"
    else:
        status = "FAILED"
    error_code = ";".join(sorted(set(errors)))[:200] if errors else None
    post("run-status", {"run_key": RUN_KEY, "status": status, **counts, "error_code": error_code})
    print(json.dumps({"status": status, **counts, "errors": sorted(set(errors))}, ensure_ascii=False))
    return 0 if status in {"SUCCESS", "PARTIAL"} else 1

if __name__ == "__main__":
    sys.exit(main())
