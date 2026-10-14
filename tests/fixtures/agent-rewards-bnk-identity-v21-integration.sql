-- Read-only PostgreSQL regression for Agent Rewards identity resolving.
-- All data are CTE-only fixtures. No grants, persistent writes or financial updates.
DO $agent_identity_regression$
DECLARE
  v_failed integer;
  v_rows jsonb;
BEGIN
  WITH identities(canonical_counterparty_id,canonical_counterparty_name,evidence_refs,source_locked,lifecycle_state) AS (
    VALUES
      ('SUPPLIER:S-001'::text,'ЗАО «Белорусская нефтяная компания»'::text,
       '["PAYMENT:OUT-2026-004-BNK"]'::jsonb,true,'ACTIVE'::text),
      ('COUNTERPARTY:SGTRANS'::text,'РУП «СГ-ТРАНС»'::text,
       '["PAYMENT:OUT-2026-004-SGTRANS"]'::jsonb,true,'ACTIVE'::text),
      ('COUNTERPARTY:ORIENT'::text,'ТОО «Orient Logistic»'::text,
       '["PAYMENT:OUT-2026-004-ORIENT"]'::jsonb,true,'ACTIVE'::text),
      ('COUNTERPARTY:NONCURRENT'::text,'Not Current'::text,
       '["PAYMENT:OUT-UNLOCKED"]'::jsonb,true,'SUPERSEDED'::text),
      ('COUNTERPARTY:UNLOCKED'::text,'Not Source Locked'::text,
       '["PAYMENT:OUT-UNLOCKED"]'::jsonb,false,'ACTIVE'::text),
      ('CONFLICT:A'::text,'Other name'::text,
       '["PAYMENT:OUT-CONFLICT"]'::jsonb,true,'ACTIVE'::text),
      ('CONFLICT:B'::text,'Another name'::text,
       '["PAYMENT:OUT-CONFLICT"]'::jsonb,true,'ACTIVE'::text),
      ('CONFLICT:NAME'::text,'Unique Label'::text,
       '["PAYMENT:OUT-CONFLICT-NAME"]'::jsonb,true,'ACTIVE'::text),
      ('CONFLICT:EVIDENCE'::text,'Non Matching Label'::text,
       '["PAYMENT:OUT-CONFLICT-NAME-OTHER"]'::jsonb,true,'ACTIVE'::text)
  ),
  inputs(case_id,label,payment_id,expected_id) AS (
    VALUES
      ('BNK_PAYMENT_EVIDENCE','ЗАО «БНК»','OUT-2026-004-BNK','SUPPLIER:S-001'),
      ('SGTRANS_EXACT','РУП «СГ-ТРАНС»','OUT-2026-004-SGTRANS','COUNTERPARTY:SGTRANS'),
      ('ORIENT_EXACT','ТОО «Orient Logistic»','OUT-2026-004-ORIENT','COUNTERPARTY:ORIENT'),
      ('UNKNOWN_FAIL_CLOSED','Unknown Payment','OUT-NONE',null),
      ('INVALID_SOURCE_LOCK','Not Source Locked','OUT-UNLOCKED',null),
      ('TWO_EVIDENCE_IDS','Different Supplier','OUT-CONFLICT',null),
      ('NAME_VS_EVIDENCE_AMBIGUITY','Unique Label','OUT-CONFLICT-NAME-OTHER',null)
  ),
  results AS (
    SELECT q.case_id,q.expected_id,
       (SELECT CASE WHEN count(DISTINCT i.canonical_counterparty_id)=1
         THEN min(i.canonical_counterparty_id) ELSE null END
        FROM identities i
        WHERE i.source_locked=true AND i.lifecycle_state='ACTIVE'
          AND (
            upper(btrim(i.canonical_counterparty_name))=upper(btrim(q.label))
            OR (
              jsonb_typeof(i.evidence_refs)='array'
              AND nullif(btrim(q.payment_id),'') IS NOT NULL
              AND i.evidence_refs @> jsonb_build_array('PAYMENT:' || q.payment_id)
            )
          )
       ) AS actual_id
    FROM inputs q
  )
  SELECT count(*) FILTER (WHERE actual_id IS DISTINCT FROM expected_id),
         jsonb_agg(jsonb_build_object('case',case_id,'expected',expected_id,'actual',actual_id))
    INTO v_failed,v_rows FROM results;
  IF v_failed <> 0 THEN
    RAISE EXCEPTION 'AGENT_REWARDS_BNK_V21_IDENTITY_REGRESSION_FAIL (%) %',v_failed,v_rows::text;
  END IF;
  RAISE NOTICE 'AGENT_REWARDS_BNK_V21_IDENTITY_REGRESSION_PASS %',v_rows::text;
END
$agent_identity_regression$;
