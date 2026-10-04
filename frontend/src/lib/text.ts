/**
 * Evidence offsets are zero-based Python Unicode character offsets `[start, end)` into the
 * unchanged source text (docs/CONTRACTS.md). JavaScript strings index UTF-16 code units, so
 * slicing must go through code points or any astral character would shift every later quote.
 */
export function codePointSlice(text: string, start: number, end: number): string {
  let index = 0;
  let out = '';
  for (const char of text) {
    if (index >= end) break;
    if (index >= start) out += char;
    index += 1;
  }
  return out;
}

export function codePointLength(text: string): number {
  return Array.from(text).length;
}

export interface Excerpt {
  before: string;
  match: string;
  after: string;
  /** True when text was cut before/after the shown window. */
  clippedStart: boolean;
  clippedEnd: boolean;
}

/** The text around `[start, end)`, widened to whole lines within `radius` characters. */
export function excerptAround(text: string, start: number, end: number, radius = 320): Excerpt {
  const chars = Array.from(text);
  let from = Math.max(0, start - radius);
  let to = Math.min(chars.length, end + radius);
  // Prefer line boundaries so the window reads as whole provisions.
  for (let i = start - 1; i >= from; i -= 1) {
    if (chars[i] === '\n' && start - i > radius / 2) {
      from = i + 1;
      break;
    }
  }
  for (let i = end; i < to; i += 1) {
    if (chars[i] === '\n' && i - end > radius / 2) {
      to = i;
      break;
    }
  }
  return {
    before: chars.slice(from, start).join(''),
    match: chars.slice(start, end).join(''),
    after: chars.slice(end, to).join(''),
    clippedStart: from > 0,
    clippedEnd: to < chars.length,
  };
}

export type QuoteCheck =
  | { state: 'match'; start: number; end: number }
  | { state: 'mismatch'; start: number; end: number; found: string }
  | { state: 'no_offsets' }
  | { state: 'no_text' };

/**
 * Literal comparison of a quote with the source snapshot at its recorded offsets. This shows
 * only that the characters occur there; it says nothing about whether they support the rule.
 */
export function checkQuote(text: string | undefined, quote: string, start: number | null | undefined, end: number | null | undefined): QuoteCheck {
  if (!text) return { state: 'no_text' };
  if (start === null || start === undefined || end === null || end === undefined) return { state: 'no_offsets' };
  const found = codePointSlice(text, start, end);
  return found === quote ? { state: 'match', start, end } : { state: 'mismatch', start, end, found };
}

export const shortHash = (value: string | null | undefined, length = 12): string => (value ? `${value.slice(0, length)}…` : '—');
