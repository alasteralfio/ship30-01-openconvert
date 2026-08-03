// Settings + RateCache schema and typed browser.storage.local helpers.
// This is the single documented shape of what OpenConvert persists. Settings
// grows as later phases land; in Phase 2 only refreshIntervalHours is wired.

import browser from 'webextension-polyfill';

/** A normalized, USD-anchored exchange-rate table cached in storage.local. */
export interface RateCache {
  /** Anchor currency for the table — always 'USD' for OpenConvert. */
  base: string;
  /** ISO code → units of that currency per 1 unit of `base` (includes base: 1). */
  rates: Record<string, number>;
  /** Provider's own "rates as of" time (ms epoch). */
  updatedAt: number;
  /** Provider's advertised next-update time (ms epoch), or null if unknown. */
  nextUpdate: number | null;
  /** Which provider produced this table (RateProvider.id). */
  source: string;
  /** When OpenConvert fetched and stored it (ms epoch). */
  fetchedAt: number;
}

/**
 * User settings. Grows as phases land (later: precision, lists, display mode,
 * theme, …). Phase 3 adds the popup converter's persisted state.
 */
export interface Settings {
  /** Hours between scheduled rate refreshes. Default 6. */
  refreshIntervalHours: number;
  /** Popup converter source currency (ISO code). */
  source: string;
  /** Popup converter + (Phase 4) page target currency (ISO code). */
  target: string;
  /**
   * Set the moment the user manually changes the source; once true, per-page
   * source auto-detect never overrides the source again. A "reset to auto"
   * control clears it. Auto-detect itself lands with the content script (Phase 4).
   */
  sourceManuallySet: boolean;
  /** Global on/off kill switch for page auto-conversion (independent of the lists). */
  enabled: boolean;
  /**
   * Which SOURCE currencies on a page get rewritten. **Empty = All** (convert
   * every detected currency). A non-empty list restricts conversion to those
   * ISO codes. Separate from the popup converter's `source`.
   */
  fromFilter: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  refreshIntervalHours: 6,
  source: 'USD',
  target: 'EUR',
  sourceManuallySet: false,
  enabled: true,
  fromFilter: [],
};

const RATE_CACHE_KEY = 'rateCache';
const SETTINGS_KEY = 'settings';

/** The last good rate table, or null if nothing has been cached yet. */
export async function getRateCache(): Promise<RateCache | null> {
  const stored = await browser.storage.local.get(RATE_CACHE_KEY);
  return (stored[RATE_CACHE_KEY] as RateCache | undefined) ?? null;
}

export async function setRateCache(cache: RateCache): Promise<void> {
  await browser.storage.local.set({ [RATE_CACHE_KEY]: cache });
}

/** Stored settings merged over defaults, so missing keys always have a value. */
export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const saved = (stored[SETTINGS_KEY] as Partial<Settings> | undefined) ?? {};
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await browser.storage.local.set({ [SETTINGS_KEY]: { ...current, ...patch } });
}
