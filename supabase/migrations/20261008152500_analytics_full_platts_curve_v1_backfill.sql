-- One-time production backfill after analytics_full_platts_curve_v1.
do $$
declare
  v_curve jsonb;
  v_forecast jsonb;
  v_publication jsonb;
begin
  v_curve:=portal_private.market_intelligence_materialize_full_curve_v1();
  if coalesce((v_curve->>'ok')::boolean,false) is not true then
    raise exception 'FULL_PLATTS_CURVE_MATERIALIZATION_FAILED: %',v_curve::text;
  end if;

  v_forecast:=portal_private.snapshot_market_intelligence_forecast_inputs_v2();
  if coalesce((v_forecast->>'ok')::boolean,false) is not true then
    raise exception 'FULL_PLATTS_FORECAST_SNAPSHOT_FAILED: %',v_forecast::text;
  end if;

  v_publication:=portal_private.refresh_market_intelligence_analytics_v1('FULL_PLATTS_CURVE_V1');
  if v_publication is null then
    raise exception 'FULL_PLATTS_ANALYTICS_REFRESH_FAILED';
  end if;
end
$$;
