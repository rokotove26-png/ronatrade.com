-- RONA Trade Google News duplicate lookup index.
-- Owner-authorized write #8, 2026-09-28.
-- Adds a partial expression index matching the existing normalized-caption
-- duplicate predicate for OPEN_WEB_GNEWS rows. No business data is changed.

create index if not exists telegram_market_documents_gnews_caption_norm_idx
on portal_private.telegram_market_documents
(
  lower(regexp_replace(btrim(telegram_caption),'\s+',' ','g'))
)
where ingest_source='OPEN_WEB_GNEWS';

comment on index portal_private.telegram_market_documents_gnews_caption_norm_idx
is 'Stage2 duplicate lookup accelerator for OPEN_WEB_GNEWS normalized telegram_caption.';
