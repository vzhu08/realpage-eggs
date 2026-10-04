import { useId } from 'react';
import { DEFAULT_AS_OF } from '../../api/generated/meta';
import type { FixtureCaseSummary } from '../../api/types';
import { formatDate, isIsoDay } from '../../lib/dates';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  busy: boolean;
  /** Demo mode: the dates a recorded lookup exists for. */
  recordedDates?: string[];
  fixtureCase: FixtureCaseSummary | null;
  hasResult: boolean;
}

/**
 * The query date is always explicit. It starts at the contract's default (LookupRequest.as_of),
 * never at today's date, and nothing is looked up until the person runs it.
 */
export function AsOfControl({ value, onChange, onRun, busy, recordedDates, fixtureCase, hasResult }: Props) {
  const id = useId();
  const valid = isIsoDay(value);
  const error = value === '' ? 'Choose the date to evaluate the rules on.' : valid ? null : 'Enter a real calendar date.';
  return (
    <form
      className="asof"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) onRun();
      }}
    >
      <div className="asof__row">
        <div className="field">
          <label htmlFor={id} className="label">
            As of date
          </label>
          <input id={id} type="date" className="input input--date" value={value} min="1900-01-01" max="2199-12-31" required aria-invalid={error ? true : undefined} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} onChange={(event) => onChange(event.target.value)} />
        </div>
        <button type="submit" className="button button--primary" disabled={busy || !valid}>
          {busy ? 'Looking up…' : hasResult ? 'Run lookup again' : 'Run lookup'}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="field__error" role="alert">
          {error}
        </p>
      )}
      <p id={`${id}-hint`} className="hint">
        {fixtureCase ? (
          <>
            The “{fixtureCase.title}” fixture is recorded for {formatDate(fixtureCase.as_of)}. Changing the date leaves the fixture.
          </>
        ) : (
          <>
            The date is always explicit. It starts at the contract default, {formatDate(DEFAULT_AS_OF)}
            {value !== DEFAULT_AS_OF && (
              <>
                {' '}
                <button type="button" className="link" onClick={() => onChange(DEFAULT_AS_OF)}>
                  Reset
                </button>
              </>
            )}
            , never today’s date.
          </>
        )}
      </p>
      {recordedDates && recordedDates.length > 0 && !fixtureCase && (
        <div className="asof__recorded">
          <span className="hint">Recorded in the demo:</span>
          {recordedDates.map((date) => (
            <button key={date} type="button" className="pill" aria-pressed={date === value} onClick={() => onChange(date)}>
              {formatDate(date)}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
