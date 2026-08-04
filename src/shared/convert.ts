// Pure conversion math. Every pair converts locally off the USD-anchored table:
// A→B = amount * rates[B] / rates[A].

import type { RateCache } from './storage';

/** Round to `precision` decimal places (0 = nearest whole). */
function roundTo(value: number, precision: number): number {
  return Number(value.toFixed(precision));
}

/**
 * Convert `amount` from one currency to another using a USD-anchored rate table.
 * `rates` maps each ISO code to units per 1 unit of the table's base.
 * Throws if either currency is missing from the table.
 *
 * @param precision decimal places to round to (default 2; 0 = nearest whole).
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: RateCache['rates'],
  precision = 2,
): number {
  const fromRate = rates[from];
  const toRate = rates[to];
  if (fromRate === undefined) throw new Error(`No rate for source currency "${from}"`);
  if (toRate === undefined) throw new Error(`No rate for target currency "${to}"`);
  if (fromRate === 0) throw new Error(`Invalid zero rate for "${from}"`);
  return roundTo((amount * toRate) / fromRate, precision);
}
