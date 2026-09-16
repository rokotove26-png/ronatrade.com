# Admin Applications — universal Application Passport action hotfix

Production symptom: active/new application rows still render their business actions, but the functional `Открыть` button for Application Passport is absent.

Root cause: PR #458 moved the completed-row `Открыть` action into the primary `application2BActions` render path and removed DOM-observer ownership of the action. The canonical delegated passport handler remained present, but non-completed rows returned `applicationActions(a)` without a passport trigger. The result is a trigger regression, not a passport-data or business-state failure.

Correction: mount a generic presentation-only action overlay which adds exactly one `Открыть` trigger (`data-rona-app-passport-open`) to every rendered application/request row, preserving all existing Accept/Reject/Counter-offer/Supplier/Deal actions. The existing canonical passport resolver and delegated handler remain unchanged.

No API mutation, application lifecycle mutation, Payments/Finance change, source rewrite, record-specific hardcode, or business-data mutation.
