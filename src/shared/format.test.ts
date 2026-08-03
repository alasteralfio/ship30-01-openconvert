import { describe, expect, it } from 'vitest';
import { formatNumber } from './format';

describe('formatNumber', () => {
  it('groups thousands and sets the decimal separator per format', () => {
    expect(formatNumber(1234.56, 'comma-dot', 2)).toBe('1,234.56');
    expect(formatNumber(1234.56, 'dot-comma', 2)).toBe('1.234,56');
    expect(formatNumber(1234.56, 'space-comma', 2)).toBe('1 234,56');
  });

  it('groups every three digits in large numbers', () => {
    expect(formatNumber(1234567.89, 'comma-dot', 2)).toBe('1,234,567.89');
    expect(formatNumber(1234567.89, 'dot-comma', 2)).toBe('1.234.567,89');
  });

  it('rounds and pads to the requested precision', () => {
    expect(formatNumber(9.005, 'comma-dot', 2)).toBe('9.01');
    expect(formatNumber(9.1, 'comma-dot', 3)).toBe('9.100');
    expect(formatNumber(9.9, 'comma-dot', 0)).toBe('10'); // nearest whole, no separator
    expect(formatNumber(1234.9, 'comma-dot', 0)).toBe('1,235');
  });

  it('keeps small numbers ungrouped', () => {
    expect(formatNumber(12.5, 'comma-dot', 2)).toBe('12.50');
    expect(formatNumber(0, 'dot-comma', 2)).toBe('0,00');
  });

  it('handles negatives', () => {
    expect(formatNumber(-1234.5, 'comma-dot', 2)).toBe('-1,234.50');
    expect(formatNumber(-1234.5, 'dot-comma', 2)).toBe('-1.234,50');
  });
});
