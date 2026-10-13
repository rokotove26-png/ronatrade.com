-- RONA Trade P0: quarantine precisely 33 stale QA_GITHUB_OIDC_PR462
-- Admin test accounts. Source evidence 2026-10-13: created 2026-09-12..17,
-- 33 ADMIN role grants and 33 auth.sessions with NULL not_after.
-- This migration does not touch Owner, Treasury, business users, business
-- records, other QA cohorts, or auth.users. No hard deletion is performed.
-- Intended fail-closed rollback point: retained role/user/session rows;
-- re-provision temporary QA through a newly authorized GitHub OIDC run,
-- never reactivate these historical QA ADMIN role grants automatically.
BEGIN;
DO $quarantine$
DECLARE
  n_source integer;
  n_safe integer;
  n_admin_roles integer;
  n_other_roles integer;
  n_business_bindings integer;
  n_staff_roles integer;
  n_shared_auth integer;
  n_sessions integer;
  n_changed integer;
  n_expired integer;
BEGIN
  -- Row locks protect the exact target cohort while preflight is evaluated.
  PERFORM 1 FROM portal_private.portal_users pu
    WHERE pu.source_system='QA_GITHUB_OIDC_PR462'
      AND pu.status='ACTIVE' AND pu.lifecycle_state='ACTIVE'
    FOR UPDATE;
  SELECT count(*) INTO n_source
    FROM portal_private.portal_users pu
    WHERE pu.source_system='QA_GITHUB_OIDC_PR462'
      AND pu.status='ACTIVE' AND pu.lifecycle_state='ACTIVE';
  SELECT count(*) INTO n_safe
    FROM portal_private.portal_users pu
    JOIN auth.users au ON au.id=pu.auth_user_id
    WHERE pu.source_system='QA_GITHUB_OIDC_PR462'
      AND pu.status='ACTIVE' AND pu.lifecycle_state='ACTIVE'
      AND starts_with(pu.login_name,'qa_pr462_')
      AND au.email LIKE 'qa-pr462-%@example.invalid'
      AND starts_with(pu.source_version,'RUN_')
      AND pu.source_timestamp < '2026-09-20'::timestamptz;
  SELECT count(*) FILTER (WHERE pr.role='ADMIN' AND pr.status='ACTIVE'),
         count(*) FILTER (WHERE pr.role<>'ADMIN' AND pr.status='ACTIVE')
    INTO n_admin_roles,n_other_roles
    FROM portal_private.portal_user_roles pr
    JOIN portal_private.portal_users pu ON pu.id=pr.user_id
    WHERE pu.source_system='QA_GITHUB_OIDC_PR462'
      AND pu.status='ACTIVE' AND pu.lifecycle_state='ACTIVE';
  SELECT
    (SELECT count(*) FROM portal_private.client_user_bindings cb
      JOIN portal_private.portal_users pu ON pu.id=cb.user_id
      WHERE pu.source_system='QA_GITHUB_OIDC_PR462' AND pu.status='ACTIVE'
        AND cb.status='ACTIVE')
    + (SELECT count(*) FROM portal_private.agent_user_bindings ab
      JOIN portal_private.portal_users pu ON pu.id=ab.user_id
      WHERE pu.source_system='QA_GITHUB_OIDC_PR462' AND pu.status='ACTIVE'
        AND ab.status='ACTIVE')
    INTO n_business_bindings;
  SELECT count(*) INTO n_staff_roles
    FROM portal_private.staff_user_roles sr
    JOIN portal_private.portal_users pu ON pu.id=sr.user_id
    WHERE pu.source_system='QA_GITHUB_OIDC_PR462'
      AND pu.status='ACTIVE' AND sr.status='ACTIVE';
  SELECT count(*) INTO n_shared_auth
    FROM portal_private.portal_users pu
    JOIN portal_private.portal_users other
      ON other.auth_user_id=pu.auth_user_id AND other.id<>pu.id
    WHERE pu.source_system='QA_GITHUB_OIDC_PR462' AND pu.status='ACTIVE';
  SELECT count(*) INTO n_sessions
    FROM auth.sessions s
    JOIN portal_private.portal_users pu ON pu.auth_user_id=s.user_id
    WHERE pu.source_system='QA_GITHUB_OIDC_PR462'
      AND pu.status='ACTIVE' AND pu.lifecycle_state='ACTIVE'
      AND s.not_after IS NULL;
  IF n_source<>33 OR n_safe<>33 OR n_admin_roles<>33 OR
     n_other_roles<>0 OR n_business_bindings<>0 OR n_staff_roles<>0 OR
     n_shared_auth<>0 OR n_sessions<>33 THEN
    RAISE EXCEPTION
      'PR462_QA_QUARANTINE_SOURCE_LOCK_FAIL source=% safe=% admin=% other=% bindings=% staff=% shared=% sessions=%',
       n_source,n_safe,n_admin_roles,n_other_roles,n_business_bindings,
       n_staff_roles,n_shared_auth,n_sessions;
  END IF;

  -- Expire only the sessions attached to the locked test cohort.
  UPDATE auth.sessions s
    SET not_after=clock_timestamp()-interval '1 second',
        updated_at=clock_timestamp()
    FROM portal_private.portal_users pu
    WHERE s.user_id=pu.auth_user_id
      AND pu.source_system='QA_GITHUB_OIDC_PR462'
      AND pu.status='ACTIVE' AND pu.lifecycle_state='ACTIVE'
      AND s.not_after IS NULL;
  GET DIAGNOSTICS n_changed=ROW_COUNT;
  IF n_changed<>33 THEN RAISE EXCEPTION 'PR462_SESSION_EXPIRE_COUNT_%',n_changed; END IF;

  -- Revoke the temporary Admin role; leave all real Admin grants unchanged.
  UPDATE portal_private.portal_user_roles pr
    SET status='REVOKED',revoked_at=clock_timestamp(),
        reason='POST_ACCEPTANCE_STALE_PR462_QA_ADMIN_QUARANTINE',
        updated_at=clock_timestamp()
    FROM portal_private.portal_users pu
    WHERE pr.user_id=pu.id AND pr.role='ADMIN' AND pr.status='ACTIVE'
      AND pu.source_system='QA_GITHUB_OIDC_PR462'
      AND pu.status='ACTIVE' AND pu.lifecycle_state='ACTIVE';
  GET DIAGNOSTICS n_changed=ROW_COUNT;
  IF n_changed<>33 THEN RAISE EXCEPTION 'PR462_ADMIN_REVOKE_COUNT_%',n_changed; END IF;

  -- Archive only the stale QA cohort, retaining audit and Auth linkage.
  UPDATE portal_private.portal_users pu
    SET status='REVOKED',lifecycle_state='ARCHIVED',
        revoked_at=clock_timestamp(),suspended_at=NULL,
        updated_at=clock_timestamp()
    WHERE pu.source_system='QA_GITHUB_OIDC_PR462'
      AND pu.status='ACTIVE' AND pu.lifecycle_state='ACTIVE'
      AND starts_with(pu.login_name,'qa_pr462_');
  GET DIAGNOSTICS n_changed=ROW_COUNT;
  IF n_changed<>33 THEN RAISE EXCEPTION 'PR462_USER_ARCHIVE_COUNT_%',n_changed; END IF;

  SELECT count(*) INTO n_expired
    FROM auth.sessions s
    JOIN portal_private.portal_users pu ON pu.auth_user_id=s.user_id
    WHERE pu.source_system='QA_GITHUB_OIDC_PR462'
      AND pu.status='REVOKED' AND pu.lifecycle_state='ARCHIVED'
      AND starts_with(pu.login_name,'qa_pr462_')
      AND s.not_after<clock_timestamp();
  IF n_expired<>33
     OR EXISTS (SELECT 1 FROM portal_private.portal_users
                WHERE source_system='QA_GITHUB_OIDC_PR462' AND status='ACTIVE')
     OR EXISTS (SELECT 1 FROM portal_private.portal_user_roles pr
                JOIN portal_private.portal_users pu ON pu.id=pr.user_id
                WHERE pu.source_system='QA_GITHUB_OIDC_PR462'
                  AND pr.role='ADMIN' AND pr.status='ACTIVE') THEN
    RAISE EXCEPTION 'PR462_QA_QUARANTINE_POSTFLIGHT_FAIL expired=%',n_expired;
  END IF;
  RAISE NOTICE 'PR462_QA_ADMIN_QUARANTINE_PASS accounts=33 roles=33 sessions=33';
END $quarantine$;
COMMIT;
