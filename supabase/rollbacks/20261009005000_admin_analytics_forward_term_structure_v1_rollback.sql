-- Rollback only of source-safe term structure projection; original owner authorization and forecast behavior retained.
CREATE OR REPLACE FUNCTION public.owner_analytics_admin_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','portal_private','auth'
AS $function$
DECLARE
  v jsonb; r record; vals jsonb; n int; ref numeric; fc jsonb;
BEGIN
  v:=public.owner_analytics_admin_bootstrap_base_v1();
  FOR r IN SELECT * FROM (VALUES
    ('AI92'::text,'АИ-92'::text),('AI95'::text,'АИ-95'::text),
    ('DT'::text,'ДТ'::text),('LPG'::text,'СУГ'::text)
  ) x(k,product) LOOP
    vals:=v #> ARRAY['canonicalAnalytics','products',r.k,'values'];
    ref:=NULL;
    IF jsonb_typeof(vals)='array' THEN
      n:=jsonb_array_length(vals);
      IF n>0 AND (vals->>(n-1)) ~ '^-?[0-9]+([.][0-9]+)?$' THEN
        ref:=(vals->>(n-1))::numeric;
      END IF;
    END IF;
    SELECT jsonb_build_object(
      'month',to_char(s.target_month,'YYYY-MM'),
      'low',s.low_usd_t,'base',s.base_usd_t,'high',s.high_usd_t,
      'forward',s.forward_implied_usd_t,'direction',s.direction,
      'confidence',s.confidence,'curveType',s.curve_type,
      'reference',ref,'sourceRef',s.source_ref)
    INTO fc
    FROM portal_private.market_intelligence_forecast_snapshots s
    WHERE s.product=r.product AND s.model_version='RONA_FULL_PLATTS_CURVE_V1'
    ORDER BY s.target_month DESC,s.created_at DESC LIMIT 1;
    IF fc IS NOT NULL THEN
      v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'forecast'],
        coalesce(v #> ARRAY['canonicalAnalytics','products',r.k,'forecast'],'{}'::jsonb)||fc,true);
    END IF;
    IF ref IS NOT NULL THEN
      v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'rona','reference'],to_jsonb(ref),true);
    END IF;
  END LOOP;
  RETURN v;
END
$function$;
DROP FUNCTION IF EXISTS portal_private.market_intelligence_admin_forward_term_structure_v1(text,date);
