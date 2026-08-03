// Price + currency detection: symbol/ISO-code matching, number parsing across
// common thousand/decimal formats, and ambiguous-symbol resolution
// (qualifier > single-currency from-filter > TLD/lang heuristic > documented default).
// Pure functions over a string plus some page context — no DOM access.

import { AMBIGUOUS_SYMBOLS, SYMBOL_DEFAULTS } from '../shared/currencies';

/** What the detector needs to resolve ambiguous glyphs and validate codes. */
export interface DetectionContext {
  /** ISO codes present in the cached rate table (only these are convertible). */
  knownCodes: Set<string>;
  /** Page hostname (`location.hostname`) for the TLD heuristic. */
  host: string;
  /** `<html lang>` for the language heuristic. */
  lang: string;
  /** Active from-filter (empty = All); used as a disambiguation hint. */
  fromFilter: string[];
}

/** One detected price within a text string. */
export interface PriceMatch {
  /** Resolved ISO source code. */
  currency: string;
  /** Parsed numeric amount. */
  amount: number;
  /** Start index of the match in the source text. */
  start: number;
  /** End index (exclusive). */
  end: number;
  /** The matched substring (kept as the hover-tooltip original). */
  text: string;
}

// Distinctive glyphs that map to exactly one currency (no disambiguation needed).
// Kept low-false-positive: only symbols unlikely to collide with ordinary words.
const DIRECT_SYMBOLS: Readonly<Record<string, string>> = {
  Rp: 'IDR',
  RM: 'MYR',
  zł: 'PLN',
  Kč: 'CZK',
  '₹': 'INR',
  '₩': 'KRW',
  '₽': 'RUB',
  '฿': 'THB',
  '₺': 'TRY',
  '₴': 'UAH',
  '₦': 'NGN',
  '₱': 'PHP',
  '₫': 'VND',
  '₪': 'ILS',
};

// Explicit qualifiers pin an otherwise-ambiguous `$` to one currency (priority 1).
const QUALIFIERS: Readonly<Record<string, string>> = {
  US$: 'USD',
  U$: 'USD',
  CA$: 'CAD',
  C$: 'CAD',
  AU$: 'AUD',
  A$: 'AUD',
  NZ$: 'NZD',
  HK$: 'HKD',
  SG$: 'SGD',
  S$: 'SGD',
  MX$: 'MXN',
  R$: 'BRL',
  NT$: 'TWD',
};

// Symbol alternatives, longest first so `US$` wins over a bare `$`. `kr` is the
// only alphabetic glyph, so it carries letter guards in the assembled pattern.
const SYMBOLS = [
  'US\\$',
  'U\\$',
  'CA\\$',
  'C\\$',
  'AU\\$',
  'A\\$',
  'NZ\\$',
  'HK\\$',
  'SG\\$',
  'S\\$',
  'MX\\$',
  'NT\\$',
  'R\\$',
  // Alphabetic symbols may carry an abbreviation dot (e.g. Codashop's "Rp. 60.000",
  // Nordic "kr."). The optional dot is stripped during resolution.
  'Rp\\.?',
  'RM\\.?',
  'zł\\.?',
  'Kč\\.?',
  'kr\\.?',
  'Kr\\.?',
  '\\$',
  '€', // €
  '£', // £
  '¥', // ¥
  '₹', // INR
  '₩', // KRW
  '₽', // RUB
  '฿', // THB
  '₺', // TRY
  '₴', // UAH
  '₦', // NGN
  '₱', // PHP
  '₫', // VND
  '₪', // ILS
].join('|');

// A number with common thousands/decimal formats: 1,299.99 · 1.299,99 · 1 299,00
// · 10,000 · 1234.56 · 100. Disambiguation of `.` vs `,` happens in parseAmount.
const NUM = '\\d+(?:[.,\\u00A0\\u202F ]\\d{3})*(?:[.,]\\d+)?';

// Four placements: symbol|code before or after the number. Letter lookarounds keep
// glyphs/codes from matching inside words (e.g. `kr` in "darkroom", `EUR` in "EURO").
const PATTERN = [
  `(?<![A-Za-z])(?<sym1>${SYMBOLS})[\\s\\u00A0]?(?<num1>${NUM})`,
  `(?<num2>${NUM})[\\s\\u00A0]?(?<sym2>${SYMBOLS})(?![A-Za-z])`,
  `(?<![A-Za-z])(?<code1>[A-Z]{3})(?![A-Za-z])[\\s\\u00A0]?(?<num3>${NUM})`,
  `(?<num4>${NUM})[\\s\\u00A0]?(?<![A-Za-z])(?<code2>[A-Z]{3})(?![A-Za-z])`,
].join('|');

// Compiled once and reused; detectPrices resets lastIndex before each scan.
const PRICE_RE = new RegExp(PATTERN, 'g');

/** Parse a formatted number, deciding which separator is the decimal point. */
export function parseAmount(raw: string): number | null {
  // Drop everything but digits and the two separators; this also removes
  // spaces, non-breaking spaces, and narrow no-break spaces used as thousands.
  let s = raw.replace(/[^\d.,]/g, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // The last-occurring separator is the decimal; the other groups thousands.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = decideSingleSeparator(s, ',');
  } else if (hasDot) {
    s = decideSingleSeparator(s, '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * One separator, ambiguous between thousands and decimal. Multiple occurrences →
 * thousands (1.234.567). A single occurrence with exactly 3 trailing digits →
 * thousands (1,234 → 1234); otherwise decimal (12,50 → 12.5).
 */
function decideSingleSeparator(s: string, sep: string): string {
  const parts = s.split(sep);
  if (parts.length > 2) return parts.join('');
  return parts[1].length === 3 ? parts.join('') : parts.join('.');
}

/** Map an ambiguous glyph to a currency by TLD, then language. */
function heuristic(symbol: string, host: string, lang: string): string | null {
  const l = lang.toLowerCase();
  if (symbol === '$') {
    if (host.endsWith('.ca')) return 'CAD';
    if (host.endsWith('.au')) return 'AUD';
    if (host.endsWith('.nz')) return 'NZD';
    if (host.endsWith('.mx')) return 'MXN';
    if (host.endsWith('.sg')) return 'SGD';
    if (host.endsWith('.hk')) return 'HKD';
    return 'USD';
  }
  if (symbol === '¥') {
    return l.startsWith('zh') || host.endsWith('.cn') ? 'CNY' : 'JPY';
  }
  if (symbol === 'kr') {
    if (host.endsWith('.no')) return 'NOK';
    if (host.endsWith('.dk')) return 'DKK';
    return 'SEK';
  }
  return null;
}

/** Resolve a matched symbol/qualifier to a single ISO code per the priority order. */
function resolveSymbol(raw: string, ctx: DetectionContext): string | null {
  const base = raw.endsWith('.') ? raw.slice(0, -1) : raw; // drop an abbreviation dot
  if (QUALIFIERS[base]) return QUALIFIERS[base]; // 1. explicit qualifier
  if (DIRECT_SYMBOLS[base]) return DIRECT_SYMBOLS[base]; // unambiguous glyph
  const symbol = base === 'Kr' ? 'kr' : base;
  const candidates = AMBIGUOUS_SYMBOLS[symbol];
  if (candidates) {
    // 2. from-filter naming exactly one candidate that uses this glyph
    const inFilter = ctx.fromFilter.filter((c) => candidates.includes(c));
    if (inFilter.length === 1) return inFilter[0];
    // 3. host/language heuristic
    const guessed = heuristic(symbol, ctx.host, ctx.lang);
    if (guessed) return guessed;
    // 4. documented default
    return SYMBOL_DEFAULTS[symbol] ?? candidates[0];
  }
  return SYMBOL_DEFAULTS[symbol] ?? null; // unique glyph (£, €)
}

/** Find every currency price in `text`, left to right and non-overlapping. */
export function detectPrices(text: string, ctx: DetectionContext): PriceMatch[] {
  PRICE_RE.lastIndex = 0;
  const matches: PriceMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = PRICE_RE.exec(text)) !== null) {
    const g = m.groups;
    if (!g) continue;
    const rawNum = g.num1 ?? g.num2 ?? g.num3 ?? g.num4;
    if (rawNum === undefined) continue;
    const amount = parseAmount(rawNum);
    if (amount === null) continue;

    const code = g.code1 ?? g.code2;
    const symbol = g.sym1 ?? g.sym2;
    const currency = code ? code : symbol ? resolveSymbol(symbol, ctx) : null;
    if (!currency || !ctx.knownCodes.has(currency)) continue;

    matches.push({ currency, amount, start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return matches;
}
