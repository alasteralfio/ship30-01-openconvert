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
  });

  it('tolerates an abbreviation dot on alphabetic symbols (e.g. "Rp. 60.000")', () => {
    expect(detectPrices('Rp. 60.000', ctx())[0]).toMatchObject({ currency: 'IDR', amount: 60000 });
    expect(detectPrices('kr. 149', ctx())[0]).toMatchObject({ currency: 'SEK', amount: 149 });
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
