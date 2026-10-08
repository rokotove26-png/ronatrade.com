-- One-time projection backfill after analytics_full_platts_projection_functions_v1.
do $$
declare
  v_normalized integer;
  v_lpg jsonb;
  v_pub jsonb;
begin
  v_normalized:=portal_private.market_intelligence_normalize_dt_forward_v1();

  v_lpg:=portal_private.snapshot_market_intelligence_lpg_curve_v1();
  if coalesce((v_lpg->>'ok')::boolean,false) is not true then
    raise exception 'LPG_FULL_CURVE_BACKFILL_FAILED: %',v_lpg::text;
  end if;

  v_pub:=portal_private.refresh_market_intelligence_analytics_v1('FULL_PLATTS_CURVE_V1_PROJECTION_FIX');
  if v_pub is null then
    raise exception 'FULL_PLATTS_PROJECTION_REFRESH_FAILED';
  end if;
end
$$;
