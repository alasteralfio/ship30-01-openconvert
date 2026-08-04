// Recursive-descent evaluator for the amount field (e.g. "12 + 4.50"): numbers, + - * /,
// parentheses, leading sign. Returns null on anything empty, malformed, or non-finite. No eval.

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: string };

/** Split the input into number and operator tokens, or null if a stray character shows up. */
function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '(' || c === ')') {
      tokens.push({ kind: 'op', value: c });
      i++;
      continue;
    }
    // A number: digits with an optional single decimal point.
    const match = /^\d*\.?\d+/.exec(input.slice(i));
    if (!match) return null;
    tokens.push({ kind: 'num', value: Number(match[0]) });
    i += match[0].length;
  }
  return tokens;
}

/**
 * Evaluate an arithmetic expression, or null if it's empty, malformed, or blows up (e.g.
 * division by zero). A plain number like "42" parses to itself.
 */
export function evaluateExpression(input: string): number | null {
  const tokens = tokenize(input);
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  // expr = term (('+' | '-') term)*
  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek()?.kind === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = eat().value;
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  // term = factor (('*' | '/') factor)*
  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (peek()?.kind === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = eat().value;
      const right = parseFactor();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  // factor = ('+' | '-') factor | '(' expr ')' | number
  function parseFactor(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.kind === 'op' && (t.value === '+' || t.value === '-')) {
      eat();
      const operand = parseFactor();
      if (operand === null) return null;
      return t.value === '-' ? -operand : operand;
    }
    if (t.kind === 'op' && t.value === '(') {
      eat();
      const inner = parseExpr();
      if (inner === null) return null;
      if (peek()?.kind !== 'op' || peek().value !== ')') return null;
      eat();
      return inner;
    }
    if (t.kind === 'num') {
      eat();
      return t.value;
    }
    return null;
  }

  const result = parseExpr();
  // Reject leftover tokens (e.g. "1 2") and non-finite results.
  if (result === null || pos !== tokens.length || !Number.isFinite(result)) return null;
  return result;
}
