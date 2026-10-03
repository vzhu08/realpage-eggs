/**
 * Replays recorded evaluator output for a research fixture. This is deliberately not an
 * evaluator: an answer can only change the result when the fixture already contains the
 * evaluator's recorded output for exactly that value. Anything else is reported as
 * "not evaluated" and the recorded baseline stays on screen.
 */
import type { Answer, AnswerDisposition, AssistResponse, Evaluation, ReplayedAlternative } from '../api/types';
import type { ResearchFixture } from './fixtures';

export interface FixtureReplay {
  assist: AssistResponse;
  dispositions: AnswerDisposition[];
  replayed?: ReplayedAlternative;
  notices: string[];
}

/** Lookup responses list only these results; inapplicable/failed stay in audit history (docs/CONTRACTS.md). */
const LISTED = new Set<Evaluation['result']>(['applies', 'unknown', 'superseded', 'not_yet_effective', 'pending']);

const sameScalar = (a: unknown, b: unknown): boolean => a === b && typeof a === typeof b;

/** Every recorded probe value for a field, for telling the user what the demo can replay. */
export function recordedValues(fixture: ResearchFixture, field: string): unknown[] {
  const values: unknown[] = [];
  for (const question of fixture.response.question_plan.questions) {
    for (const alternative of question.alternatives) {
      if (field in alternative.probe_facts) values.push(alternative.probe_facts[field]);
    }
  }
  return values;
}

export function replayFixture(fixture: ResearchFixture, answers: Answer[]): FixtureReplay {
  const base = fixture.response;
  const known = answers.filter((answer) => answer.value !== null);
  const unknown = answers.filter((answer) => answer.value === null);
  const unknownDisposition = (answer: Answer): AnswerDisposition => ({
    field: answer.field,
    status: 'applied',
    note: 'Recorded as unknown. The fixture baseline already treats this fact as missing, so the result does not change.',
  });

  if (!known.length) {
    return {
      assist: { ...base, answers_applied: unknown.map(stripValue) },
      dispositions: unknown.map(unknownDisposition),
      notices: [],
    };
  }

  // A recorded alternative matches only when its probe is exactly the set of known answers.
  for (const question of base.question_plan.questions) {
    for (const alternative of question.alternatives) {
      const probe = Object.entries(alternative.probe_facts);
      const matches = probe.length === known.length && known.every((answer) => answer.field in alternative.probe_facts && sameScalar(alternative.probe_facts[answer.field], answer.value));
      if (!matches) continue;

      const listed = alternative.evaluations.filter((evaluation) => LISTED.has(evaluation.result));
      const listedIds = new Set(listed.map((evaluation) => evaluation.team_rule_id));
      const rules = base.lookup.rules.filter((rule) => listedIds.has(rule.team_rule_id));
      const sourceIds = new Set(rules.flatMap((rule) => rule.evidence.map((item) => item.doc_id)));
      const answered = new Set(known.map((answer) => answer.field));
      const assist: AssistResponse = {
        ...base,
        lookup: { ...base.lookup, evaluations: listed, rules, sources: base.lookup.sources.filter((source) => sourceIds.has(source.doc_id)) },
        question_plan: {
          ...base.question_plan,
          questions: base.question_plan.questions.filter((candidate) => !answered.has(candidate.fact.field)),
          remaining_uncertainty: [
            ...alternative.remaining_uncertainty,
            ...base.question_plan.remaining_uncertainty.filter((item) => !(item.kind === 'property_fact' && item.field && answered.has(item.field))),
          ],
        },
        answers_applied: answers.map(stripValue),
      };
      return {
        assist,
        dispositions: [
          ...known.map((answer): AnswerDisposition => ({ field: answer.field, status: 'applied', note: `Replayed the recorded evaluator output for “${alternative.label}”.` })),
          ...unknown.map(unknownDisposition),
        ],
        replayed: { questionId: question.question_id, alternativeId: alternative.alternative_id, label: alternative.label, evaluations: alternative.evaluations },
        notices: [`Replayed the fixture’s recorded evaluator output for “${alternative.label}”. The demo does not evaluate rules itself.`],
      };
    }
  }

  const describe = (answer: Answer) => {
    const values = recordedValues(fixture, answer.field);
    const list = values.length ? `Recorded values: ${values.map((value) => String(value)).join(', ')}.` : 'This fixture records no evaluator output for that fact.';
    return `No recorded evaluator output for ${answer.field} = ${String(answer.value)}. ${list}`;
  };
  return {
    assist: { ...base, answers_applied: unknown.map(stripValue) },
    dispositions: [...known.map((answer): AnswerDisposition => ({ field: answer.field, status: 'not_evaluated', note: describe(answer) })), ...unknown.map(unknownDisposition)],
    notices: ['Some answers could not be evaluated in the synthetic demo. The recorded baseline is shown unchanged; use a recorded value or switch to the live API.'],
  };
}

function stripValue(answer: Answer) {
  return { field: answer.field, value: answer.value, provenance: answer.provenance, note: answer.note ?? null };
}
