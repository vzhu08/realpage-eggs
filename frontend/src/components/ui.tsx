import type { ReactNode } from 'react';
import type { ApiError } from '../api/errors';
import type { Tone } from '../lib/labels';
import { Icon, type IconName } from './Icon';

const TONE_ICON: Record<Tone, IconName> = {
  applies: 'applies',
  unknown: 'unknown',
  future: 'future',
  pending: 'pending',
  muted: 'muted',
  danger: 'danger',
  neutral: 'neutral',
  info: 'info',
};

/** A status label. Tone adds color and a shape; the words always carry the meaning. */
export function Tag({ tone = 'neutral', children, icon = true, title }: { tone?: Tone; children: ReactNode; icon?: boolean; title?: string }) {
  return (
    <span className={`tag tag--${tone}`} title={title}>
      {icon && <Icon name={TONE_ICON[tone]} size={14} />}
      <span>{children}</span>
    </span>
  );
}

/** A plain, low-emphasis label for identifiers and metadata. */
export function Chip({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return <span className={mono ? 'chip chip--mono' : 'chip'}>{children}</span>;
}

interface NoticeProps {
  tone?: 'info' | 'unknown' | 'danger' | 'applies' | 'synthetic' | 'neutral';
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** `alert` interrupts screen readers; use it only for failures of something just attempted. */
  role?: 'alert' | 'status' | 'note';
  compact?: boolean;
}

export function Notice({ tone = 'info', title, children, actions, role = 'note', compact = false }: NoticeProps) {
  const icon: IconName = tone === 'danger' ? 'danger' : tone === 'unknown' || tone === 'synthetic' ? 'unknown' : tone === 'applies' ? 'applies' : 'info';
  return (
    <div className={`notice notice--${tone}${compact ? ' notice--compact' : ''}`} role={role}>
      <Icon name={icon} size={18} className="notice__icon" />
      <div className="notice__body">
        <p className="notice__title">{title}</p>
        {children && <div className="notice__text">{children}</div>}
        {actions && <div className="notice__actions">{actions}</div>}
      </div>
    </div>
  );
}

/** Native <details>: keyboard and screen-reader behavior come for free. */
export function Disclosure({ summary, children, defaultOpen = false, className }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return (
    <details className={className ? `disclosure ${className}` : 'disclosure'} open={defaultOpen}>
      <summary>
        <Icon name="chevron" size={14} className="disclosure__chevron" />
        <span>{summary}</span>
      </summary>
      <div className="disclosure__content">{children}</div>
    </details>
  );
}

export function Skeleton({ lines = 3, label }: { lines?: number; label: string }) {
  return (
    <div className="skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="skeleton__line" style={{ width: `${92 - ((index * 17) % 40)}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="spinner" role="status">
      <span className="spinner__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function Empty({ title, children, icon = 'document' }: { title: string; children?: ReactNode; icon?: IconName }) {
  return (
    <div className="empty">
      <Icon name={icon} size={22} className="empty__icon" />
      <p className="empty__title">{title}</p>
      {children && <div className="empty__text">{children}</div>}
    </div>
  );
}

/** Label/value rows for record-style detail. Rendered as a description list. */
export function Facts({ rows, dense = false }: { rows: Array<{ label: ReactNode; value: ReactNode; note?: ReactNode }>; dense?: boolean }) {
  return (
    <dl className={dense ? 'facts facts--dense' : 'facts'}>
      {rows.map((row, index) => (
        <div className="facts__row" key={index}>
          <dt>{row.label}</dt>
          <dd>
            {row.value}
            {row.note && <span className="facts__note">{row.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionHeading({ title, aside, id, level = 2 }: { title: ReactNode; aside?: ReactNode; id?: string; level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className="section-heading">
      <Heading id={id}>{title}</Heading>
      {aside && <div className="section-heading__aside">{aside}</div>}
    </div>
  );
}

const ERROR_COPY: Record<ApiError['kind'], { title: string; tone: NoticeProps['tone'] }> = {
  transport: { title: 'The service could not be reached', tone: 'danger' },
  timeout: { title: 'The service did not answer in time', tone: 'danger' },
  invalid_request: { title: 'The request was not accepted', tone: 'danger' },
  not_found: { title: 'That selection is no longer in the dataset', tone: 'unknown' },
  not_implemented: { title: 'This capability is not available on the connected backend', tone: 'unknown' },
  unavailable: { title: 'The dataset is not ready', tone: 'unknown' },
  dependency: { title: 'A backend dependency failed', tone: 'danger' },
  server: { title: 'The service returned an error', tone: 'danger' },
  contract: { title: 'The response did not match the contract', tone: 'danger' },
  not_recorded: { title: 'Not available in the synthetic demo', tone: 'unknown' },
};

/**
 * One failure presentation for every request. It states what failed and what that does and
 * does not mean — in particular, a failure is never shown as "no rules apply".
 */
export function ErrorNotice({ error, context, actions, children }: { error: ApiError; context: string; actions?: ReactNode; children?: ReactNode }) {
  const copy = ERROR_COPY[error.kind];
  return (
    <Notice tone={copy.tone} title={copy.title} role="alert" actions={actions}>
      <p>{error.message}</p>
      {error.details.length > 0 && (
        <ul className="plain-list">
          {error.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      {children}
      <p className="notice__meta">
        {context}
        {error.status ? ` · HTTP ${error.status}` : ''}
        {error.code ? ` · ${error.code}` : ''}
        {` · ${error.endpoint}`}
      </p>
    </Notice>
  );
}

export interface TabItem {
  id: string;
  label: string;
  badge?: ReactNode;
}

/** ARIA tabs with roving focus: arrow keys move, Home/End jump. */
export function Tabs({ tabs, active, onChange, label, idBase }: { tabs: TabItem[]; active: string; onChange: (id: string) => void; label: string; idBase: string }) {
  const base = idBase;
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`${base}-tab-${tab.id}`}
          aria-selected={tab.id === active}
          aria-controls={`${base}-panel-${tab.id}`}
          tabIndex={tab.id === active ? 0 : -1}
          className="tabs__tab"
          data-tab={tab.id}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            const last = tabs.length - 1;
            const next = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1;
            if (next < 0) return;
            event.preventDefault();
            const target = tabs[next];
            if (!target) return;
            onChange(target.id);
            const list = event.currentTarget.parentElement;
            window.requestAnimationFrame(() => list?.querySelector<HTMLButtonElement>(`[data-tab="${target.id}"]`)?.focus());
          }}
        >
          {tab.label}
          {tab.badge !== undefined && <span className="tabs__badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function tabPanelProps(base: string, id: string) {
  return { role: 'tabpanel' as const, id: `${base}-panel-${id}`, 'aria-labelledby': `${base}-tab-${id}`, tabIndex: 0 };
}
