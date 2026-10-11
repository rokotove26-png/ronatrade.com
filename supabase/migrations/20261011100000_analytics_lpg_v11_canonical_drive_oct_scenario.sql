-- ANALYTICS V11 / SYSTEM_ADMIN / DELTA ONLY
-- Source-lock: Owner-approved canonical rail tariff matrix dated 2026-10-01:
-- https://docs.google.com/spreadsheets/d/1RgtdbcYfEkwmNr1dJfXpnh47n5hUN_4xA6Od579tO5w/edit
-- Signed Protocol 03 dated 2026-09-30: https://drive.google.com/file/d/1MxCBLiMbSfN1qR_6NZdb67A4IqBxhi7O/view
-- R12 published CPT quote records stay unchanged. No tariff authority changes.
-- The RF documentary rate is OCTOBER ONLY (01-31 Oct): use solely as a what-if
-- input for NOVEMBER scenario with explicit warning. No commercial pricing authority.
DO $source_lock$
BEGIN
 IF md5(pg_get_functiondef('public.owner_analytics_admin_bootstrap()'::regprocedure))
    <> 'e4635eefbfcbbd3e7b48110fbee5f75e' THEN
   RAISE EXCEPTION 'V11_OWNER_BOOTSTRAP_SOURCE_DRIFT';
 END IF;
 IF md5(pg_get_functiondef('portal_private.market_intelligence_admin_lpg_tariff_bridge_v1(jsonb)'::regprocedure))
    <> '63438f0c5c0d5393699f61303afc7e94' THEN
   RAISE EXCEPTION 'V11_V10_LPG_BRIDGE_SOURCE_DRIFT';
 END IF;
END
$source_lock$;

CREATE TABLE portal_private.analytics_lpg_rail_evidence_v11 (
  evidence_key text PRIMARY KEY,
  product_group text NOT NULL DEFAULT 'LPG_SPBT' CHECK(product_group='LPG_SPBT'),
  origin_text text NOT NULL,
  destination_text text NOT NULL,
  amount_per_t numeric NOT NULL CHECK(amount_per_t>0),
  currency text NOT NULL CHECK(currency IN ('RUB','USD')),
  load_t numeric NOT NULL CHECK(load_t>0),
  valid_from date,
  valid_to date,
  source_ref text NOT NULL,
  authority_scope text NOT NULL,
  projection_role text NOT NULL DEFAULT 'TECHNICAL_SCENARIO_SOURCE_MIRROR_ONLY'
    CHECK(projection_role='TECHNICAL_SCENARIO_SOURCE_MIRROR_ONLY'),
  captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE portal_private.analytics_lpg_rail_evidence_v11 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON portal_private.analytics_lpg_rail_evidence_v11 FROM PUBLIC,anon,authenticated;

INSERT INTO portal_private.analytics_lpg_rail_evidence_v11
 (evidence_key,origin_text,destination_text,amount_per_t,currency,load_t,valid_from,valid_to,source_ref,authority_scope)
VALUES
('RF_GARANT_LPG_ZLYNKA_OZINKI_P03','Злынка (эксп.) 201202','Озинки (эксп.) 628508',12531.3,'RUB',39,'2026-10-01'::date,'2026-10-31'::date,'https://drive.google.com/file/d/1MxCBLiMbSfN1qR_6NZdb67A4IqBxhi7O/view','OWNER_APPROVED_DOCUMENTARY_OCT_ONLY'),
('KZH_LPG_OZINKI_SARYAGASH','Озинки','Сарыагаш',137.24,'USD',35,'2026-09-14'::date,NULL,'https://docs.google.com/spreadsheets/d/1RgtdbcYfEkwmNr1dJfXpnh47n5hUN_4xA6Od579tO5w/edit','OWNER_APPROVED_CANONICAL_PERIOD_NOT_STATED'),
('UTI_LPG_SARYAGASH_URTAAUL','Сарыагаш','Уртааул',33.0834,'USD',35,'2026-09-14'::date,NULL,'https://docs.google.com/spreadsheets/d/1eKW3RA1g6MpEWzekcOnD667Uq_SMvLDNjEdN5zC1rRs/edit','OWNER_CONFIRMED_INTERNAL_EXACT_SCOPE'),
('UTI_LPG_SARYAGASH_MARGILAN','Сарыагаш','Маргилан',48.1469,'USD',35,'2026-09-14'::date,NULL,'https://docs.google.com/spreadsheets/d/1eKW3RA1g6MpEWzekcOnD667Uq_SMvLDNjEdN5zC1rRs/edit','OWNER_CONFIRMED_INTERNAL_EXACT_SCOPE');

CREATE OR REPLACE FUNCTION portal_private.market_intelligence_admin_lpg_scenario_v11(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','portal_private'
AS $lpg_v11$
DECLARE
  v_basis_row record;
  v_bases jsonb := p #> '{canonicalAnalytics,products,LPG,rona,bases}';
  v_forecast jsonb := p #> '{canonicalAnalytics,products,LPG,forecast}';
  v_fx numeric := 84.9048; -- CBR USD/RUB official as-of 2026-10-11: scenario conversion only
  v_ids text[];
  v_legs jsonb;
  v_leg_count integer;
  v_total numeric;
  v_entries jsonb := '{}'::jsonb;
  v_quote numeric;
  v_start text := '2026-10-01';
  v_end text := '2026-10-31';
BEGIN
  IF v_forecast->>'month' <> '2026-11'
     OR nullif(v_forecast->>'sourceRef','') IS NULL
     OR v_forecast->>'base' IS NULL
     OR v_forecast->>'low' IS NULL
     OR v_forecast->>'high' IS NULL
     OR jsonb_typeof(v_bases) IS DISTINCT FROM 'array' THEN
    RETURN p;
  END IF;
  FOR v_basis_row IN
     SELECT basis_item.item->>0 AS basis,
            CASE WHEN (basis_item.item->>1) ~ '^[0-9]+([.][0-9]+)?$'
              THEN (basis_item.item->>1)::numeric ELSE NULL END AS published_usd_t
     FROM jsonb_array_elements(v_bases) AS basis_item(item)
     WHERE jsonb_typeof(basis_item.item)='array'
       AND jsonb_array_length(basis_item.item)=2
       AND basis_item.item->>0 LIKE 'CPT %'
  LOOP
     v_quote := v_basis_row.published_usd_t;
     v_ids := CASE v_basis_row.basis
       WHEN 'CPT Озинки' THEN ARRAY['RF_GARANT_LPG_ZLYNKA_OZINKI_P03']
       WHEN 'CPT Сарыагаш' THEN ARRAY['RF_GARANT_LPG_ZLYNKA_OZINKI_P03','KZH_LPG_OZINKI_SARYAGASH']
       WHEN 'CPT Уртааул' THEN ARRAY['RF_GARANT_LPG_ZLYNKA_OZINKI_P03','KZH_LPG_OZINKI_SARYAGASH','UTI_LPG_SARYAGASH_URTAAUL']
       WHEN 'CPT Маргилан' THEN ARRAY['RF_GARANT_LPG_ZLYNKA_OZINKI_P03','KZH_LPG_OZINKI_SARYAGASH','UTI_LPG_SARYAGASH_MARGILAN']
       ELSE NULL::text[] END;
     v_total := NULL; v_leg_count:=0; v_legs:='[]'::jsonb;
     IF v_ids IS NOT NULL THEN
       SELECT COUNT(*)::integer,
              SUM(CASE WHEN e.currency='RUB' THEN e.amount_per_t/v_fx ELSE e.amount_per_t END),
              COALESCE(jsonb_agg(jsonb_build_object(
                'route',e.origin_text||' → '||e.destination_text,
                'rawAmountPerT',e.amount_per_t,'currency',e.currency,
                'convertedUsdPerT',round(CASE WHEN e.currency='RUB' THEN e.amount_per_t/v_fx ELSE e.amount_per_t END,4),
                'validFrom',e.valid_from,'validTo',e.valid_to,
                'sourceRef',e.source_ref,'authorityScope',e.authority_scope,
                'loadT',e.load_t
              ) ORDER BY route_ord.ord),'[]'::jsonb)
         INTO v_leg_count,v_total,v_legs
         FROM unnest(v_ids) WITH ORDINALITY AS route_ord(evidence_key,ord)
         JOIN portal_private.analytics_lpg_rail_evidence_v11 e
           ON e.evidence_key=route_ord.evidence_key;
     END IF;
     IF v_ids IS NOT NULL AND v_leg_count=array_length(v_ids,1)
        AND v_total>0 THEN
       v_entries:=jsonb_set(v_entries,ARRAY[v_basis_row.basis],jsonb_build_object(
         'mode','OCTOBER_TARIFF_CARRY_FORWARD_SCENARIO_NOT_NOV_APPROVED',
         'railUsdT',round(v_total,4),
         'scenarioLowUsdT',round((v_forecast->>'low')::numeric+v_total,2),
         'scenarioBaseUsdT',round((v_forecast->>'base')::numeric+v_total,2),
         'scenarioHighUsdT',round((v_forecast->>'high')::numeric+v_total,2),
         'publishedR12UsdT',v_quote,
         'legs',v_legs,
         'novemberTariffApproved',false,
         'fullCommercialPrice',false,
         'unaccountedCostsNotZero',true
       ),true);
     ELSE
       v_entries:=jsonb_set(v_entries,ARRAY[v_basis_row.basis],jsonb_build_object(
         'mode','PUBLISHED_R12_REFERENCE_ONLY',
         'publishedR12UsdT',v_quote,
         'novemberTariffApproved',false,
         'fullCommercialPrice',false,
         'reason','NO_APPROVED_EXACT_LPG_RAIL_TARIFF_FOR_NOVEMBER'
       ),true);
     END IF;
  END LOOP;
  RETURN jsonb_set(p,'{canonicalAnalytics,products,LPG,rona,octoberRateCarryForwardScenarioV11}',
    jsonb_build_object(
     'version','LPG_SOURCE_LOCKED_SCENARIO_V11',
     'forecastMonth','2026-11',
     'scenarioType','OCTOBER_RAIL_CARRY_FORWARD_ASSUMPTION',
     'ownerApprovedOctRatesValidFrom',v_start,
     'ownerApprovedOctRatesValidTo',v_end,
     'tariffSource','https://docs.google.com/spreadsheets/d/1RgtdbcYfEkwmNr1dJfXpnh47n5hUN_4xA6Od579tO5w/edit',
     'fxRubPerUsd',v_fx,'fxAsOf','2026-10-11',
     'fxSource','https://www.cbr.ru/currency_base/daily/',
     'novemberTariffsConfirmed',false,
     'commercialMarginIncluded',false,
     'scenarios',v_entries
    ),true);
END
$lpg_v11$;
REVOKE ALL ON FUNCTION portal_private.market_intelligence_admin_lpg_scenario_v11(jsonb)
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.owner_analytics_admin_bootstrap()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
DECLARE
  v jsonb;
  r record;
  vals jsonb;
  n int;
  ref numeric;
  fc jsonb;
  curve jsonb;
  daily jsonb;
  trade_date date;
BEGIN
  v:=public.owner_analytics_admin_bootstrap_base_v1();

  FOR r IN
    SELECT * FROM (VALUES
      ('AI92'::text,'АИ-92'::text),
      ('AI95'::text,'АИ-95'::text),
      ('DT'::text,'ДТ'::text),
      ('LPG'::text,'СУГ'::text)
    ) x(k,product)
  LOOP
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
      'reference',ref,'sourceRef',s.source_ref
    )
    INTO fc
    FROM portal_private.market_intelligence_forecast_snapshots s
    WHERE s.product=r.product AND s.model_version='RONA_FULL_PLATTS_CURVE_V1'
    ORDER BY s.target_month DESC,s.created_at DESC
    LIMIT 1;

    IF fc IS NOT NULL THEN
      v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'forecast'],
        coalesce(v #> ARRAY['canonicalAnalytics','products',r.k,'forecast'],'{}'::jsonb)||fc,true);
    END IF;
    IF ref IS NOT NULL AND r.k NOT IN ('DT','LPG') THEN
      v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'rona','reference'],to_jsonb(ref),true);
    END IF;

    -- Exactly the same audited DAILY observed price monitor used for Client.
    -- Never plot maturity points (M1/M2/M3) as a time series.
    IF r.k IN ('DT','LPG') THEN
      trade_date:=to_date(v #>> '{canonicalAnalytics,latestTradeDate}','DD.MM.YYYY');
      daily:=portal_private.market_intelligence_daily_monitor_v1(r.product,trade_date);
      IF daily IS NOT NULL AND daily->>'version'='RONA_MARKET_OBSERVED_DAILY_V1' THEN
        v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'dates'],coalesce(daily->'dates','[]'::jsonb),true);
        v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'values'],coalesce(daily->'values','[]'::jsonb),true);
        v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'basis'],to_jsonb(daily->>'basis'),true);
        v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'dailyMonitor'],daily,true);
      END IF;
    END IF;
    -- Financial term structures are metadata for the forecast only; never chart maturities as daily prices.
    IF r.k IN ('DT','LPG') THEN
      trade_date:=to_date(v #>> '{canonicalAnalytics,latestTradeDate}','DD.MM.YYYY');
      curve:=portal_private.market_intelligence_admin_forward_term_structure_v1(r.product,trade_date);
      IF curve IS NOT NULL THEN
        v:=jsonb_set(v,ARRAY['canonicalAnalytics','products',r.k,'termCurve'],curve,true);
      END IF;
    END IF;
  END LOOP;
  RETURN portal_private.market_intelligence_admin_lpg_scenario_v11(portal_private.market_intelligence_admin_lpg_tariff_bridge_v1(v));
END
$function$

-- SQL runtime smoke executes the actual PLpgSQL function with all five CPT bases,
-- but writes no forecast, tariff, FX or commercial record.
DO $v11_runtime_smoke$
DECLARE
  v_test jsonb := '{"canonicalAnalytics":{"products":{"LPG":{"forecast":{"month":"2026-11","low":698.5,"base":725,"high":775,"sourceRef":"SMOKE_ONLY_SOURCE"},"rona":{"bases":[["CPT Озинки",610],["CPT Сарыагаш",745],["CPT Турксиб",790],["CPT Уртааул",780],["CPT Маргилан",795]]}}}}}'::jsonb;
  v_result jsonb;
  v_entries jsonb;
BEGIN
 v_result:=portal_private.market_intelligence_admin_lpg_scenario_v11(v_test);
 v_entries:=v_result #> '{canonicalAnalytics,products,LPG,rona,octoberRateCarryForwardScenarioV11,scenarios}';
 IF jsonb_typeof(v_entries) IS DISTINCT FROM 'object'
   OR NOT (v_entries ?& ARRAY['CPT Озинки','CPT Сарыагаш','CPT Турксиб','CPT Уртааул','CPT Маргилан'])
   OR v_entries #>> '{CPT Озинки,mode}' <> 'OCTOBER_TARIFF_CARRY_FORWARD_SCENARIO_NOT_NOV_APPROVED'
   OR v_entries #>> '{CPT Турксиб,mode}' <> 'PUBLISHED_R12_REFERENCE_ONLY'
   OR (v_entries #>> '{CPT Сарыагаш,scenarioBaseUsdT}')::numeric <= 1000
   OR (v_entries #>> '{CPT Озинки,scenarioBaseUsdT}')::numeric <= 850 THEN
   RAISE EXCEPTION 'V11_SCENARIO_SOURCE_COVERAGE_SMOKE_FAILED';
 END IF;
END
$v11_runtime_smoke$;