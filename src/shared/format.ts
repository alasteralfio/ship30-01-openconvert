// Pure number-format rendering for converted output. The user picks the format
// explicitly — grouping/decimal separators are not inferred from the locale. Shared
// by the popup and content script so their values look identical. No I/O.

/**
 * Explicit thousands-group + decimal-separator styles offered in the popup:
 * - `comma-dot`  → 1,234.56  (US/UK; default)
 * - `dot-comma`  → 1.234,56  (DE/ES/IT)
 * - `space-comma`→ 1 234,56  (FR)
 */
export type NumberFormat = 'comma-dot' | 'dot-comma' | 'space-comma';

/** [thousands group, decimal separator] for each format. */
const SEPARATORS: Record<NumberFormat, readonly [string, string]> = {
  'comma-dot': [',', '.'],
  'dot-comma': ['.', ','],
  'space-comma': [' ', ','],
};

/** Sample rendering shown in the format picker. */
export const FORMAT_LABELS: Record<NumberFormat, string> = {
  'comma-dot': '1,234.56',
  'dot-comma': '1.234,56',
  'space-comma': '1 234,56',
};

/**
 * Format a number with the chosen grouping/decimal separators and a fixed number
 * of decimal places. `precision` pads and rounds (0 = nearest whole, no decimals).
 */
export function formatNumber(value: number, format: NumberFormat, precision: number): string {
  const [group, decimal] = SEPARATORS[format];
  const fixed = value.toFixed(Math.max(0, precision)); // rounds + pads, may carry a leading '-'
  const negative = fixed.startsWith('-');
  const [intPart, fracPart] = (negative ? fixed.slice(1) : fixed).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const body = fracPart ? `${grouped}${decimal}${fracPart}` : grouped;
  return negative ? `-${body}` : body;
}
