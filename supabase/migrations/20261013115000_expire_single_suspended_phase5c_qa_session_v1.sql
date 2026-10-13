-- RONA Trade: expire one non-expiring 2026-08-13 QA_PHASE5C session.
-- P1 exact single-session IAM correction, no deletions or business changes.
-- The QA account is SUSPENDED; no active portal/staff role or business grant.
-- Do not touch other QA sources, ADMIN_PORTAL, or authenticated active users.
BEGIN;
DO $phase5c$
DECLARE
  v_session uuid;
  v_auth uuid;
  n int;
  updated_count int;
BEGIN
  PERFORM 1 FROM portal_private.portal_users pu
  WHERE pu.source_system='QA_PHASE5C'
    AND pu.status='SUSPENDED' AND pu.lifecycle_state='SUSPENDED'
  FOR UPDATE;

  SELECT count(*),(array_agg(s.id))[1],(array_agg(pu.auth_user_id))[1]
    INTO n,v_session,v_auth
  FROM portal_private.portal_users pu
  JOIN auth.users au ON au.id=pu.auth_user_id
  JOIN auth.sessions s ON s.user_id=pu.auth_user_id
  WHERE pu.source_system='QA_PHASE5C'
    AND pu.status='SUSPENDED' AND pu.lifecycle_state='SUSPENDED'
    AND starts_with(pu.login_name,'qa_')
    AND pu.source_timestamp<'2026-08-20'::timestamptz
    AND (au.last_sign_in_at IS NULL OR
         au.last_sign_in_at<'2026-09-01'::timestamptz)
    AND s.not_after IS NULL;
  IF n<>1 OR v_session IS NULL OR v_auth IS NULL THEN
    RAISE EXCEPTION 'QA_PHASE5C_EXACT_ONE_SUSPENDED_SESSION_REQUIRED count=%',n;
  END IF;
  IF EXISTS (SELECT 1 FROM portal_private.portal_users pu
             WHERE pu.auth_user_id=v_auth
               AND (pu.source_system<>'QA_PHASE5C' OR
                    pu.status<>'SUSPENDED' OR
                    pu.lifecycle_state<>'SUSPENDED'))
     OR (SELECT count(*) FROM portal_private.portal_users pu
         WHERE pu.auth_user_id=v_auth)<>1
     OR EXISTS (
       SELECT 1 FROM portal_private.portal_users pu
       JOIN portal_private.portal_user_roles r ON r.user_id=pu.id
       WHERE pu.auth_user_id=v_auth AND r.status='ACTIVE')
     OR EXISTS (
       SELECT 1 FROM portal_private.portal_users pu
       JOIN portal_private.staff_user_roles r ON r.user_id=pu.id
       WHERE pu.auth_user_id=v_auth AND r.status='ACTIVE')
     OR EXISTS (
       SELECT 1 FROM portal_private.portal_users pu
       JOIN portal_private.client_user_bindings r ON r.user_id=pu.id
       WHERE pu.auth_user_id=v_auth AND r.status='ACTIVE')
     OR EXISTS (
       SELECT 1 FROM portal_private.portal_users pu
       JOIN portal_private.agent_user_bindings r ON r.user_id=pu.id
       WHERE pu.auth_user_id=v_auth AND r.status='ACTIVE')
     OR EXISTS (
       SELECT 1 FROM portal_private.portal_users pu
       JOIN portal_private.client_user_deal_grants r ON r.user_id=pu.id
       WHERE pu.auth_user_id=v_auth AND r.status='ACTIVE')
  THEN
    RAISE EXCEPTION 'QA_PHASE5C_ACCOUNT_OR_BUSINESS_SCOPE_DRIFT';
  END IF;

  UPDATE auth.sessions s
  SET not_after=clock_timestamp()-interval '1 second',
      updated_at=clock_timestamp()
  WHERE s.id=v_session AND s.user_id=v_auth AND s.not_after IS NULL;
  GET DIAGNOSTICS updated_count=ROW_COUNT;
  IF updated_count<>1 THEN
    RAISE EXCEPTION 'QA_PHASE5C_SESSION_UPDATE_COUNT_%',updated_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.sessions s
    JOIN portal_private.portal_users pu ON pu.auth_user_id=s.user_id
    WHERE pu.source_system='QA_PHASE5C'
      AND pu.status='SUSPENDED' AND pu.lifecycle_state='SUSPENDED'
      AND (s.not_after IS NULL OR s.not_after>now())
  ) THEN
    RAISE EXCEPTION 'QA_PHASE5C_SUSPENDED_SESSION_POSTFLIGHT_FAILED';
  END IF;
  RAISE NOTICE 'QA_PHASE5C_SINGLE_SESSION_EXPIRED=PASS count=1';
END $phase5c$;
COMMIT;
