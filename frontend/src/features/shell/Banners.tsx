import type { DataMode } from '../../api/types';
import { ErrorNotice, Notice } from '../../components/ui';
import { DEMO_ONLY } from '../../config';
import type { HealthState } from './Header';

/** Always on screen in demo mode. It cannot be dismissed. */
export function SyntheticBanner({ onLive }: { onLive: () => void }) {
  return (
    <div className="synthetic" role="note" aria-label="Synthetic demo notice">
      <div className="synthetic__inner">
        <span className="synthetic__tag">Synthetic demo</span>
        <p className="synthetic__text">
          <span className="synthetic__long">Fictional Maple Harbor data, replayed from checked-in examples. Not actual housing law and not a live service.</span>
          <span className="synthetic__short">Fictional data. Not actual law.</span>
        </p>
        {!DEMO_ONLY && (
          <button type="button" className="synthetic__switch" onClick={onLive}>
            Switch to live API
          </button>
        )}
      </div>
    </div>
  );
}

/** Service and dataset state for the live API. Shown above every view until it is healthy. */
export function ServiceNotice({ mode, health, onDemo }: { mode: DataMode; health: HealthState; onDemo: () => void }) {
  if (mode !== 'live') return null;
  if (health.status === 'error' && health.error) {
    return (
      <div className="page-notice">
        <ErrorNotice
          error={health.error}
          context="Service check"
          actions={
            <>
              <button type="button" className="button button--small" onClick={health.reload}>
                Check again
              </button>
              <button type="button" className="button button--small button--quiet" onClick={onDemo}>
                Open the synthetic demo
              </button>
            </>
          }
        >
          <p>Nothing can be looked up until the service answers. The synthetic demo is a separate, labeled mode; it is never used automatically.</p>
        </ErrorNotice>
      </div>
    );
  }
  const data = health.data;
  if (!data || data.dataset_readiness === 'available') return null;
  if (data.dataset_readiness === 'absent') {
    return (
      <div className="page-notice">
        <Notice tone="unknown" title="No dataset is loaded on this backend">
          <p>The service is running but has no sample properties. Lookups and comparisons will report the dataset as unavailable.</p>
        </Notice>
      </div>
    );
  }
  const unresolved = data.addresses - data.resolved_municipalities;
  return (
    <div className="page-notice">
      <Notice tone="unknown" title="Partial dataset">
        <p>
          {data.rules === 0
            ? 'No rules have been extracted yet, so lookups will report extraction as unavailable rather than return an empty result.'
            : `${data.rules} rules are extracted from ${data.sources} sources. Coverage is incomplete, so an unlisted rule has not been ruled out.`}
          {unresolved > 0 ? ` ${unresolved} of ${data.addresses} sample properties have no resolved municipality; local rules for those stay uncertain.` : ''}
        </p>
        {(data.last_extraction_outcome === 'failed' || data.last_extraction_outcome === 'partial') && (
          <p>
            The last extraction run ended as “{data.last_extraction_outcome}”
            {data.last_extraction_outcome === 'failed' ? ' (for example, a provider failure). No rules from that run are in the dataset.' : '. Some sources were not processed.'}
          </p>
        )}
      </Notice>
    </div>
  );
}
