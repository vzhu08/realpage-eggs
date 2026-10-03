import { useState } from 'react';
import type { Answer, AnswerValue, FactDefinition, LookupOutcome } from '../../api/types';
import { Disclosure, SectionHeading, Tag } from '../../components/ui';
import { formFromDefinition } from '../../lib/answers';
import { inferAnswerForm } from '../../lib/expression';
import { PROVENANCE_LABELS, type Tone, formatValue, sentence } from '../../lib/labels';
import type { AnswerEvent } from '../../state/session';
import { AnswerInput } from './AnswerInput';

interface Props {
  answers: Answer[];
  history: AnswerEvent[];
  outcome: LookupOutcome;
  definitions: Record<string, FactDefinition>;
  busy: boolean;
  onAnswer: (field: string, value: AnswerValue, provenance: Answer['provenance']) => void;
  onRemove: (field: string) => void;
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  applied: { label: 'Applied', tone: 'applies' },
  sent_as_supplemental_fact: { label: 'Sent as supplemental fact', tone: 'applies' },
  withheld_unknown: { label: 'Kept as unknown', tone: 'muted' },
  not_evaluated: { label: 'Not evaluated', tone: 'unknown' },
  pending: { label: 'Not applied', tone: 'unknown' },
};

const ACTIONS: Record<AnswerEvent['action'], string> = { answered: 'Answered', changed: 'Changed', marked_unknown: 'Marked unknown', removed: 'Removed' };

/** Every answer in play, who supplied it, and what the last request did with it. */
export function AnswerHistory({ answers, history, outcome, definitions, busy, onAnswer, onRemove }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  if (!answers.length && !history.length) return null;
  const dispositions = new Map(outcome.dispositions.map((item) => [item.field, item]));

  return (
    <section className="section" aria-labelledby="answers-heading">
      <SectionHeading
        id="answers-heading"
        title={
          <>
            Your answers <span className="count">{answers.length}</span>
          </>
        }
      />
      <p className="section__lead">Answers apply to this session’s requests only. All of them are sent again with every request, and none changes the stored property record.</p>
      {answers.length === 0 ? (
        <p className="hint">No answers are in play. The result above uses only the recorded property facts.</p>
      ) : (
        <ul className="answers">
          {answers.map((answer) => {
            const disposition = dispositions.get(answer.field);
            const status = STATUS[disposition?.status ?? 'pending'] ?? STATUS.pending!;
            const definition = definitions[answer.field];
            return (
              <li key={answer.field} className="answers__item" data-field={answer.field}>
                <div className="answers__row">
                  <div className="answers__what">
                    <p className="answers__field">{sentence(answer.field)}</p>
                    <p className="answers__value">{answer.value === null ? 'I don’t know' : formatValue(answer.value)}</p>
                  </div>
                  <div className="answers__tags">
                    <Tag tone={answer.provenance === 'demo' ? 'info' : 'neutral'} icon={false}>
                      {PROVENANCE_LABELS[answer.provenance ?? 'user_provided'] ?? answer.provenance}
                    </Tag>
                    <Tag tone={status.tone}>{status.label}</Tag>
                  </div>
                  <div className="answers__actions">
                    <button type="button" className="button button--small button--quiet" onClick={() => setEditing(editing === answer.field ? null : answer.field)} aria-expanded={editing === answer.field} disabled={busy}>
                      Edit<span className="sr-only"> answer for {sentence(answer.field)}</span>
                    </button>
                    <button type="button" className="button button--small button--quiet" onClick={() => onRemove(answer.field)} disabled={busy}>
                      Remove<span className="sr-only"> answer for {sentence(answer.field)}</span>
                    </button>
                  </div>
                </div>
                {disposition?.note && <p className="answers__note">{disposition.note}</p>}
                {editing === answer.field && (
                  <div className="answers__edit">
                    {definition && <p className="hint">{definition.meaning}</p>}
                    <AnswerInput
                      key={`${answer.field}:${String(answer.value)}`}
                      form={definition ? formFromDefinition(definition) : inferAnswerForm(answer.field, outcome.lookup.rules)}
                      legend={`New answer for ${sentence(answer.field)}`}
                      unit={definition?.unit}
                      limits={definition ? { minimum: definition.minimum, maximum: definition.maximum } : undefined}
                      initial={answer.value}
                      busy={busy}
                      submitLabel="Re-evaluate"
                      onSubmit={(value) => {
                        setEditing(null);
                        onAnswer(answer.field, value, 'user_provided');
                      }}
                      onUnknown={() => {
                        setEditing(null);
                        onAnswer(answer.field, null, 'user_provided');
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {history.length > 0 && (
        <Disclosure summary={`Answer history (${history.length} ${history.length === 1 ? 'change' : 'changes'})`}>
          <ol className="history">
            {history.map((event) => (
              <li key={event.seq}>
                <span className="history__seq">{event.seq}</span>
                <span>
                  <strong>{ACTIONS[event.action]}</strong> {sentence(event.field).toLowerCase()}
                  {event.action === 'removed' ? (
                    <> (was {formatValue(event.previous)})</>
                  ) : event.action === 'changed' ? (
                    <>
                      : {formatValue(event.previous)} → {formatValue(event.value)}
                    </>
                  ) : event.action === 'answered' ? (
                    <>: {formatValue(event.value)}</>
                  ) : null}
                  <span className="history__provenance"> · {PROVENANCE_LABELS[event.provenance ?? 'user_provided']}</span>
                </span>
              </li>
            ))}
          </ol>
        </Disclosure>
      )}
    </section>
  );
}
