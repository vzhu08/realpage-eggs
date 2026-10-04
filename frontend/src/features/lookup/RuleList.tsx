import type { Evaluation, Rule } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Tag } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { RESULT_ORDER, categoryLabel, humanize, parseReason, resultMeta } from '../../lib/labels';

interface Props {
  evaluations: Evaluation[];
  rules: Rule[];
  selectedRuleId: string | null;
  onInspect: (ruleId: string) => void;
  /** Rule IDs whose result just changed after an answer; they get a brief highlight. */
  changed: Set<string>;
}

/** Rules grouped by the evaluator's result. Groups are never merged into one "status". */
export function RuleList({ evaluations, rules, selectedRuleId, onInspect, changed }: Props) {
  const byId = new Map(rules.map((rule) => [rule.team_rule_id, rule]));
  const groups = RESULT_ORDER.map((result) => ({ result, items: evaluations.filter((evaluation) => evaluation.result === result) })).filter((group) => group.items.length > 0);
  const other = evaluations.filter((evaluation) => !RESULT_ORDER.includes(evaluation.result));
  if (other.length) groups.push({ result: other[0]!.result, items: other });

  return (
    <div className="rules">
      {groups.map((group) => {
        const meta = resultMeta(group.result);
        return (
          <section key={group.result} className="rules__group" aria-label={`${meta.group}: ${group.items.length}`}>
            <div className="rules__group-head">
              <h3>
                {meta.group} <span className="count">{group.items.length}</span>
              </h3>
              <p>{meta.gloss}</p>
            </div>
            <ul className="rules__list">
              {group.items.map((evaluation) => (
                <RuleRow
                  key={evaluation.team_rule_id}
                  evaluation={evaluation}
                  rule={byId.get(evaluation.team_rule_id)}
                  selected={selectedRuleId === evaluation.team_rule_id}
                  changed={changed.has(evaluation.team_rule_id)}
                  onInspect={() => onInspect(evaluation.team_rule_id)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function RuleRow({ evaluation, rule, selected, changed, onInspect }: { evaluation: Evaluation; rule: Rule | undefined; selected: boolean; changed: boolean; onInspect: () => void }) {
  const meta = resultMeta(evaluation.result);
  const reasons = (evaluation.uncertainty_reasons ?? []).map(parseReason);
  const missing = evaluation.missing_facts ?? [];
  const title = rule?.title ?? evaluation.team_rule_id;
  return (
    <li className={`rule rule--${meta.tone}${selected ? ' is-selected' : ''}${changed ? ' is-changed' : ''}`} data-rule-id={evaluation.team_rule_id} data-result={evaluation.result}>
      <div className="rule__main">
        <div className="rule__head">
          <Tag tone={meta.tone}>{meta.label}</Tag>
          {evaluation.conflict_flag && <Tag tone="danger">Conflict flagged</Tag>}
          {rule && <span className="rule__kicker">{categoryLabel(rule.category)}</span>}
        </div>
        <h4 className="rule__title">{title}</h4>
        {rule && (
          <p className="rule__meta">
            <span>{rule.jurisdiction}</span>
            <span aria-hidden="true">·</span>
            <span>{rule.citation}</span>
            <span aria-hidden="true">·</span>
            <span className="mono">{rule.source_doc_id}</span>
            {rule.effective_date && (
              <>
                <span aria-hidden="true">·</span>
                <span>effective {formatDate(rule.effective_date)}</span>
              </>
            )}
          </p>
        )}
        {rule && (
          <p className="rule__requirement">
            {rule.requirement}
            {rule.key_value && (
              <>
                {' '}
                <span className="rule__key">Key value: {rule.key_value}</span>
              </>
            )}
          </p>
        )}
        {missing.length > 0 && (
          <p className="rule__needs">
            <span className="rule__needs-label">Needs:</span> {missing.map(humanize).join(', ')}
          </p>
        )}
        {reasons.filter((reason) => reason.kind !== 'missing_property_fact').length > 0 && (
          <ul className="rule__reasons">
            {reasons
              .filter((reason) => reason.kind !== 'missing_property_fact')
              .map((reason) => (
                <li key={reason.raw}>
                  <span className="rule__reason-kind">{reason.label}:</span> {reason.message}
                </li>
              ))}
          </ul>
        )}
        <p className="rule__explanation">{evaluation.explanation}</p>
      </div>
      <button type="button" className="button button--small rule__inspect" onClick={onInspect} aria-pressed={selected} aria-label={`Inspect evidence for ${title}`}>
        <Icon name="quote" />
        Evidence
        <span className="count">{evaluation.evidence.length}</span>
      </button>
    </li>
  );
}
