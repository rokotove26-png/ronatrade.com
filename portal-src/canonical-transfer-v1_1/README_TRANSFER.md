# RONA Canonical Portal Source Transfer v1.1

Exact frozen sources for Admin v3.4.13, Client v1.5.14 and Agent v0.4.3 plus their shared canonical PNG/SVG assets.

RULE: verify MANIFEST.json before any build. Do not alter visual DOM/CSS/text/assets. Runtime integration may be nonvisual only.

If using *_externalized.html, replace placeholders only at build time:
- __RONA_CANONICAL_BACKGROUND_DATA_URI__ -> data:image/png;base64,<base64(canonical_background.png)>
- __RONA_CANONICAL_LOGO_DATA_URI__ -> data:image/svg+xml;base64,<base64(canonical_logo.svg)>
Then reconstructed frozen HTML MUST match the canonical frozen SHA listed in MANIFEST.json.
