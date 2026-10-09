-- Restore historical same-contract observations hidden by v12's last-segment filter.
-- Do not add, interpolate, or revalue Platts market records.
DO $upgrade$
DECLARE definition text;
BEGIN
  definition:=pg_get_functiondef('portal_private.market_intelligence_daily_monitor_v1(text,date)'::regprocedure);
  IF position('WHERE segment_id=(SELECT max(segment_id) FROM segments)' in definition)=0
     OR position('coalesce(jsonb_agg(source_ref ORDER BY as_of_date)' in definition)=0 THEN
    RAISE EXCEPTION 'V13_SOURCE_CONTRACT_MISMATCH';
  END IF;
  definition:=replace(definition,
    'WHERE segment_id=(SELECT max(segment_id) FROM segments)',
    'WHERE true -- retain all verified same-delivery observations');
  definition:=replace(definition,
    'coalesce(jsonb_agg(source_ref ORDER BY as_of_date),''[]''::jsonb) AS source_refs',
    'coalesce(jsonb_agg(source_ref ORDER BY as_of_date),''[]''::jsonb) AS source_refs,'||chr(10)||
    '    coalesce(jsonb_agg(segment_id ORDER BY as_of_date),''[]''::jsonb) AS segment_ids,'||chr(10)||
    '    coalesce(jsonb_agg(coalesce(as_of_date-prev_date,0) ORDER BY as_of_date),''[]''::jsonb) AS gap_before_days,'||chr(10)||
    '    count(DISTINCT segment_id)::int AS segment_count');
  definition:=replace(definition,
    '''availableTotal'',(SELECT count(*)::int FROM segments),',
    '''availableTotal'',(SELECT count(*)::int FROM segments),'||chr(10)||
    '  ''segmentIds'',(SELECT segment_ids FROM agg),'||chr(10)||
    '  ''gapBeforeDays'',(SELECT gap_before_days FROM agg),'||chr(10)||
    '  ''segmentCount'',(SELECT segment_count FROM agg),');
  definition:=replace(definition,
    '''sourceGap'',((SELECT count(*) FROM segments)>(SELECT point_count FROM agg))',
    '''sourceGap'',((SELECT segment_count FROM agg)>1)');
  definition:=replace(definition,
    '''notMonthlyMaturityCurve'',true',
    '''notMonthlyMaturityCurve'',true,''historyIncludesAllGapSegments'',true');
  IF position('segment_ids' in definition)=0 OR
     position('gapBeforeDays' in definition)=0 OR
     position('historyIncludesAllGapSegments' in definition)=0 THEN
    RAISE EXCEPTION 'V13_OBSERVATION_SEGMENTS_UNVERIFIED';
  END IF;
  EXECUTE definition;
END $upgrade$;
