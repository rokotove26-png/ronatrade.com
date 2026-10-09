-- Revert V14 cron hook only; preserve sourced market facts for audit.
DO $rollback$
DECLARE src text;
BEGIN
 src:=pg_get_functiondef('portal_private.market_intelligence_source_processor_cron_tick_v5()'::regprocedure);
 IF position('lpg_history:=portal_private.mi_backfill_lpg_observations_v14();' in src)=0 THEN
   RAISE EXCEPTION 'LPG_V14_ROLLBACK_SOURCE_DRIFT';
 END IF;
 src:=replace(src,'lpg jsonb; pub jsonb; lpg_history jsonb;','lpg jsonb; pub jsonb;');
 src:=replace(src,'lpg_history:=portal_private.mi_backfill_lpg_observations_v14();'||chr(10)||
   '  normalized:=portal_private.market_intelligence_normalize_dt_forward_v1();',
   'normalized:=portal_private.market_intelligence_normalize_dt_forward_v1();');
 src:=replace(src,'or coalesce((lpg->>''ok'')::boolean,false)'||chr(10)||
   '     or coalesce((lpg_history->>''inserted_facts'')::integer,0)>0 then',
   'or coalesce((lpg->>''ok'')::boolean,false) then');
 src:=replace(src,'''lpg'',lpg,''lpg_history'',lpg_history,''publication'',pub',
   '''lpg'',lpg,''publication'',pub');
 EXECUTE src;
END
$rollback$;
DROP FUNCTION IF EXISTS portal_private.mi_backfill_lpg_observations_v14();
