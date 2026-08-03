import { describe, expect, it } from 'vitest';
import { evaluateExpression } from './expr';

describe('evaluateExpression', () => {
  it('returns a plain number as itself', () => {
    expect(evaluateExpression('42')).toBe(42);
    expect(evaluateExpression('3.14')).toBe(3.14);
    expect(evaluateExpression('.5')).toBe(0.5);
  });

  it('adds and subtracts left to right', () => {
    expect(evaluateExpression('12 + 4.50')).toBe(16.5);
    expect(evaluateExpression('10 - 3 - 2')).toBe(5);
  });

  it('honours multiplication/division precedence', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14);
    expect(evaluateExpression('10 / 4')).toBe(2.5);
  });

  it('handles parentheses and unary signs', () => {
    expect(evaluateExpression('(2 + 3) * 4')).toBe(20);
    expect(evaluateExpression('-5')).toBe(-5);
    expect(evaluateExpression('-(2 + 3)')).toBe(-5);
    expect(evaluateExpression('3 * -2')).toBe(-6);
  });

  it('ignores surrounding whitespace', () => {
    expect(evaluateExpression('  8  ')).toBe(8);
  });

  it('rejects empty, malformed, or unsupported input', () => {
    expect(evaluateExpression('')).toBeNull();
    expect(evaluateExpression('   ')).toBeNull();
    expect(evaluateExpression('abc')).toBeNull();
    expect(evaluateExpression('12 +')).toBeNull();
    expect(evaluateExpression('1 2')).toBeNull();
    expect(evaluateExpression('(1 + 2')).toBeNull();
    expect(evaluateExpression('2 ** 3')).toBeNull();
  });

  it('rejects division by zero', () => {
    expect(evaluateExpression('5 / 0')).toBeNull();
  });
});
