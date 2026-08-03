// Service worker: the only place that touches the network. Fetches and caches the
// single USD-anchored rate table, keeps it fresh on an alarm, and answers rate
// requests from the popup and content script.

import browser from 'webextension-polyfill';
import { openErApiProvider, fetchRatesWithFailover } from '../shared/providers';
import type { NormalizedRates } from '../shared/providers';
import { getRateCache, setRateCache, getSettings, setSettings } from '../shared/storage';
import type { RateCache } from '../shared/storage';
import { siteConverts, setSiteConverts } from '../shared/sites';
import type { Request, ContentRequest } from '../shared/messaging';

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

// --- Context menus ---------------------------------------------------------------
// The per-site toggle mirrors the popup (both route through shared/sites); the rest are
// the right-click features, which the content script actually carries out — the worker
// only owns the menu API and forwards the click. Created once on install (menu items
// survive SW restarts) and picked up live via storage.onChanged, so no reload is needed.

const TOGGLE_SITE_MENU = 'oc-toggle-site';
const CONVERT_SELECTION_MENU = 'oc-convert-selection';
const TOTAL_PAGE_MENU = 'oc-total-page';
const TOTAL_SELECTION_MENU = 'oc-total-selection';
const CONVERT_COLUMN_MENU = 'oc-convert-column';

async function setupContextMenu(): Promise<void> {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: CONVERT_SELECTION_MENU,
    title: 'Convert selection with OpenConvert',
    contexts: ['selection'],
  });
  browser.contextMenus.create({
    id: TOTAL_SELECTION_MENU,
    title: 'Total prices in selection',
    contexts: ['selection'],
  });
  browser.contextMenus.create({
    id: TOTAL_PAGE_MENU,
    title: 'Total prices on this page',
    contexts: ['page'],
  });
  browser.contextMenus.create({
    id: CONVERT_COLUMN_MENU,
    title: 'Convert this table column',
    contexts: ['page'],
  });
  browser.contextMenus.create({
    id: TOGGLE_SITE_MENU,
    title: 'Toggle price conversion on this site',
    contexts: ['page', 'selection', 'link'],
  });
}

/** Fire-and-forget a request at a tab's content script (ignores tabs with no listener). */
function notifyContent(tabId: number | undefined, request: ContentRequest): void {
  if (tabId === undefined) return;
  void browser.tabs.sendMessage(tabId, request).catch(() => undefined);
}

/** Extract a hostname from a page URL, or null for non-http(s) pages (chrome://, …). */
function hostFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? hostname : null;
  } catch {
    return null;
  }
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case CONVERT_SELECTION_MENU:
      notifyContent(tab?.id, { type: 'convertSelection', text: info.selectionText ?? '' });
      return;
    case TOTAL_SELECTION_MENU:
      notifyContent(tab?.id, { type: 'selectionTotal' });
      return;
    case TOTAL_PAGE_MENU:
      notifyContent(tab?.id, { type: 'pageTotal' });
      return;
    case CONVERT_COLUMN_MENU:
      notifyContent(tab?.id, { type: 'convertColumn' });
      return;
    case TOGGLE_SITE_MENU: {
      const host = hostFromUrl(info.pageUrl ?? tab?.url);
      if (!host) return;
      void (async () => {
        const settings = await getSettings();
        const patch = setSiteConverts(settings, host, !siteConverts(host, settings));
        if (Object.keys(patch).length > 0) await setSettings(patch);
      })();
      return;
    }
  }
});

browser.runtime.onInstalled.addListener(() => {
  void (async () => {
    await setupContextMenu();
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

// Popup and content script ask for the cached table here instead of fetching it
// themselves. Returning a Promise sends its resolved value back as the response.
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
