const originalRequestJson = Request.prototype.json;
const DATE_ONLY_OR_ISO = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/;

function canonicalDate(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  const match = raw.match(DATE_ONLY_OR_ISO);
  if (!match) return value;
  const day = match[1];
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return value;
  return day;
}

Request.prototype.json = async function patchedJson(...args: Parameters<Request['json']>) {
  const value = await originalRequestJson.apply(this, args as []);
  try {
    const url = new URL(this.url);
    if (this.method === 'POST' && url.pathname.endsWith('/v1/client/applications') && value && typeof value === 'object' && !Array.isArray(value)) {
      const body = value as Record<string, unknown>;
      body.deliveryPeriodFrom = canonicalDate(body.deliveryPeriodFrom);
      body.deliveryPeriodTo = canonicalDate(body.deliveryPeriodTo);
    }
  } catch (_) {
    // Leave the parsed payload untouched; the canonical API validation remains authoritative.
  }
  return value;
};

import "https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/e6a9e09092975af15879fdfc184e5c2566dfcc35/supabase/functions/rona-portal-api/index.ts";
