import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const source=await readFile('assets/portal-runtime/client-application-lifecycle-v1.js','utf8');

assert.match(source,/20260921-client-application-lifecycle-v10-event-driven-projection/);
assert.doesNotMatch(source,/setInterval\s*\(/);
assert.doesNotMatch(source,/REFRESH_MS\s*=\s*30000/);
assert.match(source,/function currentProjection\(\)/);
assert.match(source,/getCurrentProjection/);
assert.match(source,/whenCurrentProjection/);
assert.match(source,/refreshCurrentProjection/);
assert.match(source,/rona:client-current-projection/);
assert.match(source,/RONA_CLIENT_CONTEXT_CURRENT_PROJECTION/);
assert.match(source,/CLIENT_OPERATIONS_PROJECTION_SCOPE_MISMATCH/);
assert.match(source,/application-submitted/);
assert.match(source,/function projectionMatches/);
assert.match(source,/response\?\.data\|\|null/);

console.log('CLIENT_APPLICATION_LIFECYCLE_EVENT_DRIVEN_V1=PASS');
console.log('PERIODIC_30S_FETCH=REMOVED');
console.log('CURRENT_PROJECTION_OWNER=RONA_CLIENT_CONTEXT');
