import type { ApiError } from '../../api/errors';
import type { Evaluation, Rule, RuleDetail } from '../../api/types';
import { ErrorNotice, Skeleton, Tag } from '../../components/ui';
import { formatDate } from '../../lib/dates';
import { sentence, temporalLabel } from '../../lib/labels';

interface Props {
  rule: Rule;
  evaluation: Evaluation | null;
  asOf: string;
  detail: { status: 'idle' | 'loading' | 'ready' | 'error'; data: RuleDetail | null; error: ApiError | null; reload: () => void };
}

const LIFECYCLE_TONE = { enacted: 'applies', pending: 'pending', failed: 'muted', unknown: 'unknown', repealed: 'muted' } as const;

/** Every stored version of this provision, with the dates the source establishes. */
export function VersionsTab({ rule, evaluation, asOf, detail }: Props) {
  const versions = detail.data?.versions ?? [];
  const ordered = [...versions].sort((a, b) => (a.effective_date ?? '').localeCompare(b.effective_date ?? '') || a.team_rule_id.localeCompare(b.team_rule_id));
  return (
    <div className="evidence-tab">
      <p className="evidence-tab__lead">
        Versions share a citation, jurisdiction and provision. The effective day is inclusive and an end date is exclusive. A pending version never takes effect on its own.
      </p>
      {evaluation && (
        <p className="versions__now">
          On {formatDate(asOf)} the evaluator reports the selected version as <strong>{temporalLabel(evaluation.temporal_status).toLowerCase()}</strong>.
        </p>
      )}
      {detail.status === 'loading' && <Skeleton lines={3} label="Loading versions" />}
      {detail.status === 'error' && detail.error && (
        <ErrorNotice
          error={detail.error}
          context="Rule versions"
          actions={
            <button type="button" className="button button--small" onClick={detail.reload}>
              Try again
            </button>
          }
        >
          <p>The version shown in the lookup result is listed below from the lookup data.</p>
        </ErrorNotice>
      )}
      <ol className="versions">
        {(ordered.length ? ordered : [rule]).map((version) => {
          const current = version.team_rule_id === rule.team_rule_id;
          const events = version.status_events ?? [];
          return (
            <li key={version.team_rule_id} className={current ? 'version is-current' : 'version'}>
              <div className="version__head">
                <p className="version__title">{version.title}</p>
                {current && (
                  <Tag tone="info" icon={false}>
                    Shown in this result
                  </Tag>
                )}
              </div>
              <p className="version__dates">
                {version.effective_date ? `Effective ${formatDate(version.effective_date)}` : 'No effective date recorded'}
                {version.end_date ? ` · ends ${formatDate(version.end_date)}` : ''}
                {version.status_as_of ? ` · status as of ${formatDate(version.status_as_of)}` : ''}
              </p>
              <p className="version__lifecycle">
                <Tag tone={LIFECYCLE_TONE[version.lifecycle] ?? 'neutral'}>{sentence(version.lifecycle)}</Tag>
                {version.key_value && <span>Key value: {version.key_value}</span>}
              </p>
              {events.length > 0 && (
                <ul className="version__events">
                  {events.map((event, index) => (
                    <li key={index}>
                      <span className="version__event-date">{formatDate(event.on)}</span>
                      <span>
                        {sentence(event.status)}
                        {event.evidence[0] && <span className="version__event-quote"> — “{event.evidence[0].quote}”</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="hint mono">{version.team_rule_id}</p>
            </li>
          );
        })}
      </ol>
      {detail.status === 'ready' && versions.length <= 1 && <p className="hint">Only one version of this provision is stored.</p>}
    </div>
  );
}
