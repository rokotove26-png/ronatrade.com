# LK Fragment 2V-R1.1 cancellation hotfix

Scope:
- centered RONA Trade cancellation modal for deal, application, and expected payment;
- no browser prompt/confirm/alert in cancellation flow;
- reason selection with required free-text for Other;
- backend success required before UI state change;
- immediate DOM synchronization from owner_r1_admin_bootstrap without full-page reload;
- cancelled deals hidden from Active and represented in Annulled;
- FINANCIAL_HOLD remains visible and preserves confirmed financial facts;
- inline localized cancellation errors with technical code.

Production acceptance remains BLOCKED until Owner visual/functional confirmation.
