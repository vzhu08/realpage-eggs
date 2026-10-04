/**
 * Runtime validation of API payloads against the schemas generated from contracts/.
 * Supports exactly the JSON Schema subset the generator accepts (it rejects anything else),
 * so a payload that passes here matches the Pydantic models.
 *
 * Unknown extra properties are reported as warnings, not failures: an additive backend change
 * should surface as visible drift without taking the UI down. Missing or mistyped fields fail.
 */
import bundle from './generated/schemas.json';

interface Schema {
  $ref?: string;
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  items?: Schema;
  anyOf?: Schema[];
  enum?: unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
}

const defs = bundle.defs as unknown as Record<string, Schema>;
export type SchemaName = keyof typeof bundle.defs;

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const typeOf = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
};

const MAX_ISSUES = 12;

type Checked = WeakMap<object, Set<Schema>>;

function check(schema: Schema, value: unknown, path: string, out: ValidationResult, checked: Checked): void {
  const object = value !== null && typeof value === 'object' ? value : null;
  if (object && checked.get(object)?.has(schema)) return;
  const errors = out.errors.length, warnings = out.warnings.length;
  checkValue(schema, value, path, out, checked);
  if (object && out.errors.length === errors && out.warnings.length === warnings) {
    const schemas = checked.get(object) ?? new Set<Schema>();
    schemas.add(schema);
    checked.set(object, schemas);
  }
}

function checkValue(schema: Schema, value: unknown, path: string, out: ValidationResult, checked: Checked): void {
  if (out.errors.length >= MAX_ISSUES) return;
  if (schema.$ref) {
    const target = defs[schema.$ref];
    if (!target) {
      out.errors.push(`${path}: unknown schema ${schema.$ref}`);
      return;
    }
    check(target, value, path, out, checked);
    return;
  }
  if (schema.anyOf) {
    let best: ValidationResult | null = null;
    for (const option of schema.anyOf) {
      const attempt: ValidationResult = { errors: [], warnings: [] };
      check(option, value, path, attempt, checked);
      if (!attempt.errors.length) {
        out.warnings.push(...attempt.warnings);
        return;
      }
      if (!best || attempt.errors.length < best.errors.length) best = attempt;
    }
    out.errors.push(...(best?.errors ?? [`${path}: no alternative matched`]));
    return;
  }
  if (schema.const !== undefined && value !== schema.const) {
    out.errors.push(`${path}: expected ${JSON.stringify(schema.const)}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    out.errors.push(`${path}: ${JSON.stringify(value)} is not one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`);
    return;
  }
  if (schema.type) {
    const actual = typeOf(value);
    const matches = actual === schema.type || (schema.type === 'number' && actual === 'integer');
    if (!matches) {
      out.errors.push(`${path}: expected ${schema.type}, received ${actual}`);
      return;
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) out.errors.push(`${path}: below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) out.errors.push(`${path}: above maximum ${schema.maximum}`);
  } else if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) out.errors.push(`${path}: shorter than ${schema.minLength} characters`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) out.errors.push(`${path}: longer than ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) out.errors.push(`${path}: does not match ${schema.pattern}`);
  } else if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) out.errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) out.errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, index) => check(schema.items as Schema, item, `${path}[${index}]`, out, checked));
  } else if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const properties = schema.properties ?? {};
    for (const name of schema.required ?? []) {
      if (!(name in record)) out.errors.push(`${path}.${name}: required field is missing`);
    }
    for (const [name, child] of Object.entries(record)) {
      const propertySchema = properties[name];
      if (propertySchema) check(propertySchema, child, `${path}.${name}`, out, checked);
      else if (schema.additionalProperties === false) out.warnings.push(`${path}.${name}: field is not in the contract`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') check(schema.additionalProperties, child, `${path}.${name}`, out, checked);
    }
  }
}

export function validate(name: SchemaName, value: unknown): ValidationResult {
  const out: ValidationResult = { errors: [], warnings: [] };
  const schema = defs[name];
  if (!schema) out.errors.push(`Unknown contract model ${String(name)}`);
  else check(schema, value, name, out, new WeakMap());
  return out;
}

export const CONTRACT_DIGEST: string = bundle.digest;
