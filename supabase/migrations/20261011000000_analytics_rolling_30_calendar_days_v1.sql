-- Owner-approved display-window change: verified observation dates are limited to the last
-- 30 Moscow calendar dates, today inclusive. No market facts, permissions, sources
-- or price calculations are inserted or modified.
-- Live canonical definitions were checked on 2026-10-10 (MD5 source locks).
DO $rolling_30$
DECLARE
  canonical text;
  daily text;
BEGIN
  canonical := pg_get_functiondef(
    'portal_private.market_intelligence_admin_canonical_payload_v1()'::regprocedure
  );
  daily := pg_get_functiondef(
    'portal_private.market_intelligence_daily_monitor_v1(text,date)'::regprocedure
  );
  IF md5(canonical) <> '8ad47e1c97b748017369e0cb870f4bda'
     OR md5(daily) <> 'ae96b04c319334197eb9d81fcb84f09e' THEN
    RAISE EXCEPTION 'ROLLING30_LIVE_FUNCTION_SOURCE_LOCK_MISMATCH';
  END IF;

  -- Preserve the live forecast/source authority. Change only the historical
  -- observation time bounds; source_month keeps its existing internal name.
  canonical := replace(canonical,
    'date_trunc(''month'',latest_trade_date)::date as source_month',
    '((now() at time zone ''Europe/Moscow'')::date - 29) as source_month');
  canonical := replace(canonical,
    'and f.quality_status in (''CONFIRMED'',''CALCULATED'')',
    'and f.quality_status in (''CONFIRMED'',''CALCULATED'')'||chr(10)||
    '    and f.as_of_date <= (now() at time zone ''Europe/Moscow'')::date');
  canonical := replace(canonical,
    'where target_month=(select target_month from target)',
    'where target_month=(select target_month from target)'||chr(10)||
    '    and snapshot_date between (now() at time zone ''Europe/Moscow'')::date - 29'||chr(10)||
    '      and (now() at time zone ''Europe/Moscow'')::date');
  canonical := replace(canonical,
    'and upper(coalesce(basis,'''') ) like ''%САРЫАГАШ%''',
    'and upper(coalesce(basis,'''') ) like ''%САРЫАГАШ%''');
  -- The regional LPG assessment is separately dated and must not leak an
  -- archived August value into a current 30-day forecast/benchmark.
  canonical := replace(canonical,
    'and upper(coalesce(basis,'''') ) like ''%САРЫАГАШ%''',
    'and upper(coalesce(basis,'''') ) like ''%САРЫАГАШ%''');
  -- Actual live function uses no whitespace after coalesce(basis,'').
  canonical := replace(canonical,
    'and upper(coalesce(basis,'''')) like ''%САРЫАГАШ%''',
    'and upper(coalesce(basis,'''')) like ''%САРЫАГАШ%'''||chr(10)||
    '    and as_of_date between (now() at time zone ''Europe/Moscow'')::date - 29'||chr(10)||
    '      and (now() at time zone ''Europe/Moscow'')::date');
  -- Do not display future-dated rows even when source_anchor is ahead.
  canonical := replace(canonical,
    'and as_of_date<=(select latest_trade_date from target)',
    'and as_of_date<=(select latest_trade_date from target)'||chr(10)||
    '    and as_of_date<=(now() at time zone ''Europe/Moscow'')::date');

  daily := replace(daily,
    'AND f.as_of_date<=p_reference_date',
    'AND f.as_of_date<=least(p_reference_date,(now() at time zone ''Europe/Moscow'')::date)');
  daily := replace(daily,
    'AND f.as_of_date>=p_reference_date -'||chr(10)||
    '      (CASE WHEN p_product=''ДТ'' THEN 50 ELSE 85 END)',
    'AND f.as_of_date >= (now() at time zone ''Europe/Moscow'')::date - 29');
  -- Every absent date is a gap, including non-trading days. No synthetic
  -- continuity is inferred by the Admin R4 / Client V20 painters.
  daily := replace(daily,'as_of_date-prev_date>10','as_of_date-prev_date>1');

  IF position('((now() at time zone ''Europe/Moscow'')::date - 29) as source_month' in canonical)=0
     OR position('and as_of_date between (now() at time zone ''Europe/Moscow'')::date - 29' in canonical)=0
     OR position('snapshot_date between (now() at time zone ''Europe/Moscow'')::date - 29' in canonical)=0
     OR position('AND f.as_of_date >= (now() at time zone ''Europe/Moscow'')::date - 29' in daily)=0
     OR position('as_of_date-prev_date>1' in daily)=0
     OR position('(CASE WHEN p_product=''ДТ'' THEN 50 ELSE 85 END)' in daily)>0 THEN
    RAISE EXCEPTION 'ROLLING30_REWRITE_NOT_VERIFIED';
  END IF;
  EXECUTE canonical;
  EXECUTE daily;
END $rolling_30$;
