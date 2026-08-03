// Currency metadata. We support every ISO code the rate provider returns, so there's
// no 160-row table to maintain — display names come from the runtime Intl API. Only
// the shared/ambiguous symbols are hand-authored, since price detection has to map a
// glyph back to its candidate codes.

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
 * Glyphs shared by several currencies, listing candidates in priority order (first =
 * fallback default). Detection combines this with explicit qualifiers (US$, CA$…) and
 * the page's TLD/lang to decide which one a given price is in.
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
