-- Agent CP PDF preview calls pgcrypto digest() from a SECURITY DEFINER function.
-- Supabase installs pgcrypto in the extensions schema; the function's fixed
-- search_path previously omitted that schema, causing:
--   function digest(bytea, unknown) does not exist
-- when Owner opened the staged canonical PDF.
--
-- Keep the function body immutable here and make pgcrypto resolvable on replay.
-- Production also qualifies the call as extensions.digest(...).

alter function public.owner_agent_cp_owner_gate_material(uuid)
  set search_path = pg_catalog, public, portal_private, auth, extensions;
