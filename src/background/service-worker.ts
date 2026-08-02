// Service worker: the only network caller. Owns the RateProvider abstraction,
// fetches and caches the single USD-anchored rate table, runs the browser.alarms
// refresh, and (from Phase 2.2) answers messages. No DOM logic.
// See overview.md > Architecture.

import browser from 'webextension-polyfill';
import { openErApiProvider, fetchRatesWithFailover } from '../shared/providers';
import type { NormalizedRates } from '../shared/providers';
import { getRateCache, setRateCache, getSettings } from '../shared/storage';
import type { RateCache } from '../shared/storage';
import type { Request } from '../shared/messaging';

/** OpenConvert always anchors its one cached table to USD; every pair converts locally. */
const BASE = 'USD';
const REFRESH_ALARM = 'oc-refresh-rates';

/** Normalize + stamp a provider result and persist it as the new cache. */
async function storeCache(rates: NormalizedRates, source: string): Promise<RateCache> {
  const cache: RateCache = {
    base: rates.base,
    rates: rates.rates,
    updatedAt: rates.updatedAt,
    nextUpdate: rates.nextUpdate,
    source,
    fetchedAt: Date.now(),
  };
  await setRateCache(cache);
  return cache;
}

/**
 * Refresh the cached rate table, preferring coverage over freshness:
 * - If a cache already exists, only the primary (open.er-api, ~160 currencies)
 *   may replace it. If the primary is unreachable, keep the last good table
 *   rather than overwrite it with the sparser fallback.
 * - On a cold start (no cache), fall back through the provider chain so there is
 *   at least *some* table to serve.
 */
async function refreshRates(): Promise<RateCache> {
  const existing = await getRateCache();
  if (existing) {
    try {
      const rates = await openErApiProvider.fetchRates(BASE);
      return await storeCache(rates, openErApiProvider.id);
    } catch (err) {
      console.warn('[OpenConvert] primary refresh failed; serving last cached table', err);
      return existing;
    }
  }
  const { rates, provider } = await fetchRatesWithFailover(BASE);
  return storeCache(rates, provider);
}

/** Return the cached table, doing a first fetch if the cache is still empty. */
async function getRates(): Promise<RateCache | null> {
  const cache = await getRateCache();
  if (cache) return cache;
  try {
    return await refreshRates();
  } catch (err) {
    console.error('[OpenConvert] initial rate fetch failed', err);
    return null;
  }
}

/** Create the periodic refresh alarm if it isn't already scheduled. */
async function ensureRefreshAlarm(): Promise<void> {
  if (await browser.alarms.get(REFRESH_ALARM)) return;
  const { refreshIntervalHours } = await getSettings();
  await browser.alarms.create(REFRESH_ALARM, {
    periodInMinutes: Math.max(1, refreshIntervalHours * 60),
  });
}

browser.runtime.onInstalled.addListener(() => {
  void (async () => {
    await ensureRefreshAlarm();
    try {
      await refreshRates();
    } catch (err) {
      console.error('[OpenConvert] install refresh failed', err);
    }
  })();
});

browser.runtime.onStartup.addListener(() => {
  void ensureRefreshAlarm();
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== REFRESH_ALARM) return;
  void refreshRates().catch((err) =>
    console.error('[OpenConvert] scheduled refresh failed', err),
  );
});

// Typed message contract (Checkpoint 2.2): popup and content script request the
// cached table here; the worker never exposes network calls to them directly.
// Returning a Promise sends its resolved value back as the response.
browser.runtime.onMessage.addListener((message: unknown): Promise<RateCache | null> | undefined => {
  const request = message as Request;
  switch (request.type) {
    case 'getRates':
      return getRates();
    case 'refreshRates':
      return refreshRates().catch((err: unknown) => {
        console.error('[OpenConvert] refresh (via message) failed', err);
        return getRateCache();
      });
    default:
      return undefined;
  }
});

// Console testing hook for Checkpoint 2.1. From the service-worker console:
//   await self.openconvert.refresh()   — force a manual refresh
//   await self.openconvert.getCache()  — inspect the stored table
//   await self.openconvert.getRates()  — cache, fetching first if empty
// (Superseded by the typed messaging contract in Checkpoint 2.2.)
(globalThis as unknown as { openconvert: unknown }).openconvert = {
  refresh: refreshRates,
  getCache: getRateCache,
  getRates,
};
