-- Restore pre-v13 single-segment source function without touching market facts.
DO $rollback$
DECLARE definition text;
BEGIN
  definition:=pg_get_functiondef('portal_private.market_intelligence_daily_monitor_v1(text,date)'::regprocedure);
  IF position('historyIncludesAllGapSegments' in definition)=0 THEN
    RAISE EXCEPTION 'V13_ROLLBACK_SOURCE_MISMATCH';
  END IF;
  definition:=replace(definition,'WHERE true -- retain all verified same-delivery observations',
    'WHERE segment_id=(SELECT max(segment_id) FROM segments)');
  definition:=replace(definition,
    ' AS source_refs,'||chr(10)||
    '    coalesce(jsonb_agg(segment_id ORDER BY as_of_date),''[]''::jsonb) AS segment_ids,'||chr(10)||
    '    coalesce(jsonb_agg(coalesce(as_of_date-prev_date,0) ORDER BY as_of_date),''[]''::jsonb) AS gap_before_days,'||chr(10)||
    '    count(DISTINCT segment_id)::int AS segment_count',' AS source_refs');
  definition:=replace(definition,
    '''availableTotal'',(SELECT count(*)::int FROM segments),'||chr(10)||
    '  ''segmentIds'',(SELECT segment_ids FROM agg),'||chr(10)||
    '  ''gapBeforeDays'',(SELECT gap_before_days FROM agg),'||chr(10)||
    '  ''segmentCount'',(SELECT segment_count FROM agg),',
    '''availableTotal'',(SELECT count(*)::int FROM segments),');
  definition:=replace(definition,
    '''sourceGap'',((SELECT segment_count FROM agg)>1)',
    '''sourceGap'',((SELECT count(*) FROM segments)>(SELECT point_count FROM agg))');
  definition:=replace(definition,
    '''notMonthlyMaturityCurve'',true,''historyIncludesAllGapSegments'',true',
    '''notMonthlyMaturityCurve'',true');
  EXECUTE definition;
END $rollback$;
