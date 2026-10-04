import { useId, useRef, useState } from 'react';
import { type ApiError, toApiError } from '../../api/errors';
import type { AssistResponse, Evaluation, EvidenceReportOutcome, LookupResponse, Rule, SourceDocument } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Disclosure, Facts, Tabs, Tag, tabPanelProps } from '../../components/ui';
import { usePanelFocus } from '../../components/usePanelFocus';
import { formatDate } from '../../lib/dates';
import { categoryLabel, resultMeta, sentence } from '../../lib/labels';
import { useSource } from '../../state/source';
import { useAsync } from '../../state/useAsync';
import { ChecksTab } from './ChecksTab';
import { EncodedTab } from './EncodedTab';
import { type LoadedSource, SourceTab } from './SourceTab';
import { VersionsTab } from './VersionsTab';

interface Props {
  rule: Rule;
  /** Null when the rule is no longer in the result list (e.g. after an answer). */
  evaluation: Evaluation | null;
  lookup: LookupResponse;
  assist: AssistResponse | null;
  /** True when shown as a full-height sheet over the page (narrow screens). */
  modal: boolean;
  /** The result is synthetic. The drawer can cover the page banner, so it says so itself. */
  synthetic?: boolean;
  onClose: () => void;
}

type TabId = 'source' | 'encoded' | 'checks' | 'versions';

export function EvidencePanel({ rule, evaluation, lookup, assist, modal, synthetic = false, onClose }: Props) {
  const source = useSource();
  const ref = useRef<HTMLElement | null>(null);
  const tabBase = useId();
  const [tab, setTab] = useState<TabId>('source');
  usePanelFocus(ref, { modal, onClose, focusKey: rule.team_rule_id });

  const evidence = evaluation?.evidence ?? rule.evidence;
  const docIds = [...new Set(evidence.map((item) => item.doc_id))];

  // Full source text for surrounding context and literal quote comparison.
  const documents = useAsync(
    `sources:${source.mode}:${docIds.join(',')}`,
    async (signal) => {
      const entries = await Promise.all(
        docIds.map(async (docId): Promise<[string, SourceDocument | ApiError]> => {
          try {
            return [docId, await source.source(docId, signal)];
          } catch (error) {
            if (signal.aborted) throw error;
            return [docId, toApiError(error, `GET /sources/${docId}`)];
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, SourceDocument | ApiError>;
    },
    'GET /sources/{id}',
  );
  const loaded: Record<string, LoadedSource> = {};
  for (const docId of docIds) {
    const entry = documents.data?.[docId];
    if (documents.status === 'error') loaded[docId] = { status: 'error', error: documents.error };
    else if (!entry) loaded[docId] = { status: 'loading' };
    else if (entry instanceof Error) loaded[docId] = { status: 'error', error: entry };
    else loaded[docId] = { status: 'ready', doc: entry };
  }

  const detail = useAsync(`rule:${source.mode}:${rule.team_rule_id}`, (signal) => source.ruleDetail(rule.team_rule_id, signal), 'GET /rules/{id}');

  // Prefer a report delivered with the assist response; otherwise ask the (planned) evidence route.
  const embedded = assist?.evidence_reports.find((report) => report.rule_id === rule.team_rule_id) ?? null;
  const fetched = useAsync<EvidenceReportOutcome>(embedded ? null : `evidence:${source.mode}:${rule.team_rule_id}`, (signal) => source.evidenceReport(rule.team_rule_id, signal), 'GET /rules/{id}/evidence');
  const report = embedded ?? fetched.data?.report ?? null;
  const reportState = embedded ? null : fetched.status === 'error' ? `The evidence report could not be loaded: ${fetched.error.message}` : (fetched.data?.unavailable ?? null);

  const rendering = assist?.encoded_rules.find((item) => item.rule_id === rule.team_rule_id) ?? null;
  const rendererCapability = assist?.capabilities?.rule_renderer;
  const rendererState = rendering
    ? null
    : rendererCapability === 'dependency_unavailable'
      ? 'The deterministic rule renderer is not available yet (rule_renderer: dependency unavailable).'
      : assist
        ? 'The service returned no rendering for this rule.'
        : 'The rule renderer is delivered with the assist service, which this result did not use.';

  const meta = evaluation ? resultMeta(evaluation.result) : null;
  const versionCount = detail.data?.versions.length;

  return (
    <aside
      ref={ref}
      className={modal ? 'evidence evidence--modal' : 'evidence'}
      role={modal ? 'dialog' : 'complementary'}
      aria-modal={modal ? true : undefined}
      aria-labelledby={`${tabBase}-title`}
      data-rule-id={rule.team_rule_id}
    >
      <header className="evidence__head">
        <div className="evidence__heading">
          <p className="eyebrow">Evidence · as of {formatDate(lookup.as_of)}</p>
          <h2 id={`${tabBase}-title`} className="evidence__title" tabIndex={-1} data-autofocus>
            {rule.title}
          </h2>
          <p className="evidence__meta">
            {meta ? <Tag tone={meta.tone}>{meta.label}</Tag> : <Tag tone="muted">Not in the current result</Tag>}
            {(synthetic || rule.evidence_mode === 'synthetic') && <Tag tone="unknown">Synthetic data · not actual law</Tag>}
            <span>{categoryLabel(rule.category)}</span>
            <span aria-hidden="true">·</span>
            <span>{rule.jurisdiction}</span>
          </p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close evidence">
          <Icon name="close" size={18} />
        </button>
      </header>

      <Tabs
        idBase={tabBase}
        label="Evidence views"
        active={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={[
          { id: 'source', label: 'Source text', badge: evidence.length },
          { id: 'encoded', label: 'Encoded rule' },
          { id: 'checks', label: 'Checks', badge: 7 },
          { id: 'versions', label: 'Versions', badge: versionCount },
        ]}
      />

      <div className="evidence__body" {...tabPanelProps(tabBase, tab)}>
        {tab === 'source' && <SourceTab rule={rule} evidence={evidence} sources={lookup.sources} loaded={loaded} onRetry={documents.reload} />}
        {tab === 'encoded' && (
          <EncodedTab rule={rule} evaluation={evaluation} rendering={rendering} rendererState={rendererState} traces={(assist?.question_plan.traces ?? []).filter((trace) => trace.rule_id === rule.team_rule_id)} asOf={lookup.as_of} />
        )}
        {tab === 'checks' && <ChecksTab rule={rule} report={report} reportState={reportState} reportLoading={!embedded && fetched.status === 'loading'} loaded={loaded} />}
        {tab === 'versions' && <VersionsTab rule={rule} evaluation={evaluation} asOf={lookup.as_of} detail={detail} />}

        <Disclosure summary="Rule record" className="evidence__record">
          <Facts
            dense
            rows={[
              { label: 'Rule ID', value: <span className="mono break">{rule.team_rule_id}</span> },
              { label: 'Provision', value: <span className="mono">{rule.provision_key}</span> },
              { label: 'Level', value: sentence(rule.level) },
              { label: 'Evidence mode', value: sentence(rule.evidence_mode), note: rule.evidence_mode === 'synthetic' ? 'Synthetic fixture, not actual law' : undefined },
              { label: 'Semantic status', value: sentence(rule.semantic_verification) },
              { label: 'Extraction run', value: <span className="mono break">{rule.extraction_run_id}</span> },
              ...(rule.source_review ? [{ label: 'Source correction', value: rule.source_review.reviewer,
                note: `Post-extraction AI review (${sentence(rule.source_review.review_scope)}); original extracted record retained. Not independent legal validation.` }] : []),
            ]}
          />
        </Disclosure>
        <p className="evidence__disclaimer">{lookup.disclaimer}</p>
      </div>
    </aside>
  );
}
