import { describe, it, expect } from 'vitest';
import { parseAmount, detectPrices } from './detect';
import type { DetectionContext } from './detect';

const KNOWN = new Set([
  'USD',
  'CAD',
  'AUD',
  'NZD',
  'HKD',
  'SGD',
  'MXN',
  'BRL',
  'EUR',
  'GBP',
  'JPY',
  'CNY',
  'SEK',
  'NOK',
  'DKK',
  'IDR',
  'INR',
  'THB',
  'MYR',
  'PLN',
  'CZK',
  'KRW',
  'TRY',
  'TWD',
  'PKR',
  'LKR',
  'NPR',
  'MUR',
  'LAK',
  'MNT',
  'PYG',
  'GHS',
  'KZT',
  'AZN',
  'GEL',
  'VND',
]);

function ctx(over: Partial<DetectionContext> = {}): DetectionContext {
  return { knownCodes: KNOWN, host: 'example.com', lang: 'en', fromFilter: [], ...over };
}

describe('parseAmount', () => {
  it('parses plain integers and decimals', () => {
    expect(parseAmount('100')).toBe(100);
    expect(parseAmount('1234.56')).toBe(1234.56);
  });

  it('treats a single separator with 3 trailing digits as thousands', () => {
    expect(parseAmount('1,234')).toBe(1234);
    expect(parseAmount('1.234')).toBe(1234);
    expect(parseAmount('10,000')).toBe(10000);
  });

  it('treats a single separator with non-3 trailing digits as a decimal', () => {
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount('1.5')).toBe(1.5);
  });

  it('uses the last separator as the decimal when both appear', () => {
    expect(parseAmount('1,299.99')).toBe(1299.99); // US style
    expect(parseAmount('1.299,99')).toBe(1299.99); // EU style
    expect(parseAmount('1.234.567,89')).toBe(1234567.89);
  });

  it('strips grouping spaces and non-breaking spaces', () => {
    expect(parseAmount('1 299,00')).toBe(1299); // nbsp thousands, comma decimal
    expect(parseAmount('1 000')).toBe(1000);
  });
});

describe('detectPrices', () => {
  it('detects a symbol before the number', () => {
    const [m] = detectPrices('It costs $100 today', ctx());
    expect(m).toMatchObject({ currency: 'USD', amount: 100, text: '$100' });
  });

  it('detects an ISO code after the number', () => {
    const [m] = detectPrices('Price: 92.00 EUR', ctx());
    expect(m).toMatchObject({ currency: 'EUR', amount: 92 });
  });

  it('detects a code before the number', () => {
    const [m] = detectPrices('USD 1,299.99', ctx());
    expect(m).toMatchObject({ currency: 'USD', amount: 1299.99 });
  });

  it('resolves an explicit qualifier over the bare glyph', () => {
    const [m] = detectPrices('CA$50', ctx());
    expect(m.currency).toBe('CAD');
  });

  it('detects distinctive single-currency symbols', () => {
    expect(detectPrices('Rp15.000', ctx())[0]).toMatchObject({ currency: 'IDR', amount: 15000 });
    expect(detectPrices('₹1,299', ctx())[0]).toMatchObject({ currency: 'INR', amount: 1299 });
    expect(detectPrices('฿250.50', ctx())[0]).toMatchObject({ currency: 'THB', amount: 250.5 });
    expect(detectPrices('RM 88', ctx())[0]).toMatchObject({ currency: 'MYR', amount: 88 });
    expect(detectPrices('Kč655', ctx())[0]).toMatchObject({ currency: 'CZK', amount: 655 });
  });

  it('detects the kanji yen glyph, distinct from the ambiguous ¥', () => {
    expect(detectPrices('3,780円', ctx())[0]).toMatchObject({ currency: 'JPY', amount: 3780 });
    expect(detectPrices('3,500円', ctx({ lang: 'zh-CN' }))[0]).toMatchObject({
      currency: 'JPY', // unlike ¥, 円 is unambiguous even with a Chinese-language hint
      amount: 3500,
    });
  });

  it('detects the Hangul won glyph and the "TL" Turkish Lira abbreviation', () => {
    expect(detectPrices('27,780원', ctx())[0]).toMatchObject({ currency: 'KRW', amount: 27780 });
    expect(detectPrices('299,90 TL', ctx())[0]).toMatchObject({ currency: 'TRY', amount: 299.9 });
  });

  it('does not let "TL" match inside a larger word', () => {
    expect(detectPrices('100 TLC', ctx())).toHaveLength(0);
  });

  it('detects further minor-currency symbols with no ambiguity to resolve', () => {
    expect(detectPrices('₭50,000', ctx())[0]).toMatchObject({ currency: 'LAK', amount: 50000 });
    expect(detectPrices('₮25,000', ctx())[0]).toMatchObject({ currency: 'MNT', amount: 25000 });
    expect(detectPrices('₲15,000', ctx())[0]).toMatchObject({ currency: 'PYG', amount: 15000 });
    expect(detectPrices('₵50', ctx())[0]).toMatchObject({ currency: 'GHS', amount: 50 });
    expect(detectPrices('₸1,500', ctx())[0]).toMatchObject({ currency: 'KZT', amount: 1500 });
    expect(detectPrices('₼25', ctx())[0]).toMatchObject({ currency: 'AZN', amount: 25 });
    expect(detectPrices('₾30', ctx())[0]).toMatchObject({ currency: 'GEL', amount: 30 });
  });

  it('resolves the rupee ambiguity ("Rs" and "₨") by TLD, defaulting to PKR', () => {
    expect(detectPrices('Rs 500', ctx())[0].currency).toBe('PKR'); // default
    expect(detectPrices('Rs. 500', ctx())[0].currency).toBe('PKR'); // abbreviation dot
    expect(detectPrices('₨500', ctx())[0].currency).toBe('PKR');
    expect(detectPrices('Rs 500', ctx({ host: 'shop.lk' }))[0].currency).toBe('LKR');
    expect(detectPrices('Rs 500', ctx({ host: 'shop.in' }))[0].currency).toBe('INR');
  });

  it('resolves the Chinese 元 by TLD, and only reads it after the number', () => {
    expect(detectPrices('299元', ctx())[0]).toMatchObject({ currency: 'CNY', amount: 299 });
    expect(detectPrices('299元', ctx({ host: 'shop.tw' }))[0].currency).toBe('TWD');
    // "公元2024" (CE 2024) is an ordinary year prefix, not a price — 元 before a
    // number must never match, unlike every other symbol.
    expect(detectPrices('公元2024年', ctx())).toHaveLength(0);
  });

  it('tolerates an abbreviation dot on alphabetic symbols (e.g. "Rp. 60.000")', () => {
    expect(detectPrices('Rp. 60.000', ctx())[0]).toMatchObject({ currency: 'IDR', amount: 60000 });
    expect(detectPrices('kr. 149', ctx())[0]).toMatchObject({ currency: 'SEK', amount: 149 });
  });

  it('detects the Vietnamese dong sign in real thousands-grouped formats', () => {
    expect(detectPrices('150.000₫', ctx())[0]).toMatchObject({ currency: 'VND', amount: 150000 });
    expect(detectPrices('1.500.000 ₫', ctx())[0]).toMatchObject({
      currency: 'VND',
      amount: 1500000,
    });
  });

  it('does not treat the Vietnamese letter "đ" as a currency mark', () => {
    // "đ" (Latin letter D with stroke, U+0111) is distinct from the dong sign "₫"
    // (U+20AB) above. It's intentionally unsupported: "đ" starts ordinary Vietnamese
    // words (đến = "to/until"), and our letter guard only recognises A-Za-z, so
    // treating "đ" as a symbol would misread "20 đến" as a 20-dong price.
    expect(detectPrices('20 đến 25', ctx())).toHaveLength(0);
  });

  it('uses a single from-filter candidate to disambiguate a glyph', () => {
    const [m] = detectPrices('$50', ctx({ fromFilter: ['AUD'] }));
    expect(m.currency).toBe('AUD');
  });

  it('falls back to the TLD heuristic, then the documented default', () => {
    expect(detectPrices('$50', ctx({ host: 'shop.ca' }))[0].currency).toBe('CAD');
    expect(detectPrices('$50', ctx())[0].currency).toBe('USD'); // default
    expect(detectPrices('¥500', ctx())[0].currency).toBe('JPY'); // default
    expect(detectPrices('¥500', ctx({ lang: 'zh-CN' }))[0].currency).toBe('CNY');
  });

  it('finds multiple prices in order', () => {
    const matches = detectPrices('$10 and £20 and 30 SEK', ctx());
    expect(matches.map((m) => m.currency)).toEqual(['USD', 'GBP', 'SEK']);
    expect(matches.map((m) => m.amount)).toEqual([10, 20, 30]);
  });

  it('ignores glyphs and codes embedded in words', () => {
    expect(detectPrices('darkroom lighting', ctx())).toHaveLength(0);
    expect(detectPrices('EURO trip', ctx())).toHaveLength(0);
  });

  it('ignores 3-letter tokens that are not known currency codes', () => {
    expect(detectPrices('BUY 100 NOW', ctx())).toHaveLength(0);
  });
});
