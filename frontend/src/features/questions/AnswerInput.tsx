import { useId, useState } from 'react';
import type { AnswerValue } from '../../api/types';
import { answerToRaw, parseAnswer } from '../../lib/answers';
import type { AnswerForm } from '../../lib/expression';
import { sentence } from '../../lib/labels';

interface Props {
  form: AnswerForm;
  /** Accessible name for the control: the question being answered. */
  legend: string;
  unit?: string | null;
  limits?: { minimum?: number | null; maximum?: number | null };
  initial?: AnswerValue;
  busy: boolean;
  submitLabel?: string;
  onSubmit: (value: Exclude<AnswerValue, null>) => void;
  /** "I don't know" — recorded as an explicit unknown, never as a guess. */
  onUnknown: () => void;
  onCancel?: () => void;
}

/** A typed answer control. The value is validated before it is sent; unknown is always one click away. */
export function AnswerInput({ form, legend, unit, limits, initial, busy, submitLabel = 'Apply answer', onSubmit, onUnknown, onCancel }: Props) {
  const id = useId();
  const [raw, setRaw] = useState(() => answerToRaw(initial ?? null));
  const [error, setError] = useState<string | null>(null);

  const change = (value: string) => {
    setRaw(value);
    if (error) setError(null);
  };

  const describedBy = [`${id}-format`, error ? `${id}-error` : ''].filter(Boolean).join(' ');
  const format =
    form.type === 'date'
      ? form.allowPartial
        ? 'Format: YYYY, YYYY-MM or YYYY-MM-DD. Give only the precision you can document; it is kept as entered.'
        : 'Format: YYYY-MM-DD.'
      : form.type === 'integer'
        ? `A whole number${unit ? ` of ${unit}` : ''}${limits?.minimum !== undefined && limits.minimum !== null ? `, ${limits.minimum} or more` : ''}.`
        : form.type === 'number'
          ? `A number${unit ? ` of ${unit}` : ''}.`
          : form.type === 'boolean'
            ? 'Answer from a documented fact, not a legal conclusion.'
            : form.type === 'enum'
              ? 'Choose the documented value.'
              : 'Up to 500 characters.';

  return (
    <form
      className="answer"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseAnswer(form, raw, limits);
        if (!parsed.ok) {
          setError(parsed.error);
          return;
        }
        onSubmit(parsed.value);
      }}
    >
      {form.type === 'boolean' ? (
        <fieldset className="answer__choices" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
          <legend className="sr-only">{legend}</legend>
          {[
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ].map((option) => (
            <label key={option.value} className="choice">
              <input type="radio" name={`${id}-choice`} value={option.value} checked={raw === option.value} onChange={() => change(option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      ) : form.type === 'enum' ? (
        <div className="answer__field">
          <label htmlFor={id} className="sr-only">
            {legend}
          </label>
          <select id={id} className="input" value={raw} onChange={(event) => change(event.target.value)} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
            <option value="">Choose…</option>
            {form.options.map((option) => (
              <option key={option} value={option}>
                {sentence(option)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="answer__field">
          <label htmlFor={id} className="sr-only">
            {legend}
          </label>
          <div className="input-group">
            <input
              id={id}
              className="input"
              type="text"
              inputMode={form.type === 'integer' ? 'numeric' : form.type === 'number' ? 'decimal' : 'text'}
              value={raw}
              onChange={(event) => change(event.target.value)}
              placeholder={form.type === 'date' ? 'YYYY-MM-DD' : undefined}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
            />
            {unit && form.type !== 'date' && <span className="input-group__unit">{unit}</span>}
          </div>
        </div>
      )}
      <div className="answer__actions">
        <button type="submit" className="button button--primary" disabled={busy}>
          {submitLabel}
        </button>
        <button type="button" className="button" onClick={onUnknown} disabled={busy}>
          I don’t know
        </button>
        {onCancel && (
          <button type="button" className="button button--quiet" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
      <p id={`${id}-format`} className="hint">
        {format}
      </p>
      {error && (
        <p id={`${id}-error`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
