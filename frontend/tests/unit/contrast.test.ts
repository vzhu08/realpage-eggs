/**
 * Contrast of the design tokens (WCAG 2.x). Every text color is checked against every ground
 * the styles put it on (4.5:1), and the edges and marks that carry meaning without text are
 * checked against their ground (3:1). A pair belongs here as soon as a stylesheet relies on it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (name: string) => readFileSync(new URL(`../../src/styles/${name}`, import.meta.url), 'utf8');
const css = read('tokens.css');
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

/** Text color → every ground it is set on. */
const TEXT: Record<string, string[]> = {
  // Body text: the page ground, working surfaces, wells, every wash and quoted source text.
  ink: ['paper', 'paper-deep', 'surface', 'surface-2', 'accent-wash', 'applies-wash', 'unknown-wash', 'future-wash', 'pending-wash', 'muted-wash', 'danger-wash', 'info-wash', 'quote-wash', 'highlight'],
  // Secondary text: notices, cues, receipts and claim cards put it on washes as well.
  'ink-2': ['paper', 'paper-deep', 'surface', 'surface-2', 'accent-wash', 'applies-wash', 'unknown-wash', 'danger-wash', 'info-wash', 'quote-wash'],
  // Hints, labels, identifiers and metadata.
  'ink-3': ['paper', 'paper-deep', 'surface', 'surface-2', 'accent-wash', 'unknown-wash'],
  // Links, quiet buttons, the current view, selected pills and tabs.
  accent: ['paper', 'surface', 'surface-2', 'accent-wash'],
  'accent-hover': ['paper', 'surface', 'surface-2', 'accent-wash'],
  'on-accent': ['accent', 'accent-hover'],
  // Status words: on their own wash (tags, tiles), and on plain surfaces (check results, needs, row labels).
  applies: ['applies-wash', 'surface', 'surface-2'],
  unknown: ['unknown-wash', 'paper', 'surface', 'surface-2'],
  future: ['future-wash', 'surface'],
  pending: ['pending-wash', 'surface'],
  muted: ['muted-wash', 'surface', 'surface-2'],
  danger: ['danger-wash', 'paper', 'surface', 'surface-2'],
  info: ['info-wash', 'surface'],
  // The synthetic banner and the "Next" label are light text on the darkest ground.
  'synthetic-ink': ['synthetic-bg'],
  'synthetic-bg': ['synthetic-tag'],
  'synthetic-tag': ['synthetic-bg'],
  surface: ['ink'],
  'gold-ink': ['paper', 'surface', 'surface-2', 'hero-paper', 'gold-wash'],
  'on-dark': ['ink'],
  'on-dark-muted': ['ink'],
  'on-dark-gold': ['ink'],
};

/** Edges and marks that carry meaning without text → the ground they sit on (3:1). */
const NON_TEXT: Record<string, string[]> = {
  // The boundary of a field, a search box and a choice.
  'control-line': ['surface', 'surface-2'],
  // Focus ring, selected borders, the bar under the current tab and view.
  accent: ['paper', 'paper-deep', 'surface', 'surface-2', 'accent-wash'],
  // Status bars on rule cards and impact tiles, and the rule beside quoted text. Each repeats a word.
  applies: ['surface'],
  'unknown-mark': ['surface'],
  future: ['surface'],
  pending: ['surface'],
  danger: ['surface'],
  // Icons drawn in the secondary inks.
  'ink-3': ['paper', 'surface', 'surface-2', 'paper-deep'],
};

for (const [foreground, grounds] of Object.entries(TEXT)) {
  for (const background of grounds) {
    test(`text --${foreground} on --${background} is at least 4.5:1`, () => {
      const ratio = contrast(color(foreground), color(background));
      assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1`);
    });
  }
}

for (const [foreground, grounds] of Object.entries(NON_TEXT)) {
  for (const background of grounds) {
    test(`mark --${foreground} on --${background} is at least 3:1`, () => {
      const ratio = contrast(color(foreground), color(background));
      assert.ok(ratio >= 3, `${ratio.toFixed(2)}:1`);
    });
  }
}

test('every color the stylesheets use is a token', () => {
  // A literal color in a component rule would escape the checks above. Shadows and scrims use rgb().
  for (const name of ['base.css', 'app.css', 'portfolio.css', 'tenent.css']) {
    const literals = [...read(name).replace(/url\([^)]*\)/g, '').matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0]);
    assert.deepEqual(literals, [], `${name} uses literal colors`);
  }
});

test('every token named in a stylesheet is defined', () => {
  const defined = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/gi)].map((match) => match[1]!));
  for (const name of ['base.css', 'app.css', 'portfolio.css', 'tenent.css']) {
    const sheet = read(name);
    const local = new Set([...sheet.matchAll(/--([a-z0-9-]+)\s*:/gi)].map((match) => match[1]!));
    const missing = [...new Set([...sheet.matchAll(/var\(--([a-z0-9-]+)/gi)].map((match) => match[1]!))].filter((token) => !defined.has(token) && !local.has(token));
    assert.deepEqual(missing, [], `${name} uses undefined tokens`);
  }
});
