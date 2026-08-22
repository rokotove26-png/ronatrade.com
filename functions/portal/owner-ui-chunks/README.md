The owner-acceptance browser runtime is stored as deterministic string chunks so the canonical portal HTML remains byte-for-byte unchanged. `functions/portal/owner-acceptance-ui.js` concatenates these chunks and serves the resulting JavaScript through the protected portal route.

Visual redesign v2 is isolated in `chunk7.js` through `chunk9.js`: the base visual system, Admin access/claims refinements, and final Admin polish respectively. These chunks do not replace the canonical Admin, Client, or Agent HTML and do not modify the canonical RONA Trade logo asset.
