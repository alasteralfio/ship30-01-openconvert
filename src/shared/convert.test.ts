import { describe, it, expect } from 'vitest';
import { convert } from './convert';

// Simple USD-anchored table: 1 USD = 0.5 EUR = 0.8 GBP = 100 JPY.
const rates = { USD: 1, EUR: 0.5, GBP: 0.8, JPY: 100 };

describe('convert', () => {
  it('converts via the anchor: A→B = amount * rates[B] / rates[A]', () => {
    expect(convert(10, 'EUR', 'USD', rates)).toBe(20); // 10 * (1 / 0.5)
    expect(convert(10, 'USD', 'EUR', rates)).toBe(5); // 10 * (0.5 / 1)
  });

  it('is identity for the same currency', () => {
    expect(convert(42.5, 'GBP', 'GBP', rates)).toBe(42.5);
  });

  it('rounds to 2 decimals by default', () => {
    expect(convert(1, 'JPY', 'USD', rates)).toBe(0.01); // 1 * (1 / 100)
  });

  it('honours a custom precision', () => {
    expect(convert(1, 'JPY', 'EUR', rates, 4)).toBe(0.005); // 1 * (0.5 / 100)
  });

  it('supports nearest-whole (precision 0)', () => {
    expect(convert(3, 'EUR', 'JPY', rates, 0)).toBe(600); // 3 * (100 / 0.5)
  });

  it('throws on an unknown currency', () => {
    expect(() => convert(1, 'USD', 'XXX', rates)).toThrow();
    expect(() => convert(1, 'XXX', 'USD', rates)).toThrow();
  });
});
