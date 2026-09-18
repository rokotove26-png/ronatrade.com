const DECIMAL_RE = /^([+-]?)(\d+)(?:\.(\d+))?$/;

function pow10(n) { return 10n ** BigInt(n); }

export function parseDecimal(value) {
  if (typeof value === 'bigint') return { coefficient: value, scale: 0 };
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError('Binary-float money is forbidden; pass a decimal string');
    return { coefficient: BigInt(value), scale: 0 };
  }
  if (typeof value !== 'string') throw new TypeError('Decimal value must be a string');
  const text = value.trim();
  const match = DECIMAL_RE.exec(text);
  if (!match) throw new TypeError(`Invalid decimal: ${text}`);
  const sign = match[1] === '-' ? -1n : 1n;
  const whole = match[2];
  const fraction = match[3] || '';
  return normalizeDecimal({ coefficient: sign * BigInt(whole + fraction), scale: fraction.length });
}

export function normalizeDecimal(decimal) {
  let { coefficient, scale } = decimal;
  while (scale > 0 && coefficient % 10n === 0n) { coefficient /= 10n; scale -= 1; }
  if (coefficient === 0n) return { coefficient: 0n, scale: 0 };
  return { coefficient, scale };
}

function parseDecimalLike(value) {
  if (value && typeof value === 'object' && typeof value.coefficient === 'bigint') return value;
  return parseDecimal(value);
}

function align(a, b) {
  const x = parseDecimalLike(a); const y = parseDecimalLike(b); const scale = Math.max(x.scale, y.scale);
  return { a: x.coefficient * pow10(scale - x.scale), b: y.coefficient * pow10(scale - y.scale), scale };
}

export function decimalAdd(a, b) { const x = align(a, b); return normalizeDecimal({ coefficient: x.a + x.b, scale: x.scale }); }
export function decimalSub(a, b) { const x = align(a, b); return normalizeDecimal({ coefficient: x.a - x.b, scale: x.scale }); }
export function decimalCompare(a, b) { const x = align(a, b); return x.a < x.b ? -1 : x.a > x.b ? 1 : 0; }
export function decimalAbs(a) { const x = parseDecimalLike(a); return { coefficient: x.coefficient < 0n ? -x.coefficient : x.coefficient, scale: x.scale }; }
export function decimalMulInteger(a, integer) {
  if (!Number.isSafeInteger(integer)) throw new TypeError('Multiplier must be a safe integer');
  const x = parseDecimalLike(a); return normalizeDecimal({ coefficient: x.coefficient * BigInt(integer), scale: x.scale });
}
export function decimalDivide(a, b, precision = 12) {
  const x = parseDecimalLike(a); const y = parseDecimalLike(b);
  if (y.coefficient === 0n) throw new RangeError('Division by zero');
  if (!Number.isInteger(precision) || precision < 0 || precision > 30) throw new RangeError('Invalid precision');
  const sign = (x.coefficient < 0n) !== (y.coefficient < 0n) ? -1n : 1n;
  const numerator = (x.coefficient < 0n ? -x.coefficient : x.coefficient) * pow10(precision + y.scale);
  const denominator = (y.coefficient < 0n ? -y.coefficient : y.coefficient) * pow10(x.scale);
  let quotient = numerator / denominator; const remainder = numerator % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;
  return normalizeDecimal({ coefficient: sign * quotient, scale: precision });
}
export function decimalToString(value) {
  const x = normalizeDecimal(parseDecimalLike(value)); const negative = x.coefficient < 0n;
  const digits = (negative ? -x.coefficient : x.coefficient).toString();
  if (x.scale === 0) return `${negative ? '-' : ''}${digits}`;
  const padded = digits.padStart(x.scale + 1, '0'); const cut = padded.length - x.scale;
  return `${negative ? '-' : ''}${padded.slice(0, cut)}.${padded.slice(cut)}`;
}
export function canonicalDecimalString(value) { return decimalToString(parseDecimal(String(value))); }
export function decimalSum(values) { let total = parseDecimal('0'); for (const value of values) total = decimalAdd(total, value); return total; }
export function decimalMin(a, b) { return decimalCompare(a, b) <= 0 ? parseDecimalLike(a) : parseDecimalLike(b); }
