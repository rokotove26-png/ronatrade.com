# PR #462 preview Finance backend rollback evidence

Captured before any preview-backend overwrite on 2026-09-12.

Reusable non-production function slot selected only after the dedicated preview function deployment failed because the Supabase project had reached its Edge Function quota:

- slug: `rona-admin-source-eval-candidate-20260817`
- status: `ACTIVE`
- version: `5`
- `verify_jwt=true`
- bundle SHA-256: `257bffc8baf61f5086440450d8faf4f3d5bbe056ffcd6787854c333e8d4b10e8`
- previous entrypoint body: `Deno.serve(()=>new Response(JSON.stringify({ok:false,state:'RUNTIME_RETIRED_PRE_OWNER_FINAL_ACCEPTANCE'}),{status:410,headers:{'content-type':'application/json','cache-control':'no-store'}}));`

Repository code search returned no current reference to this exact slug. The function is therefore a retired non-production candidate slot, not a production Finance authority.

PR #462 preview may route **only** `*.rona-trade-public.pages.dev` `/admin/ai-sync` traffic to this slot. Production/shared hosts must continue to use `rona-owner-ai-sync` unchanged.

Rollback: restore the exact version-5 retired 410 entrypoint above with `verify_jwt=true`.

No production deployment, schema/RLS mutation, business-data mutation, auth weakening, frontend fallback, or QA fixture is authorized by this reuse.