-- PostgreSQL 17 integration contract. TEST FIXTURE ONLY.
DO $test$
DECLARE first_run jsonb; second_run jsonb; cron_run jsonb;
  n integer; seed_price numeric;
BEGIN
 first_run:=portal_private.mi_backfill_lpg_observations_v14();
 IF (first_run->>'inserted_facts')::integer <> 8 THEN
  RAISE EXCEPTION 'EXPECTED_8_INSERTS_GOT:%',first_run;
 END IF;
 SELECT count(*) INTO n FROM portal_private.market_intelligence_facts;
 IF n<>9 THEN RAISE EXCEPTION 'EXPECTED_9_TOTAL_FACTS_GOT:%',n; END IF;
 SELECT assessment_value INTO seed_price
 FROM portal_private.market_intelligence_facts
 WHERE metadata->>'seed'='true';
 IF seed_price<>999 THEN
  RAISE EXCEPTION 'EXISTING_APPROVED_FACT_OVERWRITTEN:%',seed_price;
 END IF;
 SELECT count(*) INTO n FROM portal_private.market_intelligence_facts
 WHERE as_of_date=current_date-1;
 IF n<>0 THEN RAISE EXCEPTION 'SHORT_REPORT_CREATED_FALSE_QUOTES:%',n; END IF;
 second_run:=portal_private.mi_backfill_lpg_observations_v14();
 IF (second_run->>'inserted_facts')::integer<>0 THEN
  RAISE EXCEPTION 'BACKFILL_NOT_IDEMPOTENT:%',second_run;
 END IF;
 cron_run:=portal_private.market_intelligence_source_processor_cron_tick_v5();
 IF cron_run#>>'{lpg_history,inserted_facts}'<>'0' THEN
  RAISE EXCEPTION 'CRON_V14_INTEGRATION_NOT_ACTIVE:%',cron_run;
 END IF;
 RAISE NOTICE 'LPG_V14_POSTGRESQL_INTEGRATION=PASS first=% repeat=% facts=% short_issue=NONE original_unchanged=true',
   first_run,second_run,9;
END
$test$;
