-- RONA Trade P1 IAM hygiene: source-locked historical QA role/session cleanup.
-- Exact 2026-10-13 catalog: 3 REVOKED/ARCHIVED RADIO QA users
-- with no Auth link but ACTIVE ADMIN + qa_only OPERATIONS_DIRECTOR grants;
-- 6 SUSPENDED Issue430 QA and 1 SUSPENDED PR462 QA with unbounded
-- Auth sessions and no active roles, staff roles or business bindings.
-- Do NOT update ADMIN_PORTAL, QA_PHASE5C, human/business users or auth.users.
-- Security compensation: never re-activate retired QA role/session grants;
-- provision newly authorized, ephemeral QA identities if future tests need them.
BEGIN;
DO $cleanup$
DECLARE
  radio_users uuid[];
  oidc_session_ids uuid[];
  oidc_auth_users uuid[];
  radio_count integer;
  radio_admin_count integer;
  radio_staff_count integer;
  oidc_count integer;
  issue430_count integer;
  pr462_count integer;
  oidc_unique_users integer;
  conflict_count integer;
  changed_count integer;
BEGIN
  -- Lock the two cohorts before validating exact source and role conditions.
  PERFORM 1 FROM portal_private.portal_users pu
  WHERE
    (pu.source_system='QA_GITHUB_OIDC_RADIO_STAGE2A'
     AND pu.status='REVOKED' AND pu.lifecycle_state='ARCHIVED'
     AND pu.auth_user_id IS NULL
     AND starts_with(pu.login_name,'qa_radio_stage2a_')
     AND starts_with(pu.source_version,'RUN_')
     AND pu.source_timestamp<'2026-09-25'::timestamptz)
    OR
    (pu.source_system IN ('QA_GITHUB_OIDC_ISSUE430','QA_GITHUB_OIDC_PR462')
     AND pu.status='SUSPENDED' AND pu.lifecycle_state='SUSPENDED'
     AND starts_with(pu.source_version,'RUN_'))
  FOR UPDATE;

  SELECT array_agg(pu.id ORDER BY pu.id),count(*)::int
    INTO radio_users,radio_count
  FROM portal_private.portal_users pu
  WHERE pu.source_system='QA_GITHUB_OIDC_RADIO_STAGE2A'
    AND pu.status='REVOKED' AND pu.lifecycle_state='ARCHIVED'
    AND pu.auth_user_id IS NULL
    AND starts_with(pu.login_name,'qa_radio_stage2a_')
    AND starts_with(pu.source_version,'RUN_')
    AND pu.source_timestamp<'2026-09-25'::timestamptz
    AND EXISTS (SELECT 1 FROM portal_private.portal_user_roles pr
                WHERE pr.user_id=pu.id AND pr.role='ADMIN' AND pr.status='ACTIVE');
  IF radio_count<>3 OR radio_users IS NULL THEN
    RAISE EXCEPTION 'RADIO_QA_ORPHAN_USER_SOURCE_LOCK_%',radio_count;
  END IF;

  SELECT count(*)::int INTO radio_admin_count
  FROM portal_private.portal_user_roles pr
  WHERE pr.user_id=ANY(radio_users) AND pr.role='ADMIN' AND pr.status='ACTIVE'
    AND pr.revoked_at IS NULL;
  SELECT count(*)::int INTO radio_staff_count
  FROM portal_private.staff_user_roles sr
  WHERE sr.user_id=ANY(radio_users) AND sr.status='ACTIVE'
    AND sr.functional_role='OPERATIONS_DIRECTOR'
    AND sr.qa_only=true AND sr.revoked_at IS NULL;
  IF radio_admin_count<>3 OR radio_staff_count<>3 OR
     EXISTS (SELECT 1 FROM portal_private.portal_user_roles pr
             WHERE pr.user_id=ANY(radio_users)
               AND pr.status='ACTIVE' AND pr.role<>'ADMIN') OR
     EXISTS (SELECT 1 FROM portal_private.staff_user_roles sr
             WHERE sr.user_id=ANY(radio_users) AND sr.status='ACTIVE'
               AND (sr.functional_role<>'OPERATIONS_DIRECTOR' OR sr.qa_only IS DISTINCT FROM true)) OR
     EXISTS (SELECT 1 FROM portal_private.client_user_bindings cb
             WHERE cb.user_id=ANY(radio_users) AND cb.status='ACTIVE') OR
     EXISTS (SELECT 1 FROM portal_private.agent_user_bindings ab
             WHERE ab.user_id=ANY(radio_users) AND ab.status='ACTIVE') OR
     EXISTS (SELECT 1 FROM portal_private.client_user_deal_grants dg
             WHERE dg.user_id=ANY(radio_users) AND dg.status='ACTIVE')
  THEN
    RAISE EXCEPTION 'RADIO_QA_ORPHAN_PERMISSIONS_SOURCE_LOCK admin=% staff=%',
      radio_admin_count,radio_staff_count;
  END IF;

  SELECT array_agg(s.id ORDER BY s.id),
         array_agg(pu.auth_user_id ORDER BY s.id),
         count(*)::int,
         count(*) FILTER (WHERE pu.source_system='QA_GITHUB_OIDC_ISSUE430')::int,
         count(*) FILTER (WHERE pu.source_system='QA_GITHUB_OIDC_PR462')::int,
         count(DISTINCT pu.id)::int
    INTO oidc_session_ids,oidc_auth_users,oidc_count,
         issue430_count,pr462_count,oidc_unique_users
  FROM portal_private.portal_users pu
  JOIN auth.users au ON au.id=pu.auth_user_id
  JOIN auth.sessions s ON s.user_id=pu.auth_user_id
  WHERE pu.status='SUSPENDED' AND pu.lifecycle_state='SUSPENDED'
    AND pu.source_system IN ('QA_GITHUB_OIDC_ISSUE430','QA_GITHUB_OIDC_PR462')
    AND au.email LIKE '%@example.invalid'
    AND starts_with(pu.source_version,'RUN_')
    AND pu.source_timestamp<'2026-09-25'::timestamptz
    AND ((pu.source_system='QA_GITHUB_OIDC_ISSUE430'
          AND starts_with(pu.login_name,'qa_issue430_')) OR
         (pu.source_system='QA_GITHUB_OIDC_PR462'
          AND starts_with(pu.login_name,'qa_pr462_')))
    AND s.not_after IS NULL;
  IF oidc_count<>7 OR issue430_count<>6 OR pr462_count<>1
     OR oidc_unique_users<>7 OR oidc_session_ids IS NULL THEN
    RAISE EXCEPTION 'OIDC_SUSPENDED_QA_SESSION_SOURCE_LOCK total=% issue430=% pr462=% unique=%',
      oidc_count,issue430_count,pr462_count,oidc_unique_users;
  END IF;

  SELECT count(*)::int INTO conflict_count
  FROM portal_private.portal_users pu
  WHERE pu.auth_user_id=ANY(oidc_auth_users)
    AND (pu.status<>'SUSPENDED' OR
         pu.source_system NOT IN ('QA_GITHUB_OIDC_ISSUE430','QA_GITHUB_OIDC_PR462'));
  IF conflict_count<>0 OR
     EXISTS (SELECT 1 FROM portal_private.portal_user_roles pr
             JOIN portal_private.portal_users pu ON pu.id=pr.user_id
             WHERE pu.auth_user_id=ANY(oidc_auth_users) AND pr.status='ACTIVE') OR
     EXISTS (SELECT 1 FROM portal_private.staff_user_roles sr
             JOIN portal_private.portal_users pu ON pu.id=sr.user_id
             WHERE pu.auth_user_id=ANY(oidc_auth_users) AND sr.status='ACTIVE') OR
     EXISTS (SELECT 1 FROM portal_private.client_user_bindings cb
             JOIN portal_private.portal_users pu ON pu.id=cb.user_id
             WHERE pu.auth_user_id=ANY(oidc_auth_users) AND cb.status='ACTIVE') OR
     EXISTS (SELECT 1 FROM portal_private.agent_user_bindings ab
             JOIN portal_private.portal_users pu ON pu.id=ab.user_id
             WHERE pu.auth_user_id=ANY(oidc_auth_users) AND ab.status='ACTIVE') OR
     EXISTS (SELECT 1 FROM portal_private.client_user_deal_grants dg
             JOIN portal_private.portal_users pu ON pu.id=dg.user_id
             WHERE pu.auth_user_id=ANY(oidc_auth_users) AND dg.status='ACTIVE') OR
     (SELECT count(*)::int FROM portal_private.portal_users pu
      WHERE pu.auth_user_id=ANY(oidc_auth_users))<>7
  THEN
    RAISE EXCEPTION 'OIDC_SUSPENDED_QA_OTHER_ROLE_OR_AUTH_LINK_SOURCE_LOCK';
  END IF;

  UPDATE portal_private.staff_user_roles sr
    SET status='REVOKED',revoked_at=clock_timestamp(),
        reason='POST_ACCEPTANCE_RADIO_QA_ORPHAN_STAFF_ROLE_RETIREMENT',
        updated_at=clock_timestamp()
    WHERE sr.user_id=ANY(radio_users) AND sr.status='ACTIVE'
      AND sr.qa_only=true AND sr.functional_role='OPERATIONS_DIRECTOR';
  GET DIAGNOSTICS changed_count=ROW_COUNT;
  IF changed_count<>3 THEN RAISE EXCEPTION 'RADIO_STAFF_REVOKE_COUNT_%',changed_count; END IF;

  UPDATE portal_private.portal_user_roles pr
    SET status='REVOKED',revoked_at=clock_timestamp(),
        reason='POST_ACCEPTANCE_RADIO_QA_ORPHAN_ADMIN_ROLE_RETIREMENT',
        updated_at=clock_timestamp()
    WHERE pr.user_id=ANY(radio_users) AND pr.role='ADMIN' AND pr.status='ACTIVE';
  GET DIAGNOSTICS changed_count=ROW_COUNT;
  IF changed_count<>3 THEN RAISE EXCEPTION 'RADIO_ADMIN_REVOKE_COUNT_%',changed_count; END IF;

  UPDATE auth.sessions s
    SET not_after=clock_timestamp()-interval '1 second',
        updated_at=clock_timestamp()
    WHERE s.id=ANY(oidc_session_ids) AND s.not_after IS NULL
      AND s.user_id=ANY(oidc_auth_users);
  GET DIAGNOSTICS changed_count=ROW_COUNT;
  IF changed_count<>7 THEN RAISE EXCEPTION 'OIDC_SESSION_EXPIRE_COUNT_%',changed_count; END IF;

  IF EXISTS (SELECT 1 FROM portal_private.portal_user_roles pr
             WHERE pr.user_id=ANY(radio_users) AND pr.role='ADMIN'
               AND pr.status='ACTIVE')
     OR EXISTS (SELECT 1 FROM portal_private.staff_user_roles sr
                WHERE sr.user_id=ANY(radio_users) AND sr.status='ACTIVE')
     OR EXISTS (SELECT 1 FROM auth.sessions s
                WHERE s.id=ANY(oidc_session_ids)
                  AND (s.not_after IS NULL OR s.not_after>clock_timestamp()))
  THEN
    RAISE EXCEPTION 'QA_ORPHAN_AND_SUSPENDED_SESSION_POSTFLIGHT_FAIL';
  END IF;
  RAISE NOTICE 'QA_IAM_HYGIENE_PASS radio_admin=3 radio_staff=3 suspended_oidc_sessions=7';
END $cleanup$;
COMMIT;
