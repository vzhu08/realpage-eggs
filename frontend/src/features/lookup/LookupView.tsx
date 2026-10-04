import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_AS_OF } from '../../api/generated/meta';
import type { AddressItem, DataMode, DemoExample, FixtureCaseSummary } from '../../api/types';
import { Icon, type IconName } from '../../components/Icon';
import { ErrorNotice, Skeleton } from '../../components/ui';
import { usePanelFocus } from '../../components/usePanelFocus';
import { formatDate, isIsoDay } from '../../lib/dates';
import { isSynthetic, readMetadata } from '../../lib/metadata';
import { useSession } from '../../state/session';
import { useSource } from '../../state/source';
import { useAsync } from '../../state/useAsync';
import { EvidencePanel } from '../evidence/EvidencePanel';
import { PropertyFinder, addressLine } from '../property/PropertyFinder';
import { PropertySummary } from '../property/PropertySummary';
import { AsOfControl } from './AsOfControl';
import { Results } from './Results';
import { ResearchGuide, TenentHero } from '../shell/TenentVisuals';

interface Props {
  mode: DataMode;
  /** Deep-link parameters read once when the view opens. `run` looks the property up at once. */
  initial: { address: string | null; asOf: string | null; fixtureCase: string | null; run?: boolean };
  onParams: (params: { address: string | null; as_of: string | null; case: string | null }) => void;
  onSwitchToDemo?: () => void;
  disagreementHref: (addressId: string, asOf: string) => string;
  /** Links to the other two views, for the start page. */
  viewHref: (view: 'changes' | 'disagreements') => string;
  /** Where a walkthrough example that lives in another view opens. */
  exampleHref: (example: DemoExample) => string;
  apiBase?: string;
}

const EXAMPLE_ICON: Record<DemoExample['id'], IconName> = { consequential_fact: 'question', portfolio_impact: 'building', source_comparison: 'compare' };

export function LookupView({ mode, initial, onParams, onSwitchToDemo, disagreementHref, viewHref, exampleHref, apiBase }: Props) {
  const source = useSource();
  const session = useSession(source, initial.asOf && isIsoDay(initial.asOf) ? initial.asOf : DEFAULT_AS_OF);
  const { state } = session;
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const catalog = useMemo(() => source.catalog?.(), [source]);
  // Fact meanings and answer forms, for facts the plan does not ask about. Optional: older backends have no /facts.
  const facts = useAsync(`facts:${source.mode}`, (signal) => source.facts(signal), 'GET /facts');

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
        if (fixtureCase) session.selectCase(item, fixtureCase);
        else if (initial.run && initial.asOf && isIsoDay(initial.asOf)) session.open(item, initial.asOf);
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

  // Evidence opens only when asked for. It closes when its rule is no longer part of any result on screen.
  useEffect(() => {
    setInspecting((current) => {
      if (!current || !outcome) return null;
      const known = outcome.lookup.rules.some((rule) => rule.team_rule_id === current) || !!state.previous?.lookup.rules.some((rule) => rule.team_rule_id === current);
      return known ? current : null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  // A lookup that was just run puts its answer at the top of the window: the pinned bar (which
  // names the property and date), the counts and the next step. An answer's re-evaluation is
  // not handled here; it brings "what changed" into view itself.
  const shownRuns = useRef(0);
  useEffect(() => {
    if (state.runs === shownRuns.current) return;
    shownRuns.current = state.runs;
    if (!state.outcome || state.previous) return;
    const frame = window.requestAnimationFrame(() => {
      const results = document.getElementById('lookup-results');
      if (!results) return;
      const banner = document.querySelector<HTMLElement>('.synthetic')?.offsetHeight ?? 0;
      window.scrollTo({ top: Math.max(0, results.getBoundingClientRect().top + window.scrollY - banner) });
      document.getElementById('outcome-heading')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.runs, state.outcome, state.previous]);

  // Move focus to the result without jumping the page; scroll only if it starts off screen.
  const revealMain = () => {
    const main = mainRef.current;
    if (!main) return;
    main.focus({ preventScroll: true });
    const top = main.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) main.scrollIntoView({ block: 'start' });
  };

  const choose = (item: AddressItem) => {
    setInspecting(null);
    setPickerOpen(false);
    session.select(item);
    window.requestAnimationFrame(revealMain);
  };
  const chooseCase = (item: AddressItem, fixtureCase: FixtureCaseSummary) => {
    setInspecting(null);
    setPickerOpen(false);
    session.selectCase(item, fixtureCase);
    window.requestAnimationFrame(revealMain);
  };

  /** A walkthrough example in this view: open its property on its date and look it up. */
  const [exampleError, setExampleError] = useState<string | null>(null);
  const openExample = (example: DemoExample) => {
    if (example.target.view !== 'lookup') return;
    const { address_id: addressId, as_of: asOf } = example.target;
    setExampleError(null);
    source.addresses({ q: addressId, offset: 0, limit: 100 }).then(
      (page) => {
        const item = page.items.find((candidate) => candidate.property.address_id === addressId);
        if (!item) {
          setExampleError(`The example property ${addressId} is not in this dataset.`);
          return;
        }
        setInspecting(null);
        session.open(item, asOf);
        window.requestAnimationFrame(revealMain);
      },
      () => setExampleError('The example could not be opened because the property list could not be read.'),
    );
  };

  const relatedCases = state.selection && !state.fixtureCase && outcome ? (catalog?.cases.filter((candidate) => candidate.address_id === outcome.query.address_id && candidate.as_of === outcome.query.as_of) ?? []) : [];
  const openCase = (fixtureCase: FixtureCaseSummary) => {
    if (state.selection) chooseCase(state.selection, fixtureCase);
  };

  const showSkeleton = state.status === 'loading' && !state.reevaluating;
  const finder = (autoFocus: boolean) => (
    <PropertyFinder selectedId={state.selection?.property.address_id ?? null} selectedCase={state.fixtureCase?.id ?? null} onSelect={choose} onSelectCase={chooseCase} onSwitchToDemo={onSwitchToDemo} autoFocus={autoFocus} />
  );

  return (
    <div className="lookup">
      {!state.selection ? (
        <div className="start" ref={mainRef} tabIndex={-1}>
          <TenentHero changesHref={viewHref('changes')} onFind={() => {
            const input = document.querySelector<HTMLInputElement>('.start__picker input[type="search"]');
            if (!input) return;
            input.focus({ preventScroll: true });
            input.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          }}/>

          {catalog && catalog.examples.length > 0 && (
            <section className="examples" aria-labelledby="examples-heading">
              <div className="examples__head">
                <h2 id="examples-heading" className="examples__title">
                  Start with an example
                </h2>
                <p className="hint">Recorded on fictional data. Each opens in one step.</p>
              </div>
              <ol className="examples__list">
                {catalog.examples.map((example, index) => {
                  const body = (
                    <>
                      <span className="example__step" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="example__icon" aria-hidden="true">
                        <Icon name={EXAMPLE_ICON[example.id]} size={20} />
                      </span>
                      <span className="example__title">{example.title}</span>
                      <span className="example__detail">{example.detail}</span>
                      <span className="example__meta">{example.meta}</span>
                      <span className="example__arrow" aria-hidden="true"><Icon name="arrow" size={21}/></span>
                    </>
                  );
                  return (
                    <li key={example.id}>
                      {example.target.view === 'lookup' ? (
                        <button type="button" className="example" data-example={example.id} onClick={() => openExample(example)}>
                          {body}
                        </button>
                      ) : (
                        <a className="example" data-example={example.id} href={exampleHref(example)}>
                          {body}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ol>
              {exampleError && (
                <p className="field__error" role="alert">
                  {exampleError}
                </p>
              )}
            </section>
          )}

          {mode === 'live' && (
            <section className="examples" aria-labelledby="views-heading">
              <div className="examples__head">
                <h2 id="views-heading" className="examples__title">
                  Across the whole dataset
                </h2>
              </div>
              <ul className="examples__list examples__list--two">
                <li>
                  <a className="example" href={viewHref('changes')}>
                    <span className="example__icon" aria-hidden="true">
                      <Icon name="building" size={20} />
                    </span>
                    <span className="example__title">What changes across the portfolio</span>
                    <span className="example__detail">Compare two dates, or run a published scenario, and follow each change from its source to the rule to the properties it reaches.</span>
                  </a>
                </li>
                <li>
                  <a className="example" href={viewHref('disagreements')}>
                    <span className="example__icon" aria-hidden="true">
                      <Icon name="compare" size={20} />
                    </span>
                    <span className="example__title">Two sources, side by side</span>
                    <span className="example__detail">Claims recorded from two sources about one field, with both exact texts. No source is given a winner.</span>
                  </a>
                </li>
              </ul>
              {onSwitchToDemo && (
                <p className="hint">
                  Rehearsing?{' '}
                  <button type="button" className="link" onClick={onSwitchToDemo}>
                    Open the synthetic demo
                  </button>{' '}
                  for one-click examples on fictional data. It is a separate, labeled mode.
                </p>
              )}
            </section>
          )}

          <div className="research-workspace">
            <section className="start__picker" aria-labelledby="picker-heading">
              <div className="picker-heading"><div><p className="eyebrow">YOUR RESEARCH STARTS HERE</p><h2 id="picker-heading" className="examples__title">Choose a property</h2></div><Icon name="search" size={24}/></div>
              <p className="start__picker-lead">Find an address in the available dataset to build its legal context.</p>
              {finder(false)}
            </section>
            <ResearchGuide/>
          </div>
        </div>
      ) : (
        <div className="lookup__result" ref={mainRef} tabIndex={-1}>
          <PropertySummary item={outcome && outcome.lookup.address.address_id === state.selection.property.address_id ? { property: outcome.lookup.address, resolution: outcome.lookup.jurisdiction } : state.selection} onChange={() => setPickerOpen(true)} answers={outcome ? outcome.query.answers : []} />
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
              factDefinitions={facts.data ?? {}}
              onOpenCase={openCase}
              onInspect={(ruleId) => setInspecting(ruleId)}
              onAnswer={session.answer}
              onRemoveAnswer={session.removeAnswer}
              onRun={session.run}
              mode={mode}
              apiBase={apiBase}
              disagreementHref={disagreementHref}
            />
          )}
        </div>
      )}

      {pickerOpen && state.selection && (
        <PickerDialog onClose={() => setPickerOpen(false)}>{finder(true)}</PickerDialog>
      )}

      {inspectedRule && outcome && (
        <>
          <div className="scrim" onClick={() => setInspecting(null)} aria-hidden="true" />
          <EvidencePanel key={inspectedRule.team_rule_id} rule={inspectedRule} evaluation={inspectedEvaluation} lookup={outcome.lookup} assist={outcome.assist} synthetic={outcome.origin.kind !== 'live' || isSynthetic(readMetadata(outcome.lookup))} modal onClose={() => setInspecting(null)} />
        </>
      )}
    </div>
  );
}

/** The property chooser as a dialog: a centered panel on wide screens, a full sheet on narrow ones. */
function PickerDialog({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  usePanelFocus(ref, { modal: true, onClose, focusKey: 'picker' });
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <header className="picker__head">
          <h2 id="picker-title" className="picker__title">
            Choose a property
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close the property chooser">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="picker__body">{children}</div>
      </div>
    </>
  );
}
