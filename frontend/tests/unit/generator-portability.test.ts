import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('contract generation tolerates LF/CRLF checkouts but still detects schema changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'navigator-contract-lines-'));
  try {
    const scripts = join(root, 'frontend/scripts');
    const contracts = join(root, 'contracts');
    const generated = join(root, 'frontend/src/api/generated');
    mkdirSync(scripts, { recursive: true });
    mkdirSync(contracts);
    const script = join(scripts, 'generate-contract-types.mjs');
    writeFileSync(script, readFileSync(new URL('../../scripts/generate-contract-types.mjs', import.meta.url)));
    const inputs = ['openapi.json', 'research.schema.json'];
    const sources = inputs.map(name => ({ name, text: readFileSync(new URL(`../../../contracts/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n') }));
    sources.forEach(({ name, text }) => writeFileSync(join(contracts, name), text));
    execFileSync(process.execPath, [script]);
    const outputs = ['contract.ts', 'meta.ts', 'schemas.json'];
    const baseline = outputs.map(name => ({ name, text: readFileSync(join(generated, name), 'utf8').replace(/\r\n/g, '\n') }));
    for (const inputEol of ['\n', '\r\n']) {
      sources.forEach(({ name, text }) => writeFileSync(join(contracts, name), text.replace(/\n/g, inputEol)));
      for (const outputEol of ['\n', '\r\n']) {
        baseline.forEach(({ name, text }) => writeFileSync(join(generated, name), text.replace(/\n/g, outputEol)));
        assert.match(execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' }), /match contracts\//);
      }
    }
    const openapiPath = join(contracts, 'openapi.json');
    const changed = JSON.parse(readFileSync(openapiPath, 'utf8'));
    changed.info.title += ' changed';
    writeFileSync(openapiPath, JSON.stringify(changed));
    const drift = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
    assert.equal(drift.status, 1);
    assert.match(drift.stderr, /stale/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
