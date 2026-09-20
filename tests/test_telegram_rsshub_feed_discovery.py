#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))

import telegram_public_pdf_ingest_v3 as v3

RSS="""<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
  <item>
    <title>Or the latest from Platts.</title>
    <pubDate>Sat, 19 Sep 2026 09:48:01 GMT</pubDate>
    <description><![CDATA[
      <a href="http://rsshub.jamesflare.com/telegram/media/platts_digits/6847">AP AG Platts (17-09-2026).pdf (578.38 kB)</a>
      <a href="http://rsshub.jamesflare.com/telegram/media/platts_digits/6846">Crude Oil Marketwire (17-09-2026).pdf (1013.89 kB)</a>
    ]]></description>
  </item>
  <item>
    <title>General newspaper dump</title>
    <pubDate>Fri, 18 Sep 2026 09:56:51 GMT</pubDate>
    <description><![CDATA[
      <a href="http://rsshub.jamesflare.com/telegram/media/platts_digits/6835">The Economist_1909.pdf (37.59 MB)</a>
    ]]></description>
  </item>
  <item>
    <title>European refined products</title>
    <pubDate>Fri, 18 Sep 2026 09:56:51 GMT</pubDate>
    <description><![CDATA[
      <a href="http://rsshub.jamesflare.com/telegram/media/platts_digits/6827">EUM...18092026x.pdf (1.27 MB)</a>
    ]]></description>
  </item>
</channel></rss>"""

class Response:
    status_code=200
    text=RSS
    def raise_for_status(self):
        return None

class Session:
    def __init__(self):
        self.urls=[]
    def get(self,url,**_kwargs):
        self.urls.append(url)
        return Response()

def test_feed_discovery():
    session=Session()
    rows=v3.collect_rsshub_feed_messages(session,'platts_digits',30)
    ids=[row['message_id'] for row in rows]
    assert ids==[6847,6846,6827],ids
    assert 6835 not in ids
    assert rows[0]['media_urls']==['https://rsshub.jamesflare.com/telegram/media/platts_digits/6847']
    assert rows[0]['file_name']=='AP AG Platts (17-09-2026).pdf'
    assert rows[0]['_binary_provenance']==v3.RSSHUB_PROVENANCE
    assert rows[0]['message_timestamp']=='2026-09-19T09:48:01Z'
    assert session.urls[0].endswith('/telegram/channel/platts_digits')

def test_public_preview_failure_uses_rsshub_feed():
    original=v3._original_collect
    session=Session()
    def fail_preview(_session,_channel,_limit):
        raise RuntimeError('PDF_SOURCES_EMPTY')
    try:
        v3._original_collect=fail_preview
        rows=v3.collect_public_messages_v3(session,'platts_digits',2)
    finally:
        v3._original_collect=original
    assert len(rows)==2
    assert all(row['is_document'] for row in rows)
    assert all(row['media_urls'][0].startswith('https://rsshub.jamesflare.com/telegram/media/') for row in rows)

if __name__=='__main__':
    test_feed_discovery()
    test_public_preview_failure_uses_rsshub_feed()
    print('TELEGRAM_RSSHUB_FEED_DISCOVERY=PASS')
