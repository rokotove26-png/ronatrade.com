// Compatibility build entrypoint.
// There is one canonical deployment build. Client HTML is CURRENT_ONLY and is emitted
// byte-for-byte by build-pages-direct-canonical.mjs; no legacy client source or visual
// transformation is permitted here.
await import('./build-pages-direct-canonical.mjs');
await import('./materialize-admin-current-modules.mjs');
