-- Global presentation invariant for all present and future eligible deals:
-- one row per resolved counterparty + reporting/native currency within each deal.
-- Pure read-model transform. Source financial totals, signed schedules and bank
-- events are NEVER rewritten. Unresolved counterparties remain individually shown.
CREATE OR REPLACE FUNCTION portal_private.agent_rewards_group_cash_lines_v1(p_workspace jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'portal_private', 'public'
AS $group_cash$
DECLARE
  v_item jsonb;
  v_out jsonb := '[]'::jsonb;
  v_line jsonb;
  v_existing jsonb;
  v_updated jsonb;
  v_rows jsonb;
  v_new_rows jsonb;
  v_member jsonb;
  v_members jsonb;
  v_existing_refs jsonb;
  v_new_refs jsonb;
  v_overrides jsonb;
  v_changed_overrides jsonb;
  v_key text;
  v_existing_id text;
  v_id text;
  v_cid text;
  v_ccy text;
  v_native_ccy text;
  v_index bigint;
  v_amount numeric;
  v_native_amount numeric;
  v_prior_amount numeric;
  v_prior_native numeric;
  v_override_sum numeric;
  v_override_used boolean;
  v_group_count int;
  v_new_merge_count int;
  v_delta_count int;
  v_valid_override boolean;
  v_prior_line jsonb;
  v_override_base numeric;
  v_override_delta numeric;
  v_skipped int;
  v_index_bad boolean;
  v_ref_id text;
  v_line_refs jsonb;
  v_has_ref boolean;
  v_member_id text;
BEGIN
  IF jsonb_typeof(p_workspace->'deals') IS DISTINCT FROM 'array' THEN
    RETURN p_workspace;
  END IF;
  FOR v_item IN SELECT x.value FROM jsonb_array_elements(p_workspace->'deals') x(value) LOOP
    v_rows := coalesce(v_item->'cashPaymentLines','[]'::jsonb);
    IF jsonb_typeof(v_rows) IS DISTINCT FROM 'array' THEN
      v_out := v_out||jsonb_build_array(v_item);
      CONTINUE;
    END IF;
    v_new_rows := '[]'::jsonb;
    v_group_count := 0;
    v_new_merge_count := 0;
    v_skipped := 0;
    FOR v_line IN SELECT x.value FROM jsonb_array_elements(v_rows) x(value) LOOP
      v_id := nullif(v_line->>'paymentId','');
      v_cid := nullif(v_line->>'canonicalCounterpartyId','');
      v_ccy := upper(btrim(coalesce(v_line->>'currency','')));
      v_native_ccy := upper(btrim(coalesce(v_line->>'nativeCurrency',v_ccy)));
      v_index := NULL;
      v_amount := NULL;
      v_native_amount := NULL;
      BEGIN
        v_amount := (v_line->>'amount')::numeric;
        v_native_amount := (v_line->>'nativeAmount')::numeric;
      EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        v_amount := NULL;
        v_native_amount := NULL;
      END;
      -- Bank fees are intentionally separate economic events, not
      -- unresolved counterparties and not candidates for vendor grouping.
      IF coalesce(v_line->>'paymentKind','')<>'COUNTERPARTY_PAYMENT' THEN
        v_new_rows := v_new_rows||jsonb_build_array(v_line);
        CONTINUE;
      END IF;
      -- Fail closed on unresolved identity or ambiguous/uncertain amount.
      IF coalesce(v_line->>'counterpartyResolutionStatus','')<>'RESOLVED'
         OR v_cid IS NULL OR v_id IS NULL
         OR v_amount IS NULL OR v_native_amount IS NULL
         OR v_ccy !~ '^[A-Z]{3}$' OR v_native_ccy !~ '^[A-Z]{3}$' THEN
        v_new_rows := v_new_rows||jsonb_build_array(v_line);
        v_skipped := v_skipped+1;
        CONTINUE;
      END IF;
      -- Only within the same deal; each deal is processed independently.
      SELECT z.ord, z.value INTO v_index,v_existing
      FROM jsonb_array_elements(v_new_rows) WITH ORDINALITY z(value,ord)
      WHERE z.value->>'canonicalCounterpartyId'=v_cid
        AND coalesce(z.value->>'counterpartyResolutionStatus','')='RESOLVED'
        AND z.value->>'paymentKind'='COUNTERPARTY_PAYMENT'
        AND upper(btrim(z.value->>'currency'))=v_ccy
        AND upper(btrim(coalesce(z.value->>'nativeCurrency',v_ccy)))=v_native_ccy
        AND coalesce(z.value->>'groupingStatus','')<>'TO_VERIFY_DUPLICATE_PAYMENT_ID'
      ORDER BY z.ord
      LIMIT 1;
      IF v_index IS NULL THEN
        v_line := v_line||jsonb_build_object(
          'sourcePaymentBreakdown',coalesce(v_line->'sourcePaymentBreakdown',
            jsonb_build_array(jsonb_build_object(
              'paymentId',v_id,'amount',v_amount,
              'nativeAmount',v_native_amount,'currency',v_ccy,
              'nativeCurrency',v_native_ccy,'source',v_line->>'source',
              'authorityStatus',v_line->>'authorityStatus'))));
        v_new_rows := v_new_rows||jsonb_build_array(v_line);
        CONTINUE;
      END IF;
      v_members := coalesce(v_existing->'sourcePaymentBreakdown','[]'::jsonb);
      -- Payment IDs are unique only within a deal and may represent a bank
      -- statement line or a canonical resource. Repeat IDs need reconciliation.
      IF v_existing->>'paymentId'=v_id OR EXISTS(
        SELECT 1 FROM jsonb_array_elements(v_members) q(value)
        WHERE q.value->>'paymentId'=v_id) THEN
        v_line := v_line||jsonb_build_object('groupingStatus','TO_VERIFY_DUPLICATE_PAYMENT_ID');
        v_new_rows := v_new_rows||jsonb_build_array(v_line);
        v_skipped := v_skipped+1;
        CONTINUE;
      END IF;
      v_prior_amount := (v_existing->>'amount')::numeric;
      v_prior_native := (v_existing->>'nativeAmount')::numeric;
      v_members := v_members||jsonb_build_array(jsonb_build_object(
        'paymentId',v_id,'amount',v_amount,'nativeAmount',v_native_amount,
        'currency',v_ccy,'nativeCurrency',v_native_ccy,
        'source',v_line->>'source',
        'authorityStatus',v_line->>'authorityStatus'));
      -- Aggregate original financial lines only, preserving their source IDs.
      -- Bank provenance is kept in both bankPaymentRefs and the breakdown.
      v_existing_refs := coalesce(v_existing->'bankPaymentRefs','[]'::jsonb);
      v_line_refs := coalesce(v_line->'bankPaymentRefs','[]'::jsonb);
      IF jsonb_typeof(v_existing_refs) IS DISTINCT FROM 'array' THEN v_existing_refs:='[]'::jsonb; END IF;
      IF jsonb_typeof(v_line_refs) IS DISTINCT FROM 'array' THEN v_line_refs:='[]'::jsonb; END IF;
      FOR v_member IN SELECT q.value FROM jsonb_array_elements(v_line_refs) q(value) LOOP
        v_ref_id := v_member->>'paymentId';
        v_has_ref := EXISTS(
          SELECT 1 FROM jsonb_array_elements(v_existing_refs) old(value)
          WHERE old.value->>'paymentId'=v_ref_id AND v_ref_id IS NOT NULL);
        IF NOT v_has_ref THEN v_existing_refs:=v_existing_refs||jsonb_build_array(v_member); END IF;
      END LOOP;
      v_updated := v_existing||jsonb_build_object(
        'amount',v_prior_amount+v_amount,
        'nativeAmount',v_prior_native+v_native_amount,
        'groupingStatus','AUTO_GROUPED_SOURCE_RESOLVED_COUNTERPARTY',
        'groupedPaymentCount',jsonb_array_length(v_members),
        'sourcePaymentBreakdown',v_members,
        'bankPaymentRefs',v_existing_refs,
        'authorityStatus',CASE
          WHEN v_existing->>'authorityStatus'=v_line->>'authorityStatus'
            THEN v_existing->>'authorityStatus'
          ELSE 'GROUPED_MIXED_SOURCE_AUTHORITIES__REFER_TO_BREAKDOWN' END);
      v_new_rows := jsonb_set(v_new_rows,ARRAY[(v_index-1)::text],v_updated,false);
      v_group_count:=v_group_count+1;
      v_new_merge_count:=v_new_merge_count+1;
    END LOOP;
    -- Recompute the merged count from canonical breakdown on every call.
    -- A second read produces the same metadata as the first.
    SELECT coalesce(sum(CASE
      WHEN coalesce(x.value->>'groupedPaymentCount','')<> ''
       AND length(x.value->>'groupedPaymentCount')<=5
       AND translate(x.value->>'groupedPaymentCount','0123456789','')=''
      THEN greatest((x.value->>'groupedPaymentCount')::integer-1,0)
      ELSE 0 END),0)::int
    INTO v_group_count
    FROM jsonb_array_elements(v_new_rows) x(value);
    -- Adjust owner overrides only for newly combined input lines.
    -- Never sum a previously accumulated source breakdown a second time.
    v_overrides := v_item->'ownerCorrection'->'payload'->'paymentLineAmounts';
    IF v_new_merge_count>0 AND jsonb_typeof(v_overrides)='object' THEN
      v_changed_overrides:=v_overrides;
      FOR v_line IN SELECT x.value FROM jsonb_array_elements(v_new_rows) x(value)
        WHERE coalesce(x.value->>'groupingStatus','')='AUTO_GROUPED_SOURCE_RESOLVED_COUNTERPARTY'
      LOOP
        v_id:=v_line->>'paymentId';
        v_prior_line:=NULL;
        SELECT x.value INTO v_prior_line FROM jsonb_array_elements(v_rows) x(value)
          WHERE x.value->>'paymentId'=v_id LIMIT 1;
        IF v_prior_line IS NULL THEN CONTINUE; END IF;
        v_override_delta:=0;
        v_delta_count:=0;
        v_valid_override:=true;
        v_override_used:=(v_overrides ? v_id);
        FOR v_member IN SELECT y.value FROM jsonb_array_elements(v_rows) y(value)
          WHERE y.value->>'paymentId'<>v_id
            AND y.value->>'canonicalCounterpartyId'=v_line->>'canonicalCounterpartyId'
            AND upper(btrim(coalesce(y.value->>'currency','')))=upper(btrim(coalesce(v_line->>'currency','')))
            AND upper(btrim(coalesce(y.value->>'nativeCurrency',y.value->>'currency','')))=
                  upper(btrim(coalesce(v_line->>'nativeCurrency',v_line->>'currency','')))
            AND y.value->>'paymentKind'='COUNTERPARTY_PAYMENT'
        LOOP
          v_member_id:=v_member->>'paymentId';
          IF v_member_id IS NULL OR NOT EXISTS(
            SELECT 1 FROM jsonb_array_elements(v_line->'sourcePaymentBreakdown') q(value)
            WHERE q.value->>'paymentId'=v_member_id
          ) THEN CONTINUE; END IF;
          BEGIN
            IF v_overrides ? v_member_id THEN
              v_override_delta:=v_override_delta+(v_overrides->>v_member_id)::numeric;
              v_override_used:=true;
            ELSE
              v_override_delta:=v_override_delta+(v_member->>'amount')::numeric;
            END IF;
            v_delta_count:=v_delta_count+1;
          EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
            v_valid_override:=false;
            EXIT;
          END;
        END LOOP;
        IF v_delta_count>0 AND v_override_used AND v_valid_override THEN
          BEGIN
            v_override_base:=coalesce(
              (v_overrides->>v_id)::numeric,
              (v_prior_line->>'amount')::numeric);
          EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
            v_valid_override:=false;
          END;
          IF v_valid_override THEN
            FOR v_member IN SELECT y.value FROM jsonb_array_elements(v_rows) y(value)
              WHERE y.value->>'paymentId'<>v_id
                AND EXISTS(SELECT 1 FROM jsonb_array_elements(v_line->'sourcePaymentBreakdown') q(value)
                WHERE q.value->>'paymentId'=y.value->>'paymentId')
            LOOP
              v_changed_overrides:=v_changed_overrides-(v_member->>'paymentId');
            END LOOP;
            v_changed_overrides:=v_changed_overrides||
              jsonb_build_object(v_id,v_override_base+v_override_delta);
          END IF;
        END IF;
      END LOOP;
      IF v_changed_overrides<>v_overrides THEN
        v_item:=jsonb_set(v_item,'{ownerCorrection,payload,paymentLineAmounts}',
          v_changed_overrides,false);
      END IF;
    END IF;
    IF v_group_count>0 THEN
      v_item:=jsonb_set(v_item,'{cashPaymentLines}',v_new_rows,false);
    END IF;
    v_item:=v_item||jsonb_build_object('counterpartyPaymentGrouping',jsonb_build_object(
      'contract','AUTO_GROUP_SOURCE_RESOLVED_BY_DEAL_COUNTERPARTY_CURRENCY_V1',
      'scope','ALL_EXISTING_AND_FUTURE_DEALS',
      'separatePerDealApprovalRequired',false,
      'rowsMerged',v_group_count,
      'rowsPendingSourceVerification',v_skipped,
      'financialTotalsUnchanged',true,
      'bankDocumentsRetained',true));
    v_out:=v_out||jsonb_build_array(v_item);
  END LOOP;
  RETURN p_workspace||jsonb_build_object(
    'deals',v_out,
    'counterpartyGroupingContract','AUTO_GROUP_SOURCE_RESOLVED_BY_DEAL_COUNTERPARTY_CURRENCY_V1');
END
$group_cash$;
REVOKE ALL ON FUNCTION portal_private.agent_rewards_group_cash_lines_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION portal_private.agent_rewards_group_cash_lines_v1(jsonb) FROM anon;
REVOKE ALL ON FUNCTION portal_private.agent_rewards_group_cash_lines_v1(jsonb) FROM authenticated;
