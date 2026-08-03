// RateProvider interface plus the two implementations: open.er-api (primary) and
// Frankfurter (fallback). Each normalises to { base, rates, updatedAt, nextUpdate }
// so a new source is a drop-in.

/** The normalized rate table every provider returns. USD-anchored in practice. */
export interface NormalizedRates {
  /** Anchor currency the rates are relative to. */
  base: string;
  /** ISO code → units per 1 unit of `base`. Always includes `base: 1`. */
  rates: Record<string, number>;
  /** Provider's "rates as of" time (ms epoch). */
  updatedAt: number;
  /** Provider's next scheduled update (ms epoch), or null if the provider omits it. */
  nextUpdate: number | null;
}

/** A drop-in exchange-rate source. Add a provider by implementing this. */
export interface RateProvider {
  /** Stable identifier stored alongside the cache (RateCache.source). */
  readonly id: string;
  /** Fetch and normalize the full rate table for `base`. Throws on any failure. */
  fetchRates(base: string): Promise<NormalizedRates>;
}

// --- open.er-api (primary): ~160 currencies, no key, ~daily updates. -----------

interface OpenErApiResponse {
  result: string;
  base_code: string;
  time_last_update_unix: number;
  time_next_update_unix: number;
  rates: Record<string, number>;
}

export const openErApiProvider: RateProvider = {
  id: 'open.er-api',
  async fetchRates(base) {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!res.ok) throw new Error(`open.er-api HTTP ${res.status}`);
    const data = (await res.json()) as OpenErApiResponse;
    if (data.result !== 'success') throw new Error(`open.er-api result: ${data.result}`);
    return {
      base: data.base_code,
      rates: data.rates,
      updatedAt: data.time_last_update_unix * 1000,
      nextUpdate: data.time_next_update_unix ? data.time_next_update_unix * 1000 : null,
    };
  },
};

// --- Frankfurter (fallback): ~31 major currencies, ECB data, no key. -----------

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export const frankfurterProvider: RateProvider = {
  id: 'frankfurter',
  async fetchRates(base) {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}`);
    if (!res.ok) throw new Error(`frankfurter HTTP ${res.status}`);
    const data = (await res.json()) as FrankfurterResponse;
    return {
      base: data.base,
      // Frankfurter omits the base from `rates`; add it so every table includes base: 1.
      rates: { [data.base]: 1, ...data.rates },
      updatedAt: Date.parse(data.date),
      nextUpdate: null,
    };
  },
};

/** Providers in priority order — primary first, fallbacks after. */
export const PROVIDERS: readonly RateProvider[] = [openErApiProvider, frankfurterProvider];

export interface FailoverResult {
  rates: NormalizedRates;
  /** id of the provider that succeeded. */
  provider: string;
}

/**
 * Try each provider in order and return the first success. Used only when there
 * is no usable cache; the coverage-preserving refresh policy (keep a good primary
 * cache rather than replace it with a sparser fallback) lives in the worker.
 * Throws with the collected errors if every provider fails.
 */
export async function fetchRatesWithFailover(
  base: string,
  providers: readonly RateProvider[] = PROVIDERS,
): Promise<FailoverResult> {
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const rates = await provider.fetchRates(base);
      return { rates, provider: provider.id };
    } catch (err) {
      errors.push(`${provider.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All rate providers failed — ${errors.join('; ')}`);
}
