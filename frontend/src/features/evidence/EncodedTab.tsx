import type { EncodedRuleRendering, Evaluation, Evidence, Rule } from '../../api/types';
import { Facts, Notice, Tag } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { type ExpressionNode, describeExpression, isLiteralFalse } from '../../lib/expression';
import { TRUTH_LABELS, formatValue, resultMeta, sentence, temporalLabel } from '../../lib/labels';
import { shortHash } from '../../lib/text';

interface Props {
  rule: Rule;
  evaluation: Evaluation | null;
  rendering: EncodedRuleRendering | null;
  rendererState: string | null;
  asOf: string;
}

/**
 * Source text and the encoded rule, side by side, so a reviewer can see what was encoded
 * against what the source says. The rule-level encoding is kept apart from the
 * property-specific evaluation: the first is the same for every property.
 */
export function EncodedTab({ rule, evaluation, rendering, rendererState, asOf }: Props) {
  const primary: Evidence | undefined = rule.evidence.find((item) => item.quote === rule.quoted_span) ?? rule.evidence[0];
  return (
    <div className="evidence-tab">
      <div className="compare">
        <section className="compare__side" aria-labelledby="compare-source">
          <h4 id="compare-source" className="compare__title">
            The source says
          </h4>
          <blockquote className="compare__quote">{rule.quoted_span}</blockquote>
          <p className="hint">
            {rule.citation}
            {primary ? ` · ${primary.doc_id}` : ''}
          </p>
        </section>
        <section className="compare__side" aria-labelledby="compare-encoded">
          <h4 id="compare-encoded" className="compare__title">
            The rule is encoded as
          </h4>
          {rendering ? (
            <>
              <p className="compare__rendering">{rendering.text}</p>
              <p className="hint">
                Deterministic rendering · renderer {rendering.renderer_version} · expression {shortHash(rendering.expression_hash, 10)}
              </p>
              {(rendering.unresolved_nodes ?? []).length > 0 && (
                <Notice tone="unknown" title="Parts of the rule could not be rendered" compact>
                  <ul className="plain-list plain-list--tight">
                    {(rendering.unresolved_nodes ?? []).map((node) => (
                      <li key={node} className="mono">
                        {node}
                      </li>
                    ))}
                  </ul>
                </Notice>
              )}
            </>
          ) : (
            <p className="hint">{rendererState ?? 'No deterministic rendering is available for this rule.'} The encoded structure is shown as stored.</p>
          )}
          <Facts
            dense
            rows={[
              { label: 'Requirement', value: rule.requirement },
              ...(rule.key_value ? [{ label: 'Key value', value: rule.key_value }] : []),
              { label: 'Lifecycle', value: sentence(rule.lifecycle) },
              { label: 'Effective', value: rule.effective_date ? `${formatDate(rule.effective_date)} (inclusive)` : 'Not recorded' },
              ...(rule.end_date ? [{ label: 'Ends', value: `${formatDate(rule.end_date)} (exclusive)` }] : []),
              ...(rule.exemptions ? [{ label: 'Exemptions text', value: rule.exemptions }] : []),
              ...(rule.penalties ? [{ label: 'Penalties', value: rule.penalties }] : []),
            ]}
          />
          <div className="expression">
            <p className="expression__label">Covered when</p>
            <ExpressionTree node={describeExpression(rule.coverage_conditions, 'coverage_conditions')} />
            <p className="expression__label">Exempt when</p>
            {isLiteralFalse(rule.exemption_conditions) ? <p className="expression__none">No exemption is encoded.</p> : <ExpressionTree node={describeExpression(rule.exemption_conditions!, 'exemption_conditions')} />}
          </div>
        </section>
      </div>
      <p className="hint">The encoded rule is a structured reading of the source. Showing it is not legal validation of that reading.</p>

      {evaluation && (
        <section className="record" aria-labelledby="compare-evaluation">
          <h4 id="compare-evaluation" className="record__title">
            For this property on {formatDate(asOf)}
          </h4>
          <p className="record__lead">
            <Tag tone={resultMeta(evaluation.result).tone}>{resultMeta(evaluation.result).label}</Tag> {evaluation.explanation}
          </p>
          <Facts
            dense
            rows={[
              { label: 'Jurisdiction match', value: TRUTH_LABELS[evaluation.jurisdiction] ?? evaluation.jurisdiction },
              { label: 'Date status', value: temporalLabel(evaluation.temporal_status) },
              { label: 'Coverage', value: TRUTH_LABELS[evaluation.coverage.value] ?? evaluation.coverage.value },
              ...((evaluation.coverage.matched ?? []).length ? [{ label: 'Conditions evaluated', value: <CodeList items={evaluation.coverage.matched ?? []} /> }] : []),
              ...((evaluation.coverage.unresolved ?? []).length ? [{ label: 'Unresolved', value: <CodeList items={evaluation.coverage.unresolved ?? []} /> }] : []),
              ...((evaluation.applied_interactions ?? []).length ? [{ label: 'Interactions applied', value: <CodeList items={evaluation.applied_interactions ?? []} /> }] : []),
            ]}
          />
          <SupportingFacts facts={evaluation.coverage.supporting_facts ?? {}} />
        </section>
      )}
    </div>
  );
}

function CodeList({ items }: { items: string[] }) {
  return (
    <ul className="code-list">
      {items.map((item) => (
        <li key={item}>
          <code className="code">{item}</code>
        </li>
      ))}
    </ul>
  );
}

function SupportingFacts({ facts }: { facts: Record<string, unknown> }) {
  const rows = Object.entries(facts);
  if (!rows.length) return null;
  return (
    <table className="table table--facts">
      <caption className="table__caption">Facts the evaluation used</caption>
      <thead>
        <tr>
          <th scope="col">Fact</th>
          <th scope="col">Value</th>
          <th scope="col">Provenance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, raw]) => {
          const support = (raw && typeof raw === 'object' ? raw : {}) as { value?: unknown; bound?: { lower?: number | null; upper?: number | null } | null; provenance?: unknown };
          const value = support.value !== null && support.value !== undefined ? formatValue(support.value) : support.bound ? `${support.bound.lower ?? 'unbounded'} to ${support.bound.upper ?? 'unbounded'}` : 'Unknown';
          return (
            <tr key={name}>
              <th scope="row">{sentence(name)}</th>
              <td className="num">{value}</td>
              <td className="table__muted">{typeof support.provenance === 'string' ? support.provenance : 'Not recorded'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ExpressionTree({ node }: { node: ExpressionNode }) {
  if (node.kind !== 'group') {
    return (
      <p className={`expression__leaf expression__leaf--${node.kind}`} title={node.path}>
        {node.text}
      </p>
    );
  }
  return (
    <div className="expression__group">
      <p className="expression__op">{node.text}</p>
      <ul>
        {node.children.map((child) => (
          <li key={child.path}>
            <ExpressionTree node={child} />
          </li>
        ))}
      </ul>
    </div>
  );
}
