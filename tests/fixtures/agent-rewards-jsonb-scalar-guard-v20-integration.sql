-- Pure PostgreSQL regression, no customer records, no business data changes.
-- The old SQL-NULL test accepted JSON null; jsonb_set failed with SQLSTATE 22023.
DO $rona_test$
DECLARE
  v jsonb;
  patched jsonb;
  valid_count integer := 0;
  invalid_count integer := 0;
BEGIN
  IF NOT ('null'::jsonb IS NOT NULL) THEN
    RAISE EXCEPTION 'Expected JSON null to be SQL NOT NULL';
  END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(
    '[null,false,12,"text",[],{},
      {"payload":null},{"payload":0},{"payload":"text"},{"payload":[]},
      {"payload":{}},{"version":3,"payload":{"other":"retained","openSettlementAdjustment":10}}]'::jsonb
  ) AS e(value)
  LOOP
    IF jsonb_typeof(v)='object' AND jsonb_typeof(v->'payload')='object' THEN
      valid_count := valid_count+1;
      patched := jsonb_set(v,'{payload,openSettlementAdjustment}',to_jsonb(31::numeric),true);
      IF patched->'payload'->>'openSettlementAdjustment'<>'31' THEN
        RAISE EXCEPTION 'Guard lost numeric bridge overwrite for valid source';
      END IF;
      IF v->'payload'->>'other' IS NOT NULL
         AND patched->'payload'->>'other'<>v->'payload'->>'other' THEN
        RAISE EXCEPTION 'Guard lost unrelated legitimate OWNER correction fields';
      END IF;
    ELSE
      invalid_count := invalid_count+1;
      patched := v;
      IF patched IS DISTINCT FROM v THEN
        RAISE EXCEPTION 'Invalid source must remain unchanged, not coerced into approval';
      END IF;
    END IF;
  END LOOP;
  IF valid_count<>2 OR invalid_count<>10 THEN
    RAISE EXCEPTION 'Expected 2 valid OWNER correction objects and 10 scalar/malformed shapes, got %/%',valid_count,invalid_count;
  END IF;
END
$rona_test$;
