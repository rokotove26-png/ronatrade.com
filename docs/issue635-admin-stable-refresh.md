# Issue #635 — Admin stable background and data-change-only refresh

## Scope

Runtime/UI-only correction. Finance business semantics, Payments facts, Deals, allocations and accounting values are not changed.

## Before

```text
30 s global Admin timer
  -> /admin/bootstrap
  -> adminData replacement
  -> ownerAdminRenderCurrent()
  -> active section repaint
       |
       +-> legacy accounting route could call renderCash()
            -> #page-accounting replacement

60 s /admin/ai-sync timer
  -> response always gets a fresh generatedAt
  -> renderAdmin()
  -> unconditional rona:finance-sync
  -> Cash R2 load()
  -> renderLoading()
  -> /admin/cash-source
  -> #page-accounting replacement

body MutationObserver(renderAdmin)
  -> unrelated DOM change
  -> renderAdmin() again

Result: the active page and Cash DOM can be repainted even when authoritative data is unchanged.
```

## After

```text
Global Admin
  30 s timer: REMOVED

pageshow / visibility return
  -> /admin/bootstrap
  -> stable signature (volatile generatedAt excluded)
  -> signature unchanged
       -> snapshot only, ZERO active-page DOM mutation
  -> signature changed
       -> one ownerAdminRenderCurrent()

60 s /admin/ai-sync fallback
  -> stable Admin signature + stable Finance-fragment signature
  -> unchanged
       -> ZERO renderAdmin()
       -> ZERO rona:finance-sync
  -> Finance signature changed
       -> one rona:finance-sync(changed=true)

Cash R2 (sole accounting owner)
  -> source check at most every 60 s while Cash is active
  -> /admin/cash-source
  -> stable payload signature (volatile generatedAt excluded)
  -> unchanged
       -> ZERO DOM mutation
       -> ZERO loading screen
       -> ZERO repaint
  -> changed
       -> validate complete Finance payload off-DOM
       -> keep current screen mounted during fetch
       -> one host.replaceChildren(newValidatedTree)
       -> no intermediate loading state

Canonical background
  -> remains owned by the static Admin shell
  -> body.admin-auth-server-verified
  -> /assets/portal-canonical/background.png
  -> no runtime unmount/remount in Issue #635 changes
```

## Runtime invariants

- Cash ownership remains `cash-r2-exclusive-v1`; middleware physically removes the legacy `renderCash()` renderer and maps accounting to `ensureCashR2Host`.
- `ownerAdminRefreshTick` no longer has a 30-second timer.
- `/admin/ai-sync` remains a 60-second fallback check, but its DOM/event effects are change-gated.
- Cash polling is exactly 60 seconds and only while the Cash page is active/visible.
- Cash payload equality ignores volatile generation timestamps; authoritative payload/source data remains part of the signature.
- Once a confirmed Cash screen exists, background checks never call `renderLoading()`.
- A changed Cash payload is validated first and then committed through a single `replaceChildren`.
- Background refresh errors preserve the last confirmed screen.

## Acceptance split

Automated CI proves:
- no 30-second Admin repaint source remains;
- no body-wide `MutationObserver(renderAdmin)` remains;
- no legacy Cash renderer remains in emitted current runtime;
- unchanged source produces zero Cash DOM mutations;
- a changed Finance payload remains invisible while loading, then produces one atomic Cash DOM replacement;
- canonical background stays mounted during both paths;
- production build remains valid.

After merge, production deployment proof verifies the exact release SHA and live source/runtime markers on `ronaoil.com`.

The mandatory authenticated 3-minute visual acceptance remains System Admin-owned: keep Cash open at least 3 minutes with unchanged Finance source and capture the no-flicker/no-background-loss proof, then verify Home / Payments / Deals / Access. Issues #635 and #629 must remain open until that acceptance is recorded.
