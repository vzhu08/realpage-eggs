#!/usr/bin/env node
/**
 * Derives the frontend's TypeScript types and runtime schemas from the canonical,
 * Platform-stewarded contracts. Nothing here is hand-maintained API shape.
 *
 *   contracts/openapi.json          (implemented routes + their models)
 *   contracts/research.schema.json  (additive assist/evidence models; proposed routes)
 *
 * Outputs (committed, regenerate with `npm run generate`):
 *   src/api/generated/contract.ts   TypeScript declarations
 *   src/api/generated/schemas.json  de-duplicated JSON Schemas for runtime payload validation
 *   src/api/generated/meta.ts       contract facts the UI must not hard-code (default date, disclaimer, routes)
 *
 * `--check` regenerates in memory and fails when the committed output is stale.
 * No dependencies: the Pydantic-emitted schema subset is small and fully enumerated below.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const contractsDir = resolve(here, '../../contracts');
const outDir = resolve(here, '../src/api/generated');
const check = process.argv.includes('--check');

const readRaw = (name) => readFileSync(resolve(contractsDir, name), 'utf8');
const openapiRaw = readRaw('openapi.json');
const researchRaw = readRaw('research.schema.json');
const openapi = JSON.parse(openapiRaw);
const research = JSON.parse(researchRaw);

/** Keywords this generator understands. Anything else fails loudly instead of being ignored. */
const KNOWN = new Set([
  '$ref', '$defs', 'type', 'properties', 'required', 'additionalProperties', 'items', 'anyOf',
  'enum', 'const', 'default', 'title', 'description', 'format', 'pattern', 'minimum', 'maximum',
  'minLength', 'maxLength', 'minItems', 'maxItems',
]);

const stable = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );

/** Rewrite refs to bare definition names and drop presentation-only keywords. */
function normalize(schema, where) {
  if (Array.isArray(schema)) return schema.map((s, i) => normalize(s, `${where}[${i}]`));
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!KNOWN.has(key)) throw new Error(`Unsupported schema keyword "${key}" at ${where}`);
    if (key === '$defs' || key === 'title') continue;
    if (key === '$ref') {
      const match = /^#\/(?:components\/schemas|\$defs)\/([A-Za-z0-9_]+)$/.exec(value);
      if (!match) throw new Error(`Unsupported $ref "${value}" at ${where}`);
      out.$ref = match[1];
    } else if (key === 'properties') {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([name, prop]) => [name, normalize(prop, `${where}.${name}`)]),
      );
    } else if (key === 'items' || key === 'anyOf' || (key === 'additionalProperties' && typeof value === 'object')) {
      out[key] = normalize(value, `${where}.${key}`);
    } else {
      out[key] = value;
    }
  }
  return out;
}

const defs = new Map();
const origin = new Map();
/** Pydantic omits `default: null` in FastAPI's OpenAPI output but keeps it in model_json_schema(); that is not drift. */
const comparable = (schema) =>
  stable(JSON.parse(JSON.stringify(schema, (key, value) => (key === 'default' && value === null ? undefined : value))));
function register(name, schema, from) {
  const normalized = normalize(schema, name);
  const existing = defs.get(name);
  if (existing && comparable(existing) !== comparable(normalized)) {
    throw new Error(
      `Contract drift: "${name}" differs between ${origin.get(name)} and ${from}. ` +
        'Ask the Platform steward to regenerate contracts/ (python -m navigator contracts).',
    );
  }
  if (!existing) {
    defs.set(name, normalized);
    origin.set(name, from);
  }
}

for (const [name, schema] of Object.entries(openapi.components.schemas)) register(name, schema, 'openapi.json');
for (const [name, schema] of Object.entries(research)) {
  for (const [inner, innerSchema] of Object.entries(schema.$defs ?? {})) register(inner, innerSchema, 'research.schema.json');
  register(name, schema, 'research.schema.json');
}

const names = [...defs.keys()].sort();

// ---------------------------------------------------------------- TypeScript
const ident = (key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key));
const literal = (v) => JSON.stringify(v);

function tsType(schema, indent) {
  if (schema.$ref) return schema.$ref;
  if (schema.const !== undefined) return literal(schema.const);
  if (schema.enum) return schema.enum.map(literal).join(' | ');
  if (schema.anyOf) {
    const parts = schema.anyOf.map((s) => tsType(s, indent));
    return parts.map((p) => (p.includes(' | ') || p.includes('=>') ? `(${p})` : p)).join(' | ');
  }
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array': {
      const item = schema.items ? tsType(schema.items, indent) : 'unknown';
      return item.includes(' | ') ? `Array<${item}>` : `${item}[]`;
    }
    case 'object': {
      if (schema.properties) return tsObject(schema, indent);
      const extra = schema.additionalProperties;
      if (extra && typeof extra === 'object') return `Record<string, ${tsType(extra, indent)}>`;
      return 'Record<string, unknown>';
    }
    case undefined:
      // Pydantic `Any`: the contract deliberately leaves this open (scalars are validated server-side).
      return 'unknown';
    default:
      throw new Error(`Unsupported type "${schema.type}"`);
  }
}

function doc(schema, pad) {
  const lines = [];
  if (schema.description) lines.push(schema.description);
  if (schema.format) lines.push(`Format: ${schema.format}`);
  if (schema.pattern) lines.push(`Pattern: ${schema.pattern}`);
  if (schema.minimum !== undefined) lines.push(`Minimum: ${schema.minimum}`);
  if (schema.maximum !== undefined) lines.push(`Maximum: ${schema.maximum}`);
  if (schema.default !== undefined) lines.push(`Default: ${literal(schema.default)}`);
  if (!lines.length) return '';
  return `${pad}/** ${lines.join(' · ').replace(/\*\//g, '* /')} */\n`;
}

function tsObject(schema, indent) {
  const pad = '  '.repeat(indent + 1);
  const required = new Set(schema.required ?? []);
  const body = Object.entries(schema.properties)
    .map(([name, prop]) => `${doc(prop, pad)}${pad}${ident(name)}${required.has(name) ? '' : '?'}: ${tsType(prop, indent + 1)};`)
    .join('\n');
  return `{\n${body}\n${'  '.repeat(indent)}}`;
}

const sourceHash = createHash('sha256').update(openapiRaw).update(researchRaw).digest('hex').slice(0, 16);
const banner = `/* eslint-disable */
// GENERATED FILE — do not edit. Source of truth: contracts/openapi.json and contracts/research.schema.json
// (generated by the backend from navigator/models.py). Regenerate with \`npm run generate\`.
// Contract digest: ${sourceHash}
`;

let ts = `${banner}\n`;
for (const name of names) {
  const schema = defs.get(name);
  const from = origin.get(name);
  ts += `/** ${name} — from contracts/${from}${schema.description ? `. ${schema.description}` : ''} */\n`;
  ts += schema.type === 'object' && schema.properties ? `export interface ${name} ${tsObject(schema, 0)}\n\n` : `export type ${name} = ${tsType(schema, 0)};\n\n`;
}

// ---------------------------------------------------------------- meta
const prefix = '/api/v1';
const routes = Object.entries(openapi.paths).flatMap(([path, methods]) =>
  Object.keys(methods).map((method) => `${method.toUpperCase()} ${path.startsWith(prefix) ? path.slice(prefix.length) : path}`),
);
const asOfDefault = openapi.components.schemas.LookupRequest?.properties?.as_of?.default;
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDefault ?? '')) throw new Error('LookupRequest.as_of default missing from the contract');
const limits = research.AssistRequest?.$defs?.AnalysisLimits?.properties ?? {};
const limitDefaults = Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, v.default]));

const meta = `${banner}
/** API title from the OpenAPI document; the product name used in the UI. */
export const API_TITLE = ${literal(openapi.info.title)};
/** Contract version from the OpenAPI document. */
export const CONTRACT_VERSION = ${literal(openapi.info.version)};
/** The backend's disclaimer, published as the OpenAPI description. Shown before any response arrives. */
export const CONTRACT_DISCLAIMER = ${literal(openapi.info.description)};
/** LookupRequest.as_of default. The UI must use this, never the machine clock. */
export const DEFAULT_AS_OF = ${literal(asOfDefault)};
/** Route prefix shared by every documented path. */
export const API_PREFIX = ${literal(prefix)};
/** Routes present in the checked-in OpenAPI document (i.e. implemented by the backend at this contract). */
export const IMPLEMENTED_ROUTES = ${JSON.stringify(routes.sort(), null, 2)} as const;
/** AnalysisLimits defaults from the assist contract. */
export const ANALYSIS_LIMIT_DEFAULTS = ${JSON.stringify(limitDefaults, null, 2)} as const;
/** Digest of the contract files these outputs were generated from. */
export const CONTRACT_DIGEST = ${literal(sourceHash)};
`;

const schemasJson = `${JSON.stringify({ digest: sourceHash, defs: Object.fromEntries(names.map((n) => [n, defs.get(n)])) }, null, 1)}\n`;

const outputs = [
  ['contract.ts', ts],
  ['meta.ts', meta],
  ['schemas.json', schemasJson],
];

if (check) {
  const stale = outputs.filter(([file, content]) => {
    try {
      return readFileSync(resolve(outDir, file), 'utf8') !== content;
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`Generated contract files are stale: ${stale.map(([f]) => f).join(', ')}. Run \`npm run generate\`.`);
    process.exit(1);
  }
  console.log(`Generated contract files match contracts/ (digest ${sourceHash}, ${names.length} models).`);
} else {
  mkdirSync(outDir, { recursive: true });
  for (const [file, content] of outputs) writeFileSync(resolve(outDir, file), content);
  console.log(`Wrote ${outputs.length} files to src/api/generated (digest ${sourceHash}, ${names.length} models).`);
}
