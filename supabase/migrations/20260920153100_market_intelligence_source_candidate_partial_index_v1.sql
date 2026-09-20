-- TRACK A / workload-driven DB optimization.
-- Scope: accelerate the existing Market Intelligence source-candidate selector.
-- No data mutation, no publication change, no scheduling change.

create index if not exists telegram_market_documents_mi_candidate_time_idx
on portal_private.telegram_market_documents(message_timestamp desc)
where extraction_state in ('TEXT_EXTRACTED','TEXT_AND_TABLES_EXTRACTED')
  and (
    coalesce(extracted_text,'') ilike '%Platts European Marketscan%'
    or coalesce(extracted_text,'') ilike '%Евразийский рынок СУГ%'
    or coalesce(extracted_text,'') ilike '%Petromarket Prices%'
    or coalesce(extracted_text,'') ilike '%Argus European Products%'
    or coalesce(extracted_text,'') ilike '%Eurobob oxy%'
  );

comment on index portal_private.telegram_market_documents_mi_candidate_time_idx is
  'TRACK A workload-driven partial index for the existing Market Intelligence Telegram source-candidate predicate; ordered by newest message first.';
