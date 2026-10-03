import type { ChangeOutcome, Evaluation } from '../../api/types';
import { Disclosure, Empty, Facts, Notice, SectionHeading, Tag } from '../../components/ui';
import { type AddressDiff, type RuleDelta, readDifferences } from '../../lib/changes';
import { formatDate } from '../../lib/dates';
import { humanize, parseReason, resultMeta } from '../../lib/labels';

const STATUS = {
  complete: { label: 'Complete', tone: 'applies' as const, gloss: 'Every referenced rule was found and evaluated without uncertainty.' },
  partial: { label: 'Partial', tone: 'unknown' as const, gloss: 'Some impacts are uncertain or some referenced evidence is missing.' },
  blocked: { label: 'Blocked', tone: 'danger' as const, gloss: 'The comparison could not be established.' },
};

export function ChangeResultView({ outcome, lookupHref }: { outcome: ChangeOutcome; lookupHref: (addressId: string, asOf: string) => string }) {
  const { result } = outcome;
  const status = STATUS[result.status];
  const blocked = result.status === 'blocked';
  const hypothetical = result.scenario === 'if_enacted';
  const diffs = readDifferences(result);
  const mapped = Object.entries(result.mapped_rule_ids ?? {});
  const sameDay = result.before === result.after;

  return (
    <article className="change-result" aria-labelledby="change-heading" data-status={result.status}>
      <div className="context context--static" role="group" aria-label="Comparison context">
        <p className="context__asof">
          <span className="context__label">{sameDay ? 'On' : 'From'}</span> <strong>{formatDate(result.before)}</strong>
          {!sameDay && (
            <>
              {' '}
              <span className="context__label">to</span> <strong>{formatDate(result.after)}</strong>
            </>
          )}
        </p>
        <div className="context__tags">
          <Tag tone={status.tone}>{status.label}</Tag>
          {outcome.recordedStore && <Tag tone="unknown">Synthetic data · not actual law</Tag>}
          {hypothetical ? <Tag tone="pending">Hypothetical · if enacted</Tag> : <Tag tone="neutral" icon={false}>Actual law</Tag>}
          {result.test_id && (
            <Tag tone="neutral" icon={false}>
              Scenario {result.test_id}
            </Tag>
          )}
          <Tag tone="neutral" icon={false}>
            {outcome.origin.label}
          </Tag>
        </div>
        <p className="context__disclaimer">{result.disclaimer}</p>
      </div>

      <h2 id="change-heading" className="sr-only">
        Comparison result
      </h2>

      {outcome.recordedStore === 'no_extracted_rules' && (
        <Notice tone="synthetic" title="Recorded against a store with no extracted rules">
          <p>This is the backend’s answer for the published scenario when sample properties exist but no rules have been extracted — the state of the real dataset before a provider is configured. It demonstrates the blocked state; it is not a legal result.</p>
        </Notice>
      )}

      {blocked && (
        <Notice tone="danger" title="Blocked: this comparison could not be established" role="status">
          <p>The lists below are empty because the comparison could not run, not because no property is affected. Do not read this as a verified empty set.</p>
          <Notes notes={result.notes} />
        </Notice>
      )}
      {hypothetical && (
        <Notice tone="info" title="Hypothetical: assumes the selected pending rules are enacted">
          <p>Pending rules are treated as enacted and effective on the comparison date for this comparison only. Stored law is unchanged, and nothing here says the rules will be enacted.</p>
        </Notice>
      )}
      {result.status === 'partial' && (
        <Notice tone="unknown" title="Partial result">
          <p>{status.gloss} Read the notes before relying on either list.</p>
          <Notes notes={result.notes} />
        </Notice>
      )}
      {result.status === 'complete' && result.notes.length > 0 && (
        <Notice tone="neutral" title="Notes from the comparison">
          <Notes notes={result.notes} />
        </Notice>
      )}

      <section className="section section--first" aria-labelledby="change-impact">
        <SectionHeading id="change-impact" title="Impact on sample properties" level={3} />
        <div className="impact">
          <ImpactList title="Definitely affected" tone="applies" ids={result.affected_address_ids} blocked={blocked} empty="No property is definitely affected." gloss="The rule’s effect on these properties changes, with no open uncertainty." after={result.after} lookupHref={lookupHref} />
          <ImpactList title="Uncertain" tone="unknown" ids={result.uncertain_address_ids} blocked={blocked} empty="No property has an uncertain impact." gloss="The effect may change, but a fact, source or jurisdiction is unresolved. Kept apart from the definite list." after={result.after} lookupHref={lookupHref} />
          <ImpactList title="Conflict flagged" tone="danger" ids={result.conflict_flag_address_ids} blocked={blocked} empty="No property carries a conflict flag." gloss="Rules that may conflict reach these properties. Needs review." after={result.after} lookupHref={lookupHref} />
        </div>
      </section>

      {diffs.length > 0 && (
        <section className="section" aria-labelledby="change-diffs">
          <SectionHeading id="change-diffs" title="Before and after, by property" level={3} />
          <ul className="diffs">
            {diffs.map((diff) => (
              <AddressDiffView key={diff.addressId} diff={diff} before={result.before} after={result.after} conflict={result.conflict_flag_address_ids.includes(diff.addressId)} href={lookupHref(diff.addressId, result.after)} />
            ))}
          </ul>
        </section>
      )}

      {!blocked && diffs.length === 0 && (
        <Empty title="No differences between these dates" icon="layers">
          <p>The evaluator returned the same result for every sample property on both dates{result.status === 'partial' ? ', within the limits noted above' : ''}.</p>
        </Empty>
      )}

      {mapped.length > 0 && (
        <section className="section" aria-labelledby="change-mapping">
          <SectionHeading id="change-mapping" title="Scenario references" level={3} />
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Extracted rules matched</th>
              </tr>
            </thead>
            <tbody>
              {mapped.map(([reference, ids]) => (
                <tr key={reference}>
                  <th scope="row" className="mono">
                    {reference}
                  </th>
                  <td>{ids.length ? <span className="mono break">{ids.join(', ')}</span> : <span className="table__warn">No extracted rule matches this reference</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Disclosure summary="About this comparison" className="about">
        <Facts
          dense
          rows={[
            { label: 'Source of this result', value: outcome.origin.label, note: outcome.origin.detail },
            { label: 'Request', value: <span className="mono break">{JSON.stringify(outcome.request)}</span> },
            { label: 'Scenario', value: result.scenario },
          ]}
        />
      </Disclosure>
    </article>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <ul className="plain-list plain-list--tight" aria-label="Notes from the comparison">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

function ImpactList({ title, tone, ids, blocked, empty, gloss, after, lookupHref }: { title: string; tone: 'applies' | 'unknown' | 'danger'; ids: string[]; blocked: boolean; empty: string; gloss: string; after: string; lookupHref: (addressId: string, asOf: string) => string }) {
  return (
    <div className={`impact__column impact__column--${tone}`} data-impact={title}>
      <p className="impact__title">{title}</p>
      <p className="impact__count">{blocked ? '—' : ids.length}</p>
      <p className="impact__gloss">{blocked ? 'Not established: the comparison is blocked.' : ids.length ? gloss : empty}</p>
      {ids.length > 0 && (
        <ul className="impact__ids">
          {ids.map((addressId) => (
            <li key={addressId}>
              <a className="link mono" href={lookupHref(addressId, after)}>
                {addressId}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddressDiffView({ diff, before, after, conflict, href }: { diff: AddressDiff; before: string; after: string; conflict: boolean; href: string }) {
  return (
    <li className="diff" data-address={diff.addressId}>
      <div className="diff__head">
        <p className="diff__address mono">{diff.addressId}</p>
        {conflict && <Tag tone="danger">Conflict flagged</Tag>}
        <a className="link diff__open" href={href}>
          Open lookup as of {formatDate(after)}
        </a>
      </div>
      <ul className="diff__rules">
        {diff.deltas.map((delta) => (
          <DeltaRow key={delta.ruleId} delta={delta} before={before} after={after} />
        ))}
      </ul>
      {diff.unreadable.length > 0 && (
        <Disclosure summary={`${diff.unreadable.length} entries in an unexpected shape`}>
          <pre className="raw">{JSON.stringify(diff.unreadable, null, 2)}</pre>
        </Disclosure>
      )}
    </li>
  );
}

function DeltaRow({ delta, before, after }: { delta: RuleDelta; before: string; after: string }) {
  const was = delta.before ? resultMeta(delta.before.result) : null;
  const now = delta.after ? resultMeta(delta.after.result) : null;
  const definite = delta.certainty === 'definite';
  return (
    <li className="delta" data-certainty={delta.certainty}>
      <div className="delta__flow">
        <Tag tone={definite ? 'applies' : 'unknown'} icon={false}>
          {definite ? 'Definite' : 'Uncertain'}
        </Tag>
        <span className="delta__states">
          {was ? <Tag tone={was.tone}>{was.label}</Tag> : <Tag tone="muted">Not compared</Tag>}
          <span aria-hidden="true">→</span>
          <span className="sr-only">then</span>
          {now ? <Tag tone={now.tone}>{now.label}</Tag> : <Tag tone="muted">Not listed</Tag>}
        </span>
        <span className="mono delta__rule">{delta.ruleId}</span>
      </div>
      <div className="delta__sides">
        <Side label={`Before · ${formatDate(before)}`} evaluation={delta.before} absent="This scenario compares the later date only; there is no earlier evaluation." />
        <Side label={`After · ${formatDate(after)}`} evaluation={delta.after} absent="No evaluation was returned." />
      </div>
    </li>
  );
}

function Side({ label, evaluation, absent }: { label: string; evaluation: Evaluation | null; absent: string }) {
  if (!evaluation) {
    return (
      <div className="delta__side">
        <p className="delta__label">{label}</p>
        <p className="hint">{absent}</p>
      </div>
    );
  }
  const reasons = (evaluation.uncertainty_reasons ?? []).map(parseReason);
  const quote = evaluation.evidence[0];
  return (
    <div className="delta__side">
      <p className="delta__label">{label}</p>
      <p className="delta__explanation">{evaluation.explanation}</p>
      {(evaluation.missing_facts ?? []).length > 0 && <p className="hint">Needs: {(evaluation.missing_facts ?? []).map(humanize).join(', ')}</p>}
      {reasons.filter((reason) => reason.kind !== 'missing_property_fact').map((reason) => (
        <p key={reason.raw} className="hint">
          {reason.label}: {reason.message}
        </p>
      ))}
      {quote && (
        <Disclosure summary={`Evidence (${evaluation.evidence.length} ${evaluation.evidence.length === 1 ? 'quote' : 'quotes'})`}>
          <ul className="spans">
            {evaluation.evidence.map((item, index) => (
              <li key={index}>
                <blockquote>{item.quote}</blockquote>
                <p className="hint">
                  <span className="mono">{item.doc_id}</span>
                  {item.start !== null && item.start !== undefined ? ` · characters ${item.start}–${item.end}` : ''} · cited for {item.supports.map(humanize).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}
