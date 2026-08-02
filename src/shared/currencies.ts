// Currency metadata. OpenConvert supports every ISO code the rate provider
// returns, so there is no 160-row table to maintain: display names and number
// formatting come from the runtime Intl API. Only the ambiguous/common *symbols*
// are hand-authored, because price detection (Phase 4) must map a glyph back to
// candidate codes. See overview.md > Core B and > Data & APIs.

/** Human-readable name for a code, e.g. 'USD' → 'US Dollar'. Falls back to the code. */
export function getCurrencyName(code: string, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Localized symbol for a code, e.g. 'USD' → '$', 'EUR' → '€'. Falls back to the code. */
export function getCurrencySymbol(code: string, locale = 'en'): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

/**
 * Glyphs shared by several currencies, each listing candidate codes in priority
 * order (first = the documented fallback default). Phase 4 detection combines
 * this with explicit qualifiers (US$, CA$…) and the page's TLD/lang to resolve
 * which one a given price is in. See overview.md > Core B > Ambiguous-symbol resolution.
 */
export const AMBIGUOUS_SYMBOLS: Readonly<Record<string, readonly string[]>> = {
  $: ['USD', 'CAD', 'AUD', 'NZD', 'HKD', 'SGD', 'MXN'],
  '¥': ['JPY', 'CNY'],
  kr: ['SEK', 'NOK', 'DKK'],
};

/** Documented fallback currency for a glyph when it can't be disambiguated. */
export const SYMBOL_DEFAULTS: Readonly<Record<string, string>> = {
  $: 'USD',
  '¥': 'JPY',
  kr: 'SEK',
  '£': 'GBP',
  '€': 'EUR',
};
