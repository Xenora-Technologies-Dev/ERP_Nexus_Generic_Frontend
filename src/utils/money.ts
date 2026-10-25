import Decimal from 'decimal.js';

/**
 * Money arithmetic. All monetary rounding goes through decimal.js (ROUND_HALF_UP, the
 * convention used by FTA examples) instead of binary floating point.
 * Values may be number | string | Prisma.Decimal | Decimal.
 */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export { Decimal };

/** Anything coercible to a decimal (number, numeric string, Prisma.Decimal, null/undefined → 0). */
export type MoneyLike = number | string | Decimal | { toString(): string } | null | undefined | unknown;

export function D(v: MoneyLike): Decimal {
  if (v === null || v === undefined || v === '') return new Decimal(0);
  if (v instanceof Decimal) return v;
  return new Decimal(typeof v === 'number' ? v : String(v));
}
/** Round to 2 dp (fils) half-up and return a JS number for JSON/Prisma. */
export function money(v: MoneyLike): number {
  return D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}
export function roundTo(v: MoneyLike, dp: number): number {
  return D(v).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toNumber();
}
export function sum(values: MoneyLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(D(v)), new Decimal(0));
}
export function mul(a: MoneyLike, b: MoneyLike): Decimal { return D(a).times(D(b)); }
export function add(...v: MoneyLike[]): Decimal { return sum(v); }
export function sub(a: MoneyLike, b: MoneyLike): Decimal { return D(a).minus(D(b)); }
/** VAT on a net amount: net × rate% rounded to fils. */
export function vatOn(net: MoneyLike, ratePct: MoneyLike): number {
  return money(D(net).times(D(ratePct)).dividedBy(100));
}
export function eqMoney(a: MoneyLike, b: MoneyLike): boolean {
  return D(a).toDecimalPlaces(2).equals(D(b).toDecimalPlaces(2));
}

/* ---------------------------------------------------------------------------
 * Money policy (enforced by scripts/check-money.mjs):
 *  - All arithmetic, comparisons and aggregation of money/quantities use Decimal.
 *  - Conversion to a JS number happens only at an output boundary (JSON / PDF)
 *    through money() (fils, half-up) or qtyOut() (3 dp), never before arithmetic.
 * ------------------------------------------------------------------------- */

/** Round to fils and keep as Decimal (for further exact arithmetic). */
export function fils(v: MoneyLike): Decimal {
  return D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
/** Fixed 2-dp string, e.g. for PDFs/CSV. */
export function fmtMoney(v: MoneyLike, dp = 2): string {
  return D(v).toFixed(dp, Decimal.ROUND_HALF_UP);
}
/** Quantities are stored with 3 dp. */
export function qtyOut(v: MoneyLike): number {
  return D(v).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
}
export function dmax(...v: MoneyLike[]): Decimal { return Decimal.max(...v.map(D)); }
export function dmin(...v: MoneyLike[]): Decimal { return Decimal.min(...v.map(D)); }
/** Positive part: max(0, v). */
export function pos(v: MoneyLike): Decimal { return Decimal.max(0, D(v)); }
export function isZeroMoney(v: MoneyLike): boolean { return fils(v).isZero(); }
/** Parse an untrusted numeric input (request body/query) to Decimal; throws on garbage. */
export function parseMoney(v: unknown, field = 'amount'): Decimal {
  if (v === null || v === undefined || v === '') return new Decimal(0);
  try {
    const d = new Decimal(typeof v === 'number' ? v : String(v).trim());
    if (!d.isFinite()) throw new Error();
    return d;
  } catch {
    throw Object.assign(new Error(`${field} must be a number`), { status: 400 });
  }
}
/**
 * Allocate `total` across `weights` so the parts are fils-rounded and sum EXACTLY to the
 * rounded total (largest-remainder method). Used for discount/VAT/FX proration.
 */
export function allocate(total: MoneyLike, weights: MoneyLike[]): Decimal[] {
  const t = fils(total);
  const w = weights.map(D);
  const wSum = sum(w);
  if (w.length === 0) return [];
  if (wSum.isZero()) return w.map((_, i) => (i === 0 ? t : new Decimal(0)));
  const raw = w.map((x) => t.times(x).dividedBy(wSum));
  const floored = raw.map((r) => r.toDecimalPlaces(2, Decimal.ROUND_DOWN));
  let rem = t.minus(sum(floored)).times(100).round().toNumber(); // integer fils left, may be negative
  const order = raw.map((r, i) => ({ i, frac: r.minus(floored[i]).abs() })).sort((a, b) => b.frac.comparedTo(a.frac));
  const step = rem >= 0 ? new Decimal('0.01') : new Decimal('-0.01');
  for (let k = 0; rem !== 0 && k < order.length * 2; k++) {
    floored[order[k % order.length].i] = floored[order[k % order.length].i].plus(step);
    rem += rem > 0 ? -1 : 1;
  }
  return floored;
}

/* ---------------------------------------------------------------------------
 * Frontend helpers: input parsing and document preview that mirror the backend
 * (Backend/src/utils/calculations.ts) exactly, so on-screen totals equal posted totals.
 * ------------------------------------------------------------------------- */

/** Parse a text-field value to a number for form state; blank/invalid → 0. */
export function parseInput(v: unknown): number {
  try {
    return D(typeof v === 'string' ? v.trim().replace(/,/g, '') : v).toNumber();
  } catch {
    return 0;
  }
}

/** Parse a text-field value to a whole number (counts, days, padding); blank/invalid → 0. */
export function parseIntInput(v: unknown): number {
  try {
    return D(typeof v === 'string' ? v.trim() : v).trunc().toNumber();
  } catch {
    return 0;
  }
}

export interface PreviewLine { quantity: MoneyLike; unitPrice: MoneyLike; vatRate?: MoneyLike }
export interface PreviewLineResult { net: number; discount: number; vat: number; total: number }

export function lineNet(l: { quantity: MoneyLike; unitPrice: MoneyLike }): Decimal {
  return fils(D(l.quantity).times(D(l.unitPrice)));
}

/** Same algorithm as the backend: fils-rounded line nets, discount allocated by largest remainder, VAT per line. */
export function previewDocument(lines: PreviewLine[], vatApplicable: boolean, discount: MoneyLike = 0) {
  const nets = lines.map(lineNet);
  const subtotal = sum(nets);
  const disc = Decimal.min(Decimal.max(0, fils(discount)), subtotal);
  const parts = disc.isZero() ? nets.map(() => new Decimal(0)) : allocate(disc, nets);
  const out: PreviewLineResult[] = lines.map((l, i) => {
    const taxable = nets[i].minus(parts[i]);
    const vat = vatApplicable ? fils(taxable.times(D(l.vatRate ?? 0)).dividedBy(100)) : new Decimal(0);
    return { net: money(nets[i]), discount: money(parts[i]), vat: money(vat), total: money(taxable.plus(vat)) };
  });
  const vatAmount = sum(out.map((l) => l.vat));
  return {
    lines: out,
    subtotal: money(subtotal),
    discount: money(disc),
    vatAmount: money(vatAmount),
    total: money(sum(out.map((l) => l.total))),
    discountExceedsSubtotal: fils(discount).gt(subtotal),
  };
}

/** Outstanding = total − paid − credited/debited, floored at 0. */
export function outstanding(total: MoneyLike, paid: MoneyLike, adjusted: MoneyLike = 0): number {
  return money(pos(D(total).minus(D(paid)).minus(D(adjusted))));
}
