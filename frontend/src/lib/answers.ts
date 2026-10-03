/**
 * Turning what a person typed into a typed answer for the request.
 *
 * These checks mirror the input contract in docs/ASSIST_CONTRACT.md (JSON booleans, integer
 * counts, YYYY / YYYY-MM / YYYY-MM-DD dates with precision preserved, exact enum values) so
 * mistakes are caught before the request. The service remains the authority and may still
 * answer 422.
 */
import type { AnswerValue, FactDefinition } from '../api/types';
import { datePrecision } from './dates';
import type { AnswerForm } from './expression';

export type ParseResult = { ok: true; value: Exclude<AnswerValue, null> } | { ok: false; error: string };

/** The input control and limits for a fact, from its contract definition. */
export function formFromDefinition(definition: FactDefinition): AnswerForm {
  switch (definition.data_type) {
    case 'boolean':
      return { type: 'boolean' };
    case 'integer':
      return { type: 'integer', minimum: definition.minimum ?? undefined };
    case 'number':
      return { type: 'number', minimum: definition.minimum ?? undefined };
    case 'date':
      return { type: 'date', allowPartial: definition.allow_partial_date ?? true };
    case 'enum':
      return { type: 'enum', options: definition.allowed_values ?? [] };
    default:
      return { type: 'string' };
  }
}

export function parseAnswer(form: AnswerForm, raw: string, limits: { minimum?: number | null; maximum?: number | null } = {}): ParseResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'Enter a value, or choose “I don’t know”.' };
  switch (form.type) {
    case 'boolean':
      if (text === 'true') return { ok: true, value: true };
      if (text === 'false') return { ok: true, value: false };
      return { ok: false, error: 'Choose Yes or No, or “I don’t know”.' };
    case 'integer':
    case 'number': {
      if (!/^-?\d+(\.\d+)?$/.test(text)) return { ok: false, error: form.type === 'integer' ? 'Enter a whole number using digits only.' : 'Enter a number using digits only.' };
      const value = Number(text);
      if (!Number.isFinite(value)) return { ok: false, error: 'Enter a finite number.' };
      if (form.type === 'integer' && !Number.isInteger(value)) return { ok: false, error: 'Enter a whole number, without a decimal part.' };
      const minimum = limits.minimum ?? form.minimum;
      if (minimum !== undefined && minimum !== null && value < minimum) return { ok: false, error: `Enter ${minimum} or more.` };
      if (limits.maximum !== undefined && limits.maximum !== null && value > limits.maximum) return { ok: false, error: `Enter ${limits.maximum} or less.` };
      return { ok: true, value };
    }
    case 'date': {
      const precision = datePrecision(text);
      if (!precision) return { ok: false, error: form.allowPartial ? 'Use YYYY, YYYY-MM or YYYY-MM-DD, with a real calendar date.' : 'Use YYYY-MM-DD with a real calendar date.' };
      if (!form.allowPartial && precision !== 'day') return { ok: false, error: 'This fact needs a full date: YYYY-MM-DD.' };
      return { ok: true, value: text };
    }
    case 'enum':
      return form.options.includes(text) ? { ok: true, value: text } : { ok: false, error: 'Choose one of the listed values.' };
    default:
      return text.length > 500 ? { ok: false, error: 'Use 500 characters or fewer.' } : { ok: true, value: text };
  }
}

/** The text an existing answer should show when it is reopened for editing. */
export function answerToRaw(value: AnswerValue): string {
  return value === null ? '' : String(value);
}
