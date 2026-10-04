/** Text/background pairs from the design tokens must meet WCAG AA (4.5:1 for body text). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const tokens = new Map<string, string>();
for (const match of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) tokens.set(match[1]!, match[2]!);

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const color = (name: string) => {
  const value = tokens.get(name);
  assert.ok(value, `token --${name}`);
  return value;
};

const PAIRS: Array<[string, string]> = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink-2', 'paper'],
  ['ink-2', 'paper-deep'],
  ['ink-3', 'paper'],
  ['ink-3', 'surface'],
  ['ink-3', 'paper-deep'],
  ['accent', 'paper'],
  ['accent', 'surface'],
  ['accent', 'accent-wash'],
  ['on-accent', 'accent'],
  ['applies', 'applies-wash'],
  ['unknown', 'unknown-wash'],
  ['unknown', 'paper'],
  ['future', 'future-wash'],
  ['pending', 'pending-wash'],
  ['muted', 'muted-wash'],
  ['danger', 'danger-wash'],
  ['danger', 'surface'],
  ['info', 'info-wash'],
  ['ink', 'highlight'],
  ['synthetic-ink', 'synthetic-bg'],
  ['synthetic-bg', 'synthetic-tag'],
  // UX-04: timeline markers, the selected summary row, unresolved-location labels, claim cards.
  ['ink-3', 'accent-wash'],
  ['ink', 'accent-wash'],
  ['unknown', 'surface'],
  ['ink-2', 'surface'],
  ['ink-3', 'unknown-wash'],
];

for (const [foreground, background] of PAIRS) {
  test(`--${foreground} on --${background} is at least 4.5:1`, () => {
    const ratio = contrast(color(foreground), color(background));
    assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1`);
  });
}
