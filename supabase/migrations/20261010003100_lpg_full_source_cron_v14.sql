-- Integrate verified daily LPG materializer into the existing source processor.
-- The full-curve snapshot and published projection remain unchanged unless new facts arrive.
DO $patch$
DECLARE src text;
BEGIN
 src:=pg_get_functiondef('portal_private.market_intelligence_source_processor_cron_tick_v5()'::regprocedure);
 IF position('lpg jsonb; pub jsonb;' in src)=0 OR
    position('normalized:=portal_private.market_intelligence_normalize_dt_forward_v1();' in src)=0 OR
    position('or coalesce((lpg->>''ok'')::boolean,false) then' in lower(src))=0 THEN
   RAISE EXCEPTION 'LPG_V14_SOURCE_DRIFT';
 END IF;
 src:=replace(src,'lpg jsonb; pub jsonb;','lpg jsonb; pub jsonb; lpg_history jsonb;');
 src:=replace(src,
   'normalized:=portal_private.market_intelligence_normalize_dt_forward_v1();',
   'lpg_history:=portal_private.mi_backfill_lpg_observations_v14();'||chr(10)||
   '  normalized:=portal_private.market_intelligence_normalize_dt_forward_v1();');
 src:=replace(src,
   'or coalesce((lpg->>''ok'')::boolean,false) then',
   'or coalesce((lpg->>''ok'')::boolean,false)'||chr(10)||
   '     or coalesce((lpg_history->>''inserted_facts'')::integer,0)>0 then');
 src:=replace(src,
   '''lpg'',lpg,''publication'',pub',
   '''lpg'',lpg,''lpg_history'',lpg_history,''publication'',pub');
 IF position('lpg_history:=portal_private.mi_backfill_lpg_observations_v14()' in src)=0 THEN
   RAISE EXCEPTION 'LPG_V14_PATCH_NOT_APPLIED';
 END IF;
 EXECUTE src;
END
$patch$;
