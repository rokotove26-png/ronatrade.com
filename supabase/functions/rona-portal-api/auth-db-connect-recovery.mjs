const MAX_ATTEMPTS = 2;
const DEADLINE_MS = 7000;
const RETRY_DELAY_MS = 150;

export class AuthDbUnavailableError extends Error {
  constructor(requestId) {
    super('AUTH_BACKEND_UNAVAILABLE');
    this.name = 'AuthDbUnavailableError';
    this.code = 'AUTH_BACKEND_UNAVAILABLE';
    this.requestId = requestId;
  }
}

export function isAuthDbUnavailable(error) {
  return error instanceof AuthDbUnavailableError;
}

function isConnectTimeout(error) {
  return error?.code === 'CONNECT_TIMEOUT' ||
    (error?.name === 'Error' && /^(?:write )?CONNECT_TIMEOUT$/.test(error?.message || ''));
}

// Only call this around the read-only resolve_portal_auth query, before route dispatch.
export async function withAuthDbConnectRecovery(query, { requestId, runtimeRegion,
  log = console.error, now = () => performance.now(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  deadlineMs = DEADLINE_MS } = {}) {
  const startedAt = now();
  const diagnostic = (attempt, errorCode) => log(JSON.stringify({
    request_id: requestId,
    phase: 'AUTH_DB_CONNECT',
    attempt,
    error_code: errorCode,
    runtime_region: runtimeRegion || 'unknown',
    elapsed_ms: Math.max(0, Math.round(now() - startedAt)),
  }));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = deadlineMs - (now() - startedAt);
    if (remaining <= 0) {
      diagnostic(attempt, 'AUTH_DB_DEADLINE_EXCEEDED');
      throw new AuthDbUnavailableError(requestId);
    }
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(query),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new AuthDbUnavailableError(requestId)), remaining);
        }),
      ]);
    } catch (error) {
      if (isAuthDbUnavailable(error)) {
        diagnostic(attempt, 'AUTH_DB_DEADLINE_EXCEEDED');
        throw error;
      }
      if (!isConnectTimeout(error)) throw error;
      diagnostic(attempt, 'CONNECT_TIMEOUT');
      if (attempt === MAX_ATTEMPTS) throw new AuthDbUnavailableError(requestId);
      const delay = Math.min(RETRY_DELAY_MS, deadlineMs - (now() - startedAt));
      if (delay <= 0) throw new AuthDbUnavailableError(requestId);
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }
}
