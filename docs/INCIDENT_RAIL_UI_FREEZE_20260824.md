# Incident: Admin UI freeze after Online Rail current-first rollout

Date: 2026-08-24

Root cause: the Online Rail runtime installed a `MutationObserver` on the entire monitoring subtree. Its repair path called `isolateLegacy()`, which removed and re-appended the preserved tariff matrix on every observer callback. Those child-list mutations recursively triggered the observer again, creating an unbounded microtask repair loop and starving normal UI clicks/navigation.

Corrective action:
- observe only the monitoring host's direct child list;
- schedule repair only when the current rail root has actually been removed/replaced;
- do not remove/re-append an already-preserved tariff matrix during isolation;
- keep current-first rendering and fail-closed monitoring behavior unchanged.
