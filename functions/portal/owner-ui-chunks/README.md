The approved Admin, Client and Agent interface runtime is stored as deterministic string chunks and is now served by `functions/portal/main-ui.js` as the primary portal UI runtime.

`/portal/main-ui` is the authoritative browser entrypoint for the redesigned portals. `functions/portal/owner-acceptance-ui.js` remains only as a compatibility alias for existing tests or links; it no longer represents a separate visual block.

The frozen canonical Admin, Client and Agent HTML remains byte-for-byte unchanged as a protected compatibility substrate for existing application hooks, business logic and the exact canonical background/logo assets. The pre-paint gate prevents that substrate from owning any visible first paint: content is revealed only after the primary redesigned runtime has completed the relevant role render.

Visual redesign v2 in `chunk7.js` through `chunk15.js` is the approved main visual system, including Admin refinements, original-underlay preservation, duplicate-title cleanup, real attention counters, approved navigation structure and first-paint release.
