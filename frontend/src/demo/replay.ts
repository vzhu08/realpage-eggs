/**
 * Replays recorded evaluator output for an assist response. This is deliberately not an
 * evaluator: an answer can only change the result when the response already contains the
 * evaluator's recorded output for that value — either the exact probe, or a numeric interval
 * the planner itself declared for an alternative. Anything else is reported as "not evaluated"
 * and the recorded baseline stays on screen.
 */
import type { AlternativeOutcome, Answer, AnswerDisposition, AssistResponse, Evaluation, ReplayedAlternative, Uncertainty } from '../api/types';

export interface AssistReplay {
  assist: AssistResponse;
  dispositions: AnswerDisposition[];
  replayed?: ReplayedAlternative;
  notices: string[];
}

/** Lookup responses list only these results; inapplicable/failed stay in audit history (docs/CONTRACTS.md). */
const LISTED = new Set<Evaluation['result']>(['applies', 'unknown', 'superseded', 'not_yet_effective', 'pending']);

const sameScalar = (a: unknown, b: unknown): boolean => a === b && typeof a === typeof b;

export interface NumericInterval {
  lower: number | null;
  upper: number | null;
  lowerInclusive: boolean;
  upperInclusive: boolean;
  unit?: string;
}

/** The planner's interval for an alternative, when it has the documented numeric shape. */
export function readInterval(alternative: AlternativeOutcome): NumericInterval | null {
  const interval = alternative.interval;
  if (!interval || typeof interval !== 'object') return null;
  const bound = (value: unknown): number | null | undefined => (value === null || value === undefined ? null : typeof value === 'number' ? value : undefined);
  const lower = bound(interval.lower);
  const upper = bound(interval.upper);
  if (lower === undefined || upper === undefined || (lower === null && upper === null)) return null;
  return {
    lower,
    upper,
    lowerInclusive: interval.lower_inclusive !== false,
    upperInclusive: interval.upper_inclusive !== false,
    unit: typeof interval.unit === 'string' ? interval.unit : undefined,
  };
}

export function intervalContains(interval: NumericInterval, value: number): boolean {
  if (interval.lower !== null && (interval.lowerInclusive ? value < interval.lower : value <= interval.lower)) return false;
  if (interval.upper !== null && (interval.upperInclusive ? value > interval.upper : value >= interval.upper)) return false;
  return true;
}

/** Every recorded probe value for a field, for telling the user what the demo can replay. */
export function recordedValues(base: AssistResponse, field: string): unknown[] {
  const values: unknown[] = [];
  for (const question of base.question_plan.questions) {
    for (const alternative of question.alternatives) {
      if (field in alternative.probe_facts) values.push(alternative.probe_facts[field]);
    }
  }
  return values;
}

/** How one alternative matches the known answers: exactly, through its declared interval, or not at all. */
function matchAlternative(alternative: AlternativeOutcome, known: Answer[]): 'exact' | 'interval' | null {
  const probe = Object.keys(alternative.probe_facts);
  if (probe.length !== known.length || !known.every((answer) => answer.field in alternative.probe_facts)) return null;
  if (known.every((answer) => sameScalar(alternative.probe_facts[answer.field], answer.value))) return 'exact';
  // An interval describes a single numeric fact; the planner marks its probe as a representative.
  const interval = readInterval(alternative);
  const only = known[0];
  if (interval && known.length === 1 && only && typeof only.value === 'number' && typeof alternative.probe_facts[only.field] === 'number' && intervalContains(interval, only.value)) return 'interval';
  return null;
}

const uncertaintyKey = (item: Uncertainty) => `${item.kind}|${item.field ?? ''}|${item.message}`;

export function replayAssist(base: AssistResponse, answers: Answer[]): AssistReplay {
  const known = answers.filter((answer) => answer.value !== null);
  const unknown = answers.filter((answer) => answer.value === null);
  const unknownDisposition = (answer: Answer): AnswerDisposition => ({
    field: answer.field,
    status: 'applied',
    note: 'Recorded as unknown. The recorded baseline already treats this fact as missing, so the result does not change.',
  });

  if (!known.length) {
    return { assist: { ...base, answers_applied: unknown.map(stripValue) }, dispositions: unknown.map(unknownDisposition), notices: [] };
  }

  for (const question of base.question_plan.questions) {
    for (const alternative of question.alternatives) {
      const match = matchAlternative(alternative, known);
      if (!match) continue;

      const listed = alternative.evaluations.filter((evaluation) => LISTED.has(evaluation.result));
      const listedIds = new Set(listed.map((evaluation) => evaluation.team_rule_id));
      const rules = base.lookup.rules.filter((rule) => listedIds.has(rule.team_rule_id));
      const sourceIds = new Set(rules.flatMap((rule) => rule.evidence.map((item) => item.doc_id)));
      const answered = new Set(known.map((answer) => answer.field));
      const remaining = new Map<string, Uncertainty>();
      for (const item of [...alternative.remaining_uncertainty, ...base.question_plan.remaining_uncertainty.filter((entry) => !(entry.kind === 'property_fact' && entry.field && answered.has(entry.field)))]) {
        if (!remaining.has(uncertaintyKey(item))) remaining.set(uncertaintyKey(item), item);
      }
      const assist: AssistResponse = {
        ...base,
        lookup: { ...base.lookup, evaluations: listed, rules, sources: base.lookup.sources.filter((source) => sourceIds.has(source.doc_id)) },
        question_plan: {
          ...base.question_plan,
          questions: base.question_plan.questions.filter((candidate) => !answered.has(candidate.fact.field)),
          remaining_uncertainty: [...remaining.values()],
          // Traces describe the unanswered baseline; they are not carried into a replayed answer.
          traces: [],
        },
        answers_applied: answers.map(stripValue),
      };
      const how =
        match === 'exact'
          ? `Replayed the recorded evaluator output for “${alternative.label}”.`
          : `Replayed the recorded outcome for “${alternative.label}”, the planner’s interval that contains this answer. The evaluator’s wording below was recorded for its probe value ${String(alternative.probe_facts[known[0]!.field])}.`;
      return {
        assist,
        dispositions: [...known.map((answer): AnswerDisposition => ({ field: answer.field, status: 'applied', note: how })), ...unknown.map(unknownDisposition)],
        replayed: { questionId: question.question_id, alternativeId: alternative.alternative_id, label: alternative.label, evaluations: alternative.evaluations },
        notices: [`${how} The demo does not evaluate rules itself.`],
      };
    }
  }

  const describe = (answer: Answer) => {
    const values = recordedValues(base, answer.field);
    const list = values.length ? `Recorded values: ${values.map((value) => String(value)).join(', ')}.` : 'This recording holds no evaluator output for that fact.';
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
