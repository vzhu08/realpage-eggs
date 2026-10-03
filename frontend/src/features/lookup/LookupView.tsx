import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_AS_OF } from '../../api/generated/meta';
import type { AddressItem, DataMode, FixtureCaseSummary } from '../../api/types';
import { Icon } from '../../components/Icon';
import { ErrorNotice, Skeleton } from '../../components/ui';
import { formatDate, isIsoDay } from '../../lib/dates';
import { useSession } from '../../state/session';
import { useSource } from '../../state/source';
import { useMediaQuery } from '../../state/useMediaQuery';
import { EvidencePanel } from '../evidence/EvidencePanel';
import { PropertyFinder, addressLine } from '../property/PropertyFinder';
import { PropertySummary } from '../property/PropertySummary';
import { AsOfControl } from './AsOfControl';
import { Results } from './Results';

interface Props {
  mode: DataMode;
  /** Deep-link parameters read once when the view opens. */
  initial: { address: string | null; asOf: string | null; fixtureCase: string | null };
  onParams: (params: { address: string | null; as_of: string | null; case: string | null }) => void;
  onSwitchToDemo?: () => void;
}

export function LookupView({ mode, initial, onParams, onSwitchToDemo }: Props) {
  const source = useSource();
  const session = useSession(source, initial.asOf && isIsoDay(initial.asOf) ? initial.asOf : DEFAULT_AS_OF);
  const { state } = session;
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [finderOpen, setFinderOpen] = useState(true);
  const wide = useMediaQuery('(min-width: 1280px)');
  const mainRef = useRef<HTMLDivElement | null>(null);
  const catalog = useMemo(() => source.catalog?.(), [source]);

  // Deep link: open the property or fixture case named in the URL when the view mounts.
  useEffect(() => {
    const fixtureCase = catalog?.cases.find((candidate) => candidate.id === initial.fixtureCase);
    const wanted = fixtureCase?.address_id ?? initial.address;
    if (!wanted) return;
    let cancelled = false;
    source.addresses({ q: wanted, offset: 0, limit: 100 }).then(
      (page) => {
        const item = page.items.find((candidate) => candidate.property.address_id === wanted);
        if (cancelled || !item) return;
        setFinderOpen(false);
        if (fixtureCase) session.selectCase(item, fixtureCase);
        else session.select(item);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onParams({ address: state.fixtureCase ? null : (state.selection?.property.address_id ?? null), as_of: state.selection && !state.fixtureCase ? state.asOf : null, case: state.fixtureCase?.id ?? null });
  }, [state.selection, state.asOf, state.fixtureCase, onParams]);

  const outcome = state.outcome;
  const rules = outcome?.lookup.rules ?? [];
  // A rule can leave the result after an answer; keep it inspectable from the earlier result.
  const inspectedRule = inspecting ? (rules.find((rule) => rule.team_rule_id === inspecting) ?? state.previous?.lookup.rules.find((rule) => rule.team_rule_id === inspecting) ?? null) : null;
  const inspectedEvaluation = inspecting ? (outcome?.lookup.evaluations.find((evaluation) => evaluation.team_rule_id === inspecting) ?? null) : null;

  // On wide screens evidence sits beside the results, so a new result opens its first rule's evidence.
  // A rule already being inspected stays open, even if an answer removed it from the list.
  useEffect(() => {
    if (!outcome) {
      setInspecting(null);
      return;
    }
    setInspecting((current) => {
      const known = (ruleId: string) => outcome.lookup.rules.some((rule) => rule.team_rule_id === ruleId) || !!state.previous?.lookup.rules.some((rule) => rule.team_rule_id === ruleId);
      if (current && known(current)) return current;
      return wide ? (outcome.lookup.evaluations[0]?.team_rule_id ?? null) : null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  const choose = (item: AddressItem) => {
    setInspecting(null);
    setFinderOpen(false);
    session.select(item);
    window.requestAnimationFrame(() => mainRef.current?.focus());
  };
  const chooseCase = (item: AddressItem, fixtureCase: FixtureCaseSummary) => {
    setInspecting(null);
    setFinderOpen(false);
    session.selectCase(item, fixtureCase);
    window.requestAnimationFrame(() => mainRef.current?.focus());
  };

  const relatedCases = state.selection && !state.fixtureCase && outcome ? (catalog?.cases.filter((candidate) => candidate.address_id === outcome.query.address_id && candidate.as_of === outcome.query.as_of) ?? []) : [];
  const openCase = (fixtureCase: FixtureCaseSummary) => {
    if (state.selection) chooseCase(state.selection, fixtureCase);
  };

  const showSkeleton = state.status === 'loading' && !state.reevaluating;
  const hasEvidence = !!(inspectedRule && outcome);

  return (
    <div className={`workspace${hasEvidence && wide ? ' workspace--with-evidence' : ''}`}>
      <aside className={`workspace__finder${finderOpen ? ' is-open' : ''}`} aria-label="Choose a property">
        <button type="button" className="finder-toggle" aria-expanded={finderOpen} onClick={() => setFinderOpen((value) => !value)}>
          <Icon name="search" />
          <span>{state.selection ? `Change property (${state.selection.property.address_id})` : 'Choose a property'}</span>
          <Icon name="chevron" className="finder-toggle__chevron" />
        </button>
        <div className="workspace__finder-body">
          <PropertyFinder selectedId={state.selection?.property.address_id ?? null} selectedCase={state.fixtureCase?.id ?? null} onSelect={choose} onSelectCase={chooseCase} onSwitchToDemo={onSwitchToDemo} />
        </div>
      </aside>

      <div className="workspace__main" ref={mainRef} tabIndex={-1}>
        {!state.selection ? (
          <Welcome mode={mode} cases={catalog?.cases ?? []} />
        ) : (
          <>
            <PropertySummary item={outcome && outcome.lookup.address.address_id === state.selection.property.address_id ? { property: outcome.lookup.address, resolution: outcome.lookup.jurisdiction } : state.selection} />
            <AsOfControl
              value={state.asOf}
              onChange={session.setAsOf}
              onRun={session.run}
              busy={state.status === 'loading'}
              recordedDates={catalog?.lookupDates[state.selection.property.address_id]}
              fixtureCase={state.fixtureCase}
              hasResult={!!outcome}
            />

            {state.status === 'idle' && !outcome && (
              <p className="prompt">
                Choose the date to evaluate, then run the lookup for <strong>{addressLine(state.selection)}</strong>.
              </p>
            )}

            {showSkeleton && <Skeleton lines={6} label={`Looking up rules as of ${formatDate(state.asOf)}`} />}

            {state.status === 'error' && state.error && (
              <ErrorNotice
                error={state.error}
                context={`Lookup for ${state.selection.property.address_id} as of ${formatDate(state.asOf)}`}
                actions={
                  <>
                    {state.error.kind !== 'not_recorded' && state.error.kind !== 'invalid_request' && state.error.kind !== 'not_found' && (
                      <button type="button" className="button button--small" onClick={session.run}>
                        Try again
                      </button>
                    )}
                    {state.error.kind === 'not_found' && (
                      <button type="button" className="button button--small" onClick={session.clear}>
                        Choose another property
                      </button>
                    )}
                    {state.error.suggestions.map((date) => (
                      <button
                        key={date}
                        type="button"
                        className="button button--small"
                        onClick={() => {
                          session.setAsOf(date);
                          window.setTimeout(session.run, 0);
                        }}
                      >
                        Use {formatDate(date)}
                      </button>
                    ))}
                    {(state.error.kind === 'transport' || state.error.kind === 'timeout') && onSwitchToDemo && (
                      <button type="button" className="button button--small button--quiet" onClick={onSwitchToDemo}>
                        Open the synthetic demo
                      </button>
                    )}
                  </>
                }
              >
                {state.error.kind === 'unavailable' && <p>No rules can be evaluated until extraction has completed. This is a service state. It does not mean that no rules apply to this property.</p>}
                {state.error.kind === 'not_found' && <p>The property list may have changed since it was loaded. Search again and reselect the property.</p>}
                {state.error.kind === 'dependency' && <p>A backend component returned output the API could not use. No result is shown rather than a partial one.</p>}
              </ErrorNotice>
            )}

            {outcome && !showSkeleton && state.status !== 'error' && (
              <Results
                session={state}
                outcome={outcome}
                selectedRuleId={inspecting}
                relatedCases={relatedCases}
                onOpenCase={openCase}
                onInspect={(ruleId) => setInspecting(ruleId)}
                onAnswer={session.answer}
                onRemoveAnswer={session.removeAnswer}
                onRun={session.run}
              />
            )}
          </>
        )}
      </div>

      {hasEvidence && inspectedRule && outcome && (
        <>
          {!wide && <div className="scrim" onClick={() => setInspecting(null)} aria-hidden="true" />}
          <EvidencePanel key={inspectedRule.team_rule_id} rule={inspectedRule} evaluation={inspectedEvaluation} lookup={outcome.lookup} assist={outcome.assist} modal={!wide} onClose={() => setInspecting(null)} />
        </>
      )}
    </div>
  );
}

function Welcome({ mode, cases }: { mode: DataMode; cases: FixtureCaseSummary[] }) {
  return (
    <div className="welcome">
      <p className="eyebrow">Lookup</p>
      <h1 className="welcome__title">Which rental rules reach a property, on a given date — and what is still unknown.</h1>
      <p className="welcome__lead">
        Choose a sample property, set the date to evaluate, and run the lookup. Every result links to the exact source text it rests on. Where a fact is missing, the workspace asks for it; where a source is missing, it says so.
      </p>
      <ol className="welcome__steps">
        <li>
          <span className="welcome__step">1</span>
          <span>Pick a property and check how its jurisdiction was established.</span>
        </li>
        <li>
          <span className="welcome__step">2</span>
          <span>Set the as-of date. It starts at the contract default, {formatDate(DEFAULT_AS_OF)}.</span>
        </li>
        <li>
          <span className="welcome__step">3</span>
          <span>Read what applies, answer factual questions, and inspect the evidence.</span>
        </li>
      </ol>
      {mode === 'demo' && cases.length > 0 && <p className="hint">In the synthetic demo, the question-flow fixtures in the list open a recorded case in one step.</p>}
    </div>
  );
}
