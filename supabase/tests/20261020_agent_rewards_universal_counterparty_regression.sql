-- Regression contract. Run against a Supabase database after every Agent Rewards
-- source change. No tables or payment events are modified.
DO $agent_rewards_regression$
DECLARE
  original jsonb := '{
    "deals":[
      {"dealId":"DEAL-2099-FUTURE-A",
       "cashPaymentLines":[
        {"paymentId":"A-1","counterparty":"SUPPLIER A","canonicalCounterpartyId":"C:A","counterpartyResolutionStatus":"RESOLVED","paymentKind":"COUNTERPARTY_PAYMENT","amount":100,"currency":"USD","nativeAmount":9000,"nativeCurrency":"RUB"},
        {"paymentId":"A-2","counterparty":"SUPPLIER A","canonicalCounterpartyId":"C:A","counterpartyResolutionStatus":"RESOLVED","paymentKind":"COUNTERPARTY_PAYMENT","amount":25,"currency":"USD","nativeAmount":2000,"nativeCurrency":"RUB"},
        {"paymentId":"A-FEE","counterparty":"SUPPLIER A","canonicalCounterpartyId":"C:A","counterpartyResolutionStatus":"RESOLVED","paymentKind":"BANK_FEE","amount":2,"currency":"USD","nativeAmount":180,"nativeCurrency":"RUB"}],
       "ownerCorrection":{"payload":{"paymentLineAmounts":{"A-1":101.25}}}
      },
      {"dealId":"DEAL-2099-FUTURE-B",
       "cashPaymentLines":[{"paymentId":"B-1","counterparty":"SUPPLIER A","canonicalCounterpartyId":"C:A","counterpartyResolutionStatus":"RESOLVED","paymentKind":"COUNTERPARTY_PAYMENT","amount":8,"currency":"USD","nativeAmount":720,"nativeCurrency":"RUB"}]},
      {"dealId":"DEAL-2099-UNRESOLVED",
       "cashPaymentLines":[
        {"paymentId":"C-1","counterparty":"COMMON NAME","counterpartyResolutionStatus":"UNRESOLVED","paymentKind":"COUNTERPARTY_PAYMENT","amount":10,"currency":"USD","nativeAmount":900,"nativeCurrency":"RUB"},
        {"paymentId":"C-2","counterparty":"COMMON NAME","counterpartyResolutionStatus":"UNRESOLVED","paymentKind":"COUNTERPARTY_PAYMENT","amount":15,"currency":"USD","nativeAmount":1200,"nativeCurrency":"RUB"}]},
      {"dealId":"DEAL-2099-MULTICURRENCY",
       "cashPaymentLines":[
        {"paymentId":"D-1","counterparty":"SUPPLIER D","canonicalCounterpartyId":"C:D","counterpartyResolutionStatus":"RESOLVED","paymentKind":"COUNTERPARTY_PAYMENT","amount":50,"currency":"USD","nativeAmount":4300,"nativeCurrency":"RUB"},
        {"paymentId":"D-2","counterparty":"SUPPLIER D","canonicalCounterpartyId":"C:D","counterpartyResolutionStatus":"RESOLVED","paymentKind":"COUNTERPARTY_PAYMENT","amount":50,"currency":"EUR","nativeAmount":4100,"nativeCurrency":"RUB"}]}
    ]}'::jsonb;
  merged jsonb;
  repeat_merge jsonb;
  appended jsonb;
  next_merge jsonb;
BEGIN
  merged := portal_private.agent_rewards_group_cash_lines_v1(original);
  repeat_merge := portal_private.agent_rewards_group_cash_lines_v1(merged);
  IF merged IS DISTINCT FROM repeat_merge THEN RAISE EXCEPTION 'FAIL: initial grouping not idempotent'; END IF;
  IF jsonb_array_length(merged->'deals'->0->'cashPaymentLines')<>2 THEN RAISE EXCEPTION 'FAIL: payer still split or fee merged'; END IF;
  IF (merged->'deals'->0->'cashPaymentLines'->0->>'amount')::numeric<>125 THEN RAISE EXCEPTION 'FAIL: USD sum'; END IF;
  IF (merged->'deals'->0->'cashPaymentLines'->0->>'nativeAmount')::numeric<>11000 THEN RAISE EXCEPTION 'FAIL: RUB sum'; END IF;
  IF (merged->'deals'->0->'ownerCorrection'->'payload'->'paymentLineAmounts'->>'A-1')::numeric<>126.25 THEN RAISE EXCEPTION 'FAIL: saved owner override'; END IF;
  IF merged->'deals'->0->'ownerCorrection'->'payload'->'paymentLineAmounts' ? 'A-2' THEN RAISE EXCEPTION 'FAIL: obsolete owner key'; END IF;
  IF jsonb_array_length(merged->'deals'->1->'cashPaymentLines')<>1 THEN RAISE EXCEPTION 'FAIL: cross-deal grouping'; END IF;
  IF jsonb_array_length(merged->'deals'->2->'cashPaymentLines')<>2 THEN RAISE EXCEPTION 'FAIL: unresolved identity silently grouped'; END IF;
  IF (merged->'deals'->2->'counterpartyPaymentGrouping'->>'rowsPendingSourceVerification')::int<>2 THEN RAISE EXCEPTION 'FAIL: missing source exception'; END IF;
  IF jsonb_array_length(merged->'deals'->3->'cashPaymentLines')<>2 THEN RAISE EXCEPTION 'FAIL: different currencies grouped'; END IF;
  IF (merged->'deals'->0->'counterpartyPaymentGrouping'->>'rowsPendingSourceVerification')::int<>0 THEN RAISE EXCEPTION 'FAIL: bank fee falsely marked unresolved'; END IF;
  appended := jsonb_set(merged,'{deals,0,cashPaymentLines}',
    merged->'deals'->0->'cashPaymentLines' ||
    '[{"paymentId":"A-3","counterparty":"SUPPLIER A","canonicalCounterpartyId":"C:A","counterpartyResolutionStatus":"RESOLVED","paymentKind":"COUNTERPARTY_PAYMENT","amount":5,"currency":"USD","nativeAmount":400,"nativeCurrency":"RUB"}]'::jsonb);
  next_merge := portal_private.agent_rewards_group_cash_lines_v1(appended);
  IF jsonb_array_length(next_merge->'deals'->0->'cashPaymentLines')<>2 THEN RAISE EXCEPTION 'FAIL: later payment split again'; END IF;
  IF (next_merge->'deals'->0->'cashPaymentLines'->0->>'amount')::numeric<>130 THEN RAISE EXCEPTION 'FAIL: later payment double counted'; END IF;
  IF (next_merge->'deals'->0->'ownerCorrection'->'payload'->'paymentLineAmounts'->>'A-1')::numeric<>131.25 THEN RAISE EXCEPTION 'FAIL: later manual sum'; END IF;
  IF portal_private.agent_rewards_group_cash_lines_v1(next_merge) IS DISTINCT FROM next_merge THEN RAISE EXCEPTION 'FAIL: second future event replay'; END IF;
  RAISE NOTICE 'PASS: future deals, repeat imports, owner lines, bank fees, identities, currencies, source checks, idempotency';
END
$agent_rewards_regression$;