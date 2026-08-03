// Settings + RateCache schema and typed browser.storage.local helpers — the one
// place that describes everything OpenConvert persists.

import browser from 'webextension-polyfill';
import type { NumberFormat } from './format';

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

/** Everything the user can configure, persisted in storage.local. */
export interface Settings {
  /** Hours between scheduled rate refreshes. Default 6. */
  refreshIntervalHours: number;
  /** Popup converter source currency (ISO code). */
  source: string;
  /** Target currency for both the popup converter and page conversion (ISO code). */
  target: string;
  /**
   * Set the moment the user changes the source by hand; once true, per-page
   * auto-detect never overrides the source again. "Reset to auto" clears it.
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
  /**
   * How converted prices are shown on the page:
   * - `replace`: rewrite the price to the converted value, original on hover (default).
   * - `hover`: leave the original visible, show the converted value on hover.
   */
  displayMode: 'replace' | 'hover';
  /** Add a subtle marker to converted prices on the page (default off). */
  highlight: boolean;
  /**
   * Which per-site list is enforced. `blacklist`: convert everywhere except
   * listed hosts (default). `whitelist`: convert only on listed hosts. Both lists
   * persist independently — switching the mode never clears the other list.
   */
  siteListMode: 'blacklist' | 'whitelist';
  /** Hosts to NOT convert on while in blacklist mode. Registrable-domain entries
   * also cover their subdomains (see shared/sites.ts). */
  blacklist: string[];
  /** Hosts to convert on while in whitelist mode (subdomains covered as above). */
  whitelist: string[];
  /**
   * Per-host target-currency overrides (normalized host → ISO code). When a page's host
   * matches an entry, its prices convert to that target instead of the global one. Keys
   * match subdomains like the allow/deny lists (see shared/sites.ts).
   */
  siteTargets: Record<string, string>;
  /** Decimal places for converted output. Default 2; 0 = nearest whole. Range 0–4. */
  precision: number;
  /** How the converted number's grouping/decimal separators render. See shared/format.ts. */
  numberFormat: NumberFormat;
  /** Extra target currencies for the converter's multi-target view — the amount is shown
   *  in each of these alongside the main target. */
  multiTargets: string[];
  /** Saved source→target pairs shown as quick-swap chips in the converter. */
  pinnedPairs: { from: string; to: string }[];
}

export const DEFAULT_SETTINGS: Settings = {
  refreshIntervalHours: 6,
  source: 'USD',
  target: 'EUR',
  sourceManuallySet: false,
  enabled: true,
  fromFilter: [],
  displayMode: 'replace',
  highlight: false,
  siteListMode: 'blacklist',
  blacklist: [],
  whitelist: [],
  siteTargets: {},
  precision: 2,
  numberFormat: 'comma-dot',
  multiTargets: [],
  pinnedPairs: [
    { from: 'USD', to: 'EUR' },
    { from: 'GBP', to: 'JPY' },
    { from: 'USD', to: 'SGD' },
  ],
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
