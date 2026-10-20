-- Source-current approved Finance/Operations bank-payment overlay. Does not mutate bank entries, signed agent contracts or accruals.
CREATE OR REPLACE FUNCTION portal_private.agent_rewards_live_bank_overlay_v1(p_workspace jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'portal_private', 'public'
AS $agent_bank$
DECLARE
  v_item jsonb;
  v_output jsonb := '[]'::jsonb;
  v_deal_key uuid;
  v_approval_at timestamptz;
  v_baseline_at timestamptz;
  v_proposal_id uuid;
  v_approval_id uuid;
  v_components jsonb;
  v_new_components jsonb;
  v_component jsonb;
  v_settlements jsonb;
  v_new_settlements jsonb;
  v_settlement jsonb;
  v_cf jsonb;
  v_bridge jsonb;
  v_lines jsonb;
  v_new_bank_refs jsonb;
  v_accounting_ccy text;
  v_native_ccy text;
  v_name text;
  v_native_prior numeric;
  v_native_paid numeric;
  v_reporting_prior numeric;
  v_reporting_new numeric;
  v_open_prior numeric;
  v_open_new numeric;
  v_counterparty_delta numeric;
  v_fee_delta numeric;
  v_old_received numeric;
  v_old_cashout numeric;
  v_old_fee numeric;
  v_new_cashout numeric;
  v_new_fee numeric;
  v_new_net numeric;
  v_new_result numeric;
  v_effective_bank_time timestamptz;
  v_rate numeric;
  v_rate_count integer;
  v_fx_source_in text;
  v_fx_source_out text;
  v_equiv numeric;
  v_currency_ok boolean;
  v_has_native_payment boolean;
  v_already_in_cash boolean;
  v_native_preclosed boolean;
  v_owner_line_key text;
  v_owner_line_count int;
  v_owner_line_delta jsonb;
  v_owner_line_updated jsonb;
  v_owner_line_value numeric;
  v_owner_line_patch_status text;
  v_legacy_line jsonb;
  v_line_pos bigint;
  v_merged_line boolean;
  v_bank record;
BEGIN
  IF jsonb_typeof(p_workspace->'deals') IS DISTINCT FROM 'array' THEN
    RETURN p_workspace;
  END IF;
  FOR v_item IN SELECT x.value FROM jsonb_array_elements(p_workspace->'deals') x(value) LOOP
    v_deal_key := NULL;
    v_proposal_id := NULL;
    v_approval_id := NULL;
    v_baseline_at := NULL;
    v_has_native_payment := false;
    v_owner_line_delta := '{}'::jsonb;
    v_owner_line_patch_status := 'NO_NEW_BANK_LINE';
    SELECT d.id INTO v_deal_key FROM portal_private.deals d
      WHERE d.deal_id=v_item->>'dealId' AND d.lifecycle_state::text='ACTIVE' LIMIT 1;
    IF v_deal_key IS NULL THEN
      v_output := v_output || jsonb_build_array(v_item);
      CONTINUE;
    END IF;
    SELECT p.record_id,o.record_id,p.created_at
      INTO v_proposal_id,v_approval_id,v_approval_at
    FROM portal_private.ai_coordination_records p
    JOIN portal_private.ai_coordination_records o
      ON o.parent_record_id=p.record_id
      AND o.record_type='OPERATIONS_INTERNAL_DECISION'
      AND o.identity_id='AI-OPERATIONS-DIRECTOR'
      AND o.functional_role::text='OPERATIONS_DIRECTOR'
      AND o.status='APPROVE_FOR_NEXT_STAGE'
      AND o.qa_only IS NOT TRUE
    WHERE p.target_type='DEAL'
      AND p.target_id=v_item->>'dealId'
      AND p.record_type='BUSINESS_CHANGE_PROPOSAL'
      AND p.identity_id='AI-FINANCE'
      AND p.functional_role::text='FINANCE'
      AND p.status='PROPOSED'
      AND p.qa_only IS NOT TRUE
      AND p.payload->>'proposed_field'='agent_rewards.source_current_settlement_reconciliation_v1'
      AND p.payload->>'proposed_action'='RECONCILE_AGENT_REWARDS_WITH_BANK_CONFIRMED_PAYMENT'
    ORDER BY o.created_at DESC LIMIT 1;
    IF v_proposal_id IS NULL THEN
      v_output := v_output || jsonb_build_array(v_item);
      CONTINUE;
    END IF;
    v_baseline_at := NULLIF(v_item->'openSettlementSourceCurrentness'->>'sourceCreatedAt','')::timestamptz;
    v_cf := COALESCE(v_item->'cashFlow','{}'::jsonb);
    v_bridge := COALESCE(v_item->'ownerResultBridge','{}'::jsonb);
    v_components := v_bridge->'open_settlement_adjustment'->'components';
    v_settlements := COALESCE(v_item->'settlementPositions','[]'::jsonb);
    v_accounting_ccy := upper(btrim(coalesce(v_cf->>'currency','')));
    IF v_baseline_at IS NULL
       OR jsonb_typeof(v_components) IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_settlements) IS DISTINCT FROM 'array'
       OR nullif(v_cf->>'cashReceived','') IS NULL
       OR nullif(v_cf->>'counterpartyCashOut','') IS NULL
       OR nullif(v_cf->>'bankFees','') IS NULL
       OR nullif(v_bridge->'open_settlement_adjustment'->>'amount','') IS NULL
       OR v_accounting_ccy<> 'USD' THEN
      v_output := v_output || jsonb_build_array(
        v_item || jsonb_build_object('liveBankReconciliation',
          jsonb_build_object('status','TO_VERIFY_BASELINE','financeProposalRecordId',v_proposal_id)));
      CONTINUE;
    END IF;
    v_old_received := (v_cf->>'cashReceived')::numeric;
    v_old_cashout := (v_cf->>'counterpartyCashOut')::numeric;
    v_old_fee := (v_cf->>'bankFees')::numeric;
    v_open_prior := (v_bridge->'open_settlement_adjustment'->>'amount')::numeric;
    v_open_new := v_open_prior;
    v_counterparty_delta := 0;
    v_fee_delta := 0;
    v_new_components := '[]'::jsonb;
    v_lines := coalesce(v_item->'cashPaymentLines','[]'::jsonb);
    IF jsonb_typeof(v_lines) IS DISTINCT FROM 'array' THEN v_lines := '[]'::jsonb; END IF;
    v_new_bank_refs := '[]'::jsonb;
    v_currency_ok := true;
    v_effective_bank_time := NULL;
    FOR v_component IN SELECT x.value FROM jsonb_array_elements(v_components) x(value) LOOP
      v_native_paid := 0;
      v_native_prior := coalesce(nullif(v_component->>'native_balance','')::numeric,0);
      -- An earlier canonical native-bank overlay may have settled the RUB payable
      -- before its USD reporting bridge and saved Owner input were reconciled.
      -- In that case the existing payment is the only eligible new FX event;
      -- native cash_amount and native balance must NOT be settled twice.
      v_native_preclosed := v_component->>'type'='TRADE_PAYABLE'
        AND v_native_prior=0
        AND v_component->>'source_status'='BANK_SETTLED_CONFIRMED'
        AND v_component->>'reporting_amount_status'='PENDING_SOURCE_LOCKED_BANK_FX_RECONCILIATION'
        AND nullif(v_component->>'payment_id','') IS NOT NULL
        AND coalesce(nullif(v_component->>'prior_reporting_amount','')::numeric,0)<0;
      v_name := v_component->>'counterparty';
      v_native_ccy := upper(btrim(coalesce(v_component->>'native_currency','')));
      IF v_component->>'type'='TRADE_PAYABLE' AND (v_native_prior>0 OR v_native_preclosed)
         AND v_name IS NOT NULL AND v_native_ccy<>'' THEN
        FOR v_bank IN
          SELECT p.id as payment_key,p.payment_id,p.payment_at,p.created_at,
                 p.bank_statement_date,p.bank_account_reference,p.bank_transaction_reference,
                 upper(btrim(p.currency::text)) as currency,
                 (line.value->>'amount')::numeric as amount,
                 p.counterparty_name,p.payment_kind::text as kind
          FROM portal_private.payments p
          JOIN LATERAL (
            SELECT a.* FROM portal_private.payment_business_attributions_v7 a
            WHERE a.payment_key=p.id AND a.source_locked=true
              AND a.authority_state='AUTHORITATIVE'
              AND a.lifecycle_state='CURRENT'
              AND a.attribution_mode='EXACT'
            ORDER BY a.effective_at DESC,a.created_at DESC LIMIT 1
          ) a ON true
          CROSS JOIN LATERAL jsonb_array_elements(coalesce(a.lines_snapshot,'[]'::jsonb)) line(value)
          WHERE line.value->>'deal_key'=v_deal_key::text
            AND line.value->>'amount_status'='EXACT'
            AND p.payment_direction::text='OUTGOING'
            AND p.payment_kind::text='COUNTERPARTY_PAYMENT'
            AND p.bank_fact_status::text='BANK_CONFIRMED'
            AND p.finance_verification_status::text='VERIFIED'
            AND p.authority_state::text IN ('CONFIRMED','VERIFIED','AUTHORITATIVE')
            AND p.lifecycle_state::text='ACTIVE'
            AND p.payment_at>v_baseline_at AND p.created_at>v_baseline_at
            AND upper(btrim(p.counterparty_name))=upper(btrim(v_name))
            AND upper(btrim(p.currency::text))=v_native_ccy
            AND (NOT v_native_preclosed OR p.payment_id=v_component->>'payment_id')
          ORDER BY p.payment_at,p.payment_id
        LOOP
          IF v_native_preclosed AND v_native_prior=0 THEN
            v_native_prior:=v_bank.amount;
          END IF;
          IF v_bank.amount<=0 OR v_native_paid+v_bank.amount>v_native_prior+0.005 THEN
            v_currency_ok:=false;
            CONTINUE;
          END IF;
          v_native_paid:=v_native_paid+v_bank.amount;
          v_has_native_payment:=true;
          v_effective_bank_time:=greatest(coalesce(v_effective_bank_time,'epoch'::timestamptz),v_bank.created_at);
          v_already_in_cash:=EXISTS (
            SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_item->'cashPaymentLines')='array'
              THEN v_item->'cashPaymentLines' ELSE '[]'::jsonb END) old_line(value)
            WHERE old_line.value->>'paymentId'=v_bank.payment_id
          );
          v_equiv:=NULL;
          SELECT c.accounting_amount INTO v_equiv
          FROM portal_private.payment_resource_chains_effective_v8 c
          WHERE c.payment_key=v_bank.payment_key AND c.deal_key=v_deal_key
            AND c.source_locked=true AND c.is_effective_execution_authority=true
            AND upper(btrim(c.accounting_currency::text))=v_accounting_ccy
          ORDER BY c.effective_at DESC,c.created_at DESC LIMIT 1;
          v_fx_source_in:=NULL;
          v_fx_source_out:=NULL;
          IF v_equiv IS NULL AND v_bank.currency=v_accounting_ccy THEN
            v_equiv:=v_bank.amount;
          END IF;
          IF v_equiv IS NULL THEN
            SELECT count(*)::int,min(fin.amount/nullif(fout.amount,0)),
                   min(fin.source_ref),min(fout.source_ref)
              INTO v_rate_count,v_rate,v_fx_source_in,v_fx_source_out
            FROM portal_private.finance_cash_operations_current_v1 fin
            JOIN portal_private.finance_cash_operations_current_v1 fout
              ON fin.source_uid=fout.source_uid
             AND fin.account_identity=fout.account_identity
             AND fin.executed_at_local=fout.executed_at_local
             AND fin.operation_date=fout.operation_date
            WHERE fin.operation_type='FX_CONVERSION' AND fin.direction='INCOMING'
              AND fout.operation_type='FX_CONVERSION' AND fout.direction='OUTGOING'
              AND fin.source_locked=true AND fout.source_locked=true
              AND fin.amount>0 AND fout.amount>0
              AND fin.operation_date=v_bank.bank_statement_date
              AND fin.account_identity=v_bank.bank_account_reference
              AND upper(btrim(fin.currency))=v_bank.currency
              AND upper(btrim(fout.currency))=v_accounting_ccy;
            IF v_rate_count=1 AND v_rate>0 THEN
              v_equiv:=v_bank.amount/v_rate;
            END IF;
          END IF;
          IF v_already_in_cash THEN
            v_equiv:=0;
            v_fx_source_in:='ALREADY_COUNTED_IN_APPROVED_CASH_LINES';
            v_fx_source_out:=NULL;
          END IF;
          IF v_equiv IS NULL THEN
            v_currency_ok:=false;
          ELSE
            v_counterparty_delta:=v_counterparty_delta+v_equiv;
            IF NOT v_already_in_cash THEN
              -- Owner-side saved payment-line values take precedence in the rendered
              -- editable "Собственник" tab. Move only a unique historical line
              -- for this verified counterparty, leaving every other owner input intact.
              v_owner_line_count:=0;
              v_owner_line_key:=NULL;
              IF jsonb_typeof(v_item->'ownerCorrection'->'payload'->'paymentLineAmounts')='object'
                 AND jsonb_typeof(v_item->'cashPaymentLines')='array' THEN
                SELECT count(*)::int,min(x.value->>'paymentId')
                  INTO v_owner_line_count,v_owner_line_key
                FROM jsonb_array_elements(v_item->'cashPaymentLines') x(value)
                WHERE upper(btrim(coalesce(x.value->>'counterparty',''))) = upper(btrim(v_name))
                  AND v_item->'ownerCorrection'->'payload'->'paymentLineAmounts' ? (x.value->>'paymentId')
                  AND coalesce(x.value->>'paymentKind','COUNTERPARTY_PAYMENT')='COUNTERPARTY_PAYMENT';
              END IF;
              v_merged_line := false;
              IF v_owner_line_count=1 AND v_owner_line_key IS NOT NULL AND v_equiv>0
                 AND nullif(v_item->'ownerCorrection'->'payload'->'paymentLineAmounts'->>v_owner_line_key,'') IS NOT NULL THEN
                -- Preserve the original canonical paymentId used by both UI tabs.
                -- Fold new verified bank payments into that single counterparty row.
                -- Source payment records remain separate in the bank audit trail.
                SELECT l.value,l.ord INTO v_legacy_line,v_line_pos
                FROM jsonb_array_elements(v_lines) WITH ORDINALITY l(value,ord)
                WHERE l.value->>'paymentId'=v_owner_line_key
                  AND upper(btrim(coalesce(l.value->>'counterparty','')))=upper(btrim(v_name))
                  AND upper(btrim(coalesce(l.value->>'currency','')))=v_accounting_ccy
                  AND upper(btrim(coalesce(l.value->>'nativeCurrency','')))=v_bank.currency
                  AND coalesce(l.value->>'paymentKind','COUNTERPARTY_PAYMENT')='COUNTERPARTY_PAYMENT'
                ORDER BY l.ord LIMIT 1;
                IF v_line_pos IS NOT NULL
                   AND nullif(v_legacy_line->>'amount','') IS NOT NULL
                   AND nullif(v_legacy_line->>'nativeAmount','') IS NOT NULL
                   AND jsonb_typeof(coalesce(v_legacy_line->'bankPaymentRefs','[]'::jsonb))='array'
                   AND NOT EXISTS (
                     SELECT 1 FROM jsonb_array_elements(coalesce(v_legacy_line->'bankPaymentRefs','[]'::jsonb)) old_ref(value)
                     WHERE old_ref.value->>'paymentId'=v_bank.payment_id
                   ) THEN
                  v_legacy_line := v_legacy_line || jsonb_build_object(
                    'amount',(v_legacy_line->>'amount')::numeric+v_equiv,
                    'nativeAmount',(v_legacy_line->>'nativeAmount')::numeric+v_bank.amount,
                    'aggregationStatus','BANK_PAYMENTS_MERGED_BY_COUNTERPARTY',
                    'authorityStatus','MIXED_CANONICAL_PLUS_BANK_FX_REFERENCE__FUNDING_TO_VERIFY',
                    'bankPaymentRefs',
                       coalesce(v_legacy_line->'bankPaymentRefs','[]'::jsonb)
                       ||jsonb_build_array(jsonb_build_object(
                         'paymentId',v_bank.payment_id,
                         'bankDocument',v_bank.bank_transaction_reference,
                         'accountingAmount',v_equiv,
                         'accountingCurrency',v_accounting_ccy,
                         'nativeAmount',v_bank.amount,
                         'nativeCurrency',v_bank.currency,
                         'fxStatus','BANK_RATE_REFERENCE__FUNDING_ALLOCATION_TO_VERIFY')));
                  v_lines:=jsonb_set(v_lines,ARRAY[(v_line_pos-1)::text],v_legacy_line,false);
                  v_owner_line_delta:=v_owner_line_delta || jsonb_build_object(
                    v_owner_line_key,
                    coalesce((v_owner_line_delta->>v_owner_line_key)::numeric,0)+v_equiv);
                  v_owner_line_patch_status:='UNIQUE_SOURCE_LOCKED_HISTORICAL_LINE';
                  v_merged_line:=true;
                END IF;
              END IF;
              IF NOT v_merged_line THEN
                -- Fail open only for line presentation; never invent mappings.
                -- The separate bank record still remains source-locked.
                v_owner_line_patch_status:='TO_VERIFY_COUNTERPARTY_AGGREGATION_MAPPING';
                v_lines:=v_lines || jsonb_build_array(jsonb_build_object(
                  'paymentId',v_bank.payment_id,'counterparty',v_name,
                  'amount',v_equiv,'currency',v_accounting_ccy,
                  'nativeAmount',v_bank.amount,'nativeCurrency',v_bank.currency,
                  'paymentKind','COUNTERPARTY_PAYMENT',
                  'source','FINANCE_BANK_CONFIRMED_DYNAMIC__SAME_DAY_BANK_FX_REFERENCE_OR_V8',
                  'authorityStatus','BANK_FACT_VERIFIED__FX_REFERENCE_NOT_FUNDING_ALLOCATION'));
              END IF;
            END IF;
          END IF;
          v_new_bank_refs:=v_new_bank_refs || jsonb_build_array(jsonb_build_object(
            'paymentId',v_bank.payment_id,'bankDocument',v_bank.bank_transaction_reference,
            'nativeAmount',v_bank.amount,'currency',v_bank.currency,
            'accountingAmount',v_equiv,'accountingCurrency',v_accounting_ccy,
            'bankFxReferenceIn',v_fx_source_in,'bankFxReferenceOut',v_fx_source_out));
        END LOOP;
        IF v_native_paid>0 THEN
          v_reporting_prior:=coalesce(nullif(v_component->>'reporting_amount','')::numeric,0);
          v_reporting_new:=v_reporting_prior*(v_native_prior-v_native_paid)/v_native_prior;
          v_open_new:=v_open_new+(v_reporting_new-v_reporting_prior);
          v_component:=v_component || jsonb_build_object(
            'native_balance',greatest(0,v_native_prior-v_native_paid),
            'reporting_amount',v_reporting_new,
            'bank_settled_native_amount',v_native_paid,
            'settlement_source','BANK_CONFIRMED_EXACT_DEAL_ATTRIBUTION',
            'source_status',case when abs(v_native_prior-v_native_paid)<0.005
                then 'SETTLED_BY_BANK__RECEIPT_NOT_PROVEN' else 'PARTIAL_BANK_SETTLEMENT' end);
          IF v_native_preclosed THEN
            v_component:=jsonb_set(v_component,'{reporting_amount_status}',
              to_jsonb('BANK_REFERENCE_FX_RECONCILED__FUNDING_ALLOCATION_TO_VERIFY'::text),true);
          ELSE
          v_new_settlements:='[]'::jsonb;
          FOR v_settlement IN SELECT y.value FROM jsonb_array_elements(v_settlements) y(value) LOOP
            IF upper(btrim(coalesce(v_settlement->>'counterparty','')))=upper(btrim(v_name))
                AND upper(btrim(coalesce(v_settlement->>'currency','')))=v_native_ccy
                AND nullif(v_settlement->>'balance_amount','') IS NOT NULL THEN
              v_settlement:=v_settlement || jsonb_build_object(
                'cash_amount',coalesce(nullif(v_settlement->>'cash_amount','')::numeric,0)+v_native_paid,
                'balance_amount',greatest(0,(v_settlement->>'balance_amount')::numeric-v_native_paid),
                'status',case when abs(v_native_prior-v_native_paid)<0.005
                   then 'BANK_SETTLED_MANAGEMENT' else 'PARTIAL_BANK_SETTLEMENT' end);
            END IF;
            v_new_settlements:=v_new_settlements || jsonb_build_array(v_settlement);
          END LOOP;
          v_settlements:=v_new_settlements;
          END IF;
        END IF;
      END IF;
      v_new_components:=v_new_components || jsonb_build_array(v_component);
    END LOOP;
    IF v_has_native_payment THEN
      FOR v_bank IN
        SELECT p.id as payment_key,p.payment_id,p.created_at,p.bank_statement_date,
               p.bank_account_reference,p.bank_transaction_reference,
               upper(btrim(p.currency::text)) as currency,
               (line.value->>'amount')::numeric as amount
        FROM portal_private.payments p
        JOIN LATERAL (
          SELECT a.* FROM portal_private.payment_business_attributions_v7 a
          WHERE a.payment_key=p.id AND a.source_locked=true
            AND a.authority_state='AUTHORITATIVE' AND a.lifecycle_state='CURRENT'
            AND a.attribution_mode='EXACT'
          ORDER BY a.effective_at DESC,a.created_at DESC LIMIT 1
        ) a ON true
        CROSS JOIN LATERAL jsonb_array_elements(coalesce(a.lines_snapshot,'[]'::jsonb)) line(value)
        WHERE line.value->>'deal_key'=v_deal_key::text
          AND line.value->>'amount_status'='EXACT'
          AND p.payment_kind::text='BANK_FEE'
          AND p.payment_direction::text='OUTGOING'
          AND p.bank_fact_status::text='BANK_CONFIRMED'
          AND p.finance_verification_status::text='VERIFIED'
          AND p.authority_state::text IN ('CONFIRMED','VERIFIED','AUTHORITATIVE')
          AND p.lifecycle_state::text='ACTIVE'
          AND p.payment_at>v_baseline_at AND p.created_at>v_baseline_at
        ORDER BY p.payment_at,p.payment_id
      LOOP
        v_already_in_cash:=(
          coalesce(v_item->'financeSourceReconciliation'->>'status','')='RECONCILED_CURRENT_FINANCE_V8'
          AND EXISTS (
            SELECT 1 FROM portal_private.payment_resource_chains_effective_v8 existing
            WHERE existing.payment_key=v_bank.payment_key AND existing.deal_key=v_deal_key
              AND existing.is_effective_execution_authority AND existing.source_locked
          )
        );
        v_equiv:=NULL;
        SELECT c.accounting_amount INTO v_equiv
          FROM portal_private.payment_resource_chains_effective_v8 c
          WHERE c.payment_key=v_bank.payment_key AND c.deal_key=v_deal_key
            AND c.source_locked=true AND c.is_effective_execution_authority=true
            AND upper(btrim(c.accounting_currency::text))=v_accounting_ccy
          ORDER BY c.effective_at DESC,c.created_at DESC LIMIT 1;
        IF v_equiv IS NULL AND v_bank.currency=v_accounting_ccy THEN v_equiv:=v_bank.amount; END IF;
        v_fx_source_in:=NULL;
        v_fx_source_out:=NULL;
        IF v_equiv IS NULL THEN
          SELECT count(*)::int,min(fin.amount/nullif(fout.amount,0)),
                  min(fin.source_ref),min(fout.source_ref)
          INTO v_rate_count,v_rate,v_fx_source_in,v_fx_source_out
          FROM portal_private.finance_cash_operations_current_v1 fin
          JOIN portal_private.finance_cash_operations_current_v1 fout
            ON fin.source_uid=fout.source_uid
           AND fin.account_identity=fout.account_identity
           AND fin.executed_at_local=fout.executed_at_local
           AND fin.operation_date=fout.operation_date
          WHERE fin.operation_type='FX_CONVERSION' AND fin.direction='INCOMING'
            AND fout.operation_type='FX_CONVERSION' AND fout.direction='OUTGOING'
            AND fin.source_locked=true AND fout.source_locked=true
            AND fin.amount>0 AND fout.amount>0
            AND fin.operation_date=v_bank.bank_statement_date
            AND fin.account_identity=v_bank.bank_account_reference
            AND upper(btrim(fin.currency))=v_bank.currency
            AND upper(btrim(fout.currency))=v_accounting_ccy;
          IF v_rate_count=1 AND v_rate>0 THEN v_equiv:=v_bank.amount/v_rate; END IF;
        END IF;
        IF v_already_in_cash THEN v_equiv:=0; END IF;
        IF v_equiv IS NULL THEN v_currency_ok:=false;
        ELSE v_fee_delta:=v_fee_delta+v_equiv; END IF;
        v_effective_bank_time:=greatest(coalesce(v_effective_bank_time,'epoch'::timestamptz),v_bank.created_at);
        v_new_bank_refs:=v_new_bank_refs || jsonb_build_array(jsonb_build_object(
          'paymentId',v_bank.payment_id,'bankDocument',v_bank.bank_transaction_reference,
          'nativeAmount',v_bank.amount,'currency',v_bank.currency,
          'accountingAmount',v_equiv,'accountingCurrency',v_accounting_ccy,
          'kind','BANK_FEE','bankFxReferenceIn',v_fx_source_in,
          'bankFxReferenceOut',v_fx_source_out));
      END LOOP;
      v_bridge:=jsonb_set(v_bridge,'{open_settlement_adjustment,components}',v_new_components,true);
      v_bridge:=jsonb_set(v_bridge,'{open_settlement_adjustment,amount}',to_jsonb(v_open_new),true);
      v_bridge:=jsonb_set(v_bridge,'{open_settlement_adjustment,status}',
        to_jsonb('BANK_RECONCILED_SOURCE_CURRENT'::text),true);
      v_item:=jsonb_set(v_item,'{settlementPositions}',v_settlements,true);
      v_item:=jsonb_set(v_item,'{ownerResultBridge}',v_bridge,true);
      IF v_item->'ownerCorrection'->'payload' IS NOT NULL
          AND (nullif(v_item->'ownerCorrection'->>'createdAt','') IS NULL
               OR v_effective_bank_time>nullif(v_item->'ownerCorrection'->>'createdAt','')::timestamptz) THEN
        v_item:=jsonb_set(v_item,'{ownerCorrection,payload,openSettlementAdjustment}',
          to_jsonb(v_open_new),true);
        IF v_currency_ok
           AND v_owner_line_patch_status='UNIQUE_SOURCE_LOCKED_HISTORICAL_LINE'
           AND jsonb_typeof(v_owner_line_delta)='object'
           AND jsonb_typeof(v_item->'ownerCorrection'->'payload'->'paymentLineAmounts')='object' THEN
          v_owner_line_updated:=v_item->'ownerCorrection'->'payload'->'paymentLineAmounts';
          FOR v_owner_line_key IN SELECT jsonb_object_keys(v_owner_line_delta) LOOP
            IF nullif(v_owner_line_updated->>v_owner_line_key,'') IS NULL THEN
              v_owner_line_patch_status:='TO_VERIFY_MISSING_OWNER_AMOUNT';
              EXIT;
            END IF;
            BEGIN
              v_owner_line_value := (v_owner_line_updated->>v_owner_line_key)::numeric
                  + (v_owner_line_delta->>v_owner_line_key)::numeric;
            EXCEPTION WHEN invalid_text_representation THEN
              v_owner_line_patch_status:='TO_VERIFY_INVALID_OWNER_AMOUNT';
              EXIT;
            END;
            v_owner_line_updated:=jsonb_set(
              v_owner_line_updated, ARRAY[v_owner_line_key],to_jsonb(v_owner_line_value),false);
          END LOOP;
          IF v_owner_line_patch_status='UNIQUE_SOURCE_LOCKED_HISTORICAL_LINE' THEN
            v_item:=jsonb_set(v_item,
              '{ownerCorrection,payload,paymentLineAmounts}',v_owner_line_updated,false);
            v_owner_line_patch_status:='BANK_MERGED_IN_SINGLE_COUNTERPARTY_ROW';
          END IF;
        END IF;
      END IF;
      IF v_currency_ok THEN
        v_new_cashout:=v_old_cashout+v_counterparty_delta;
        v_new_fee:=v_old_fee+v_fee_delta;
        v_new_net:=v_old_received-v_new_cashout-v_new_fee;
        v_new_result:=v_new_net+v_open_new;
        v_cf:=v_cf || jsonb_build_object(
          'counterpartyCashOut',v_new_cashout,'bankFees',v_new_fee,
          'totalCashOut',v_new_cashout+v_new_fee,'netCashFlow',v_new_net,
          'semantics','BANK_SOURCE_CURRENT_MANAGEMENT_FX_REFERENCE',
          'fxSemantics','SAME_DAY_VERIFIED_BANK_RATE_NOT_EXACT_CONSUMPTION_ALLOCATION');
        v_bridge:=jsonb_set(v_bridge,'{actual_financial_result}',
          jsonb_build_object('amount',v_new_result,'currency',v_accounting_ccy,
            'formula','RECALCULATED_BANK_CASH_FLOW_PLUS_RECALCULATED_NATIVE_SETTLEMENT',
            'status','MANAGEMENT_REFERENCE_FX__EXACT_ALLOCATION_TO_VERIFY'),true);
        v_item:=v_item || jsonb_build_object(
          'cashFlow',v_cf,'cashPaymentLines',v_lines,'ownerResultBridge',v_bridge);
      ELSE
        v_bridge:=jsonb_set(v_bridge,'{actual_financial_result}',
          jsonb_build_object('amount',NULL,'currency',v_accounting_ccy,
            'status','TO_VERIFY_MISSING_SOURCE_LOCKED_FX',
            'formula','PENDING_BANK_FX_FOR_NEW_SETTLEMENT'),true);
        v_item:=v_item || jsonb_build_object('ownerResultBridge',v_bridge);
      END IF;
      v_item:=v_item || jsonb_build_object(
        'liveBankReconciliation',jsonb_build_object(
          'status',case when v_currency_ok then 'BANK_MATCHED_FX_REFERENCE' else 'BANK_MATCHED_FX_TO_VERIFY' end,
          'nativeSettlementStatus','BANK_SETTLED_CURRENT',
          'sourceVersion','FINANCE_AGENT_LIVE_BANK_RECONCILIATION_V3_COUNTERPARTY_MERGED',
          'financeProposalRecordId',v_proposal_id,
          'operationsApprovalRecordId',v_approval_id,
          'baseSourceCreatedAt',v_baseline_at,
          'lastBankImportAt',v_effective_bank_time,
          'currency',v_accounting_ccy,
          'reportingFxIsExactFundingAllocation',false,
          'ownerCorrectionLineReconciliation',v_owner_line_patch_status,
          'bankPayments',v_new_bank_refs,
          'autoRefresh','READ_MODEL_DERIVED_ON_EACH_REQUEST',
          'signedAgentPayableUnchanged',true,
          'contractualAccrualUnchanged',true));
      v_item:=jsonb_set(v_item,'{openSettlementSourceCurrentness,status}',
        to_jsonb('BANK_SOURCE_NEWER_THAN_APPROVED_BRIDGE'::text),true);
    END IF;
    v_output:=v_output || jsonb_build_array(v_item);
  END LOOP;
  RETURN p_workspace || jsonb_build_object(
    'deals',v_output,
    'liveBankReconciliationContract','AUTO_SOURCE_CURRENT_BANK_WITH_FX_REFERENCE_V1');
END
$agent_bank$;
REVOKE ALL ON FUNCTION portal_private.agent_rewards_live_bank_overlay_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION portal_private.agent_rewards_live_bank_overlay_v1(jsonb) FROM anon;
REVOKE ALL ON FUNCTION portal_private.agent_rewards_live_bank_overlay_v1(jsonb) FROM authenticated;
