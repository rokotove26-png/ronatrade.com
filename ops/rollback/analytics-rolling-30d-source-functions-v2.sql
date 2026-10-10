-- Emergency technical rollback for the owner-approved 30-day chart-window migration.
-- Use ONLY if analytics rolling30 deployment has to be reverted, AFTER
-- recording current source hashes. No market rows or permissions are changed.
DO $rollback_rolling30$
DECLARE c text; d text;
BEGIN
  c:=pg_get_functiondef('portal_private.market_intelligence_admin_canonical_payload_v1()'::regprocedure);
  d:=pg_get_functiondef('portal_private.market_intelligence_daily_monitor_v1(text,date)'::regprocedure);
  IF position('((now() at time zone ''Europe/Moscow'')::date - 29) as source_month' in c)=0
     OR position('as_of_date-prev_date>1' in d)=0 THEN
    RAISE EXCEPTION 'ROLLBACK_EXPECTED_ROLLING30_VERSION_NOT_PRESENT';
  END IF;

  c:=replace(c,
    '((now() at time zone ''Europe/Moscow'')::date - 29) as source_month',
    'date_trunc(''month'',latest_trade_date)::date as source_month');
  c:=replace(c,
    'and f.quality_status in (''CONFIRMED'',''CALCULATED'')'||chr(10)||
    '    and f.as_of_date <= (now() at time zone ''Europe/Moscow'')::date',
    'and f.quality_status in (''CONFIRMED'',''CALCULATED'')');
  c:=replace(c,
    'where target_month=(select target_month from target)'||chr(10)||
    '    and snapshot_date between (now() at time zone ''Europe/Moscow'')::date - 29'||chr(10)||
    '      and (now() at time zone ''Europe/Moscow'')::date',
    'where target_month=(select target_month from target)');
  c:=replace(c,
    'and upper(coalesce(basis,'''')) like ''%САРЫАГАШ%'''||chr(10)||
    '    and as_of_date between (now() at time zone ''Europe/Moscow'')::date - 29'||chr(10)||
    '      and (now() at time zone ''Europe/Moscow'')::date',
    'and upper(coalesce(basis,'''')) like ''%САРЫАГАШ%''');
  c:=replace(c,
    'and as_of_date<=(select latest_trade_date from target)'||chr(10)||
    '    and as_of_date<=(now() at time zone ''Europe/Moscow'')::date',
    'and as_of_date<=(select latest_trade_date from target)');

  d:=replace(d,
    'AND f.as_of_date<=least(p_reference_date,(now() at time zone ''Europe/Moscow'')::date)',
    'AND f.as_of_date<=p_reference_date');
  d:=replace(d,
    'AND f.as_of_date >= (now() at time zone ''Europe/Moscow'')::date - 29',
    'AND f.as_of_date>=p_reference_date -'||chr(10)||
    '      (CASE WHEN p_product=''ДТ'' THEN 50 ELSE 85 END)');
  d:=replace(d,'as_of_date-prev_date>1','as_of_date-prev_date>10');

  IF md5(c)<>'8ad47e1c97b748017369e0cb870f4bda'
     OR md5(d)<>'ae96b04c319334197eb9d81fcb84f09e' THEN
    RAISE EXCEPTION 'ROLLBACK_PRIOR_FUNCTION_SHA_NOT_VERIFIED';
  END IF;
  EXECUTE c;
  EXECUTE d;
END $rollback_rolling30$;
