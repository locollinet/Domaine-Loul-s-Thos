import type { KnownCost } from './types';

/** Integer helpers. All stored quantities are integers in their minimal unit. */
export function isPositiveInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}
export function isNonNegativeInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/** Litres (decimal, user input) → integer mL. Returns null if not representable. */
export function litresToMl(litres: number): number | null {
  if (!Number.isFinite(litres)) return null;
  const ml = Math.round(litres * 1000);
  if (Math.abs(ml - litres * 1000) > 1e-6) return null;
  return ml;
}
export function kgToG(kg: number): number | null {
  if (!Number.isFinite(kg)) return null;
  const g = Math.round(kg * 1000);
  if (Math.abs(g - kg * 1000) > 1e-6) return null;
  return g;
}
export function eurosToCents(eur: number): number | null {
  if (!Number.isFinite(eur)) return null;
  const c = Math.round(eur * 100);
  if (Math.abs(c - eur * 100) > 1e-6) return null;
  return c;
}

/**
 * Proportional allocation of an integer amount: amount × part / whole, rounded half-up.
 * The caller keeps `amount − allocation` on the source so the total is conserved exactly.
 * Uses BigInt to avoid float error on large products.
 */
export function allocateProRata(amount: number, part: number, whole: number): number {
  if (whole <= 0) throw new Error('whole must be > 0');
  if (part === whole) return amount;
  const num = BigInt(amount) * BigInt(part) * 2n + BigInt(whole);
  const den = BigInt(whole) * 2n;
  return Number(num / den);
}

/** Split a known cost when `part` of `whole` volume leaves. Returns [moved, remaining]. */
export function splitCost(cost: KnownCost, part: number, whole: number): [KnownCost, KnownCost] {
  const moved = allocateProRata(cost.knownCents, part, whole);
  return [
    { knownCents: moved, incomplete: cost.incomplete },
    { knownCents: cost.knownCents - moved, incomplete: cost.incomplete },
  ];
}

export function addCosts(...costs: KnownCost[]): KnownCost {
  return costs.reduce<KnownCost>(
    (acc, c) => ({ knownCents: acc.knownCents + c.knownCents, incomplete: acc.incomplete || c.incomplete }),
    { knownCents: 0, incomplete: false },
  );
}

/** VAT on a positive HT amount, half-up to the cent, exact integer arithmetic. */
export function vatCents(htCents: number, basisPoints: number): number {
  return Math.floor((htCents * basisPoints + 5000) / 10000);
}
