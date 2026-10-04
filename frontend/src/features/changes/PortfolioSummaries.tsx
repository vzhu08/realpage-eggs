import type { GroupSummary } from '../../lib/portfolio';

const COLUMNS = ['Properties', 'Definite', 'Uncertain', 'Conflict'] as const;

interface TableProps {
  caption: string;
  columnLabel: string;
  groups: GroupSummary[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Shown instead of rows while the records the grouping needs are still being read. */
  pending?: string;
}

/**
 * Counts of properties with a changed result, grouped. The numbers regroup the comparison's
 * own per-property results; a property under two headings is counted in both.
 */
export function SummaryTable({ caption, columnLabel, groups, selected, onSelect, pending }: TableProps) {
  return (
    <div className="summary" data-summary={columnLabel}>
      {/* Explicit roles keep the table semantics when narrow screens lay the rows out as blocks. */}
      <table className="table summary__table" role="table">
        <caption className="table__caption">{caption}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              {columnLabel}
            </th>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" role="columnheader" className="summary__num">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {groups.map((group) => {
            const active = selected === group.key;
            return (
              <tr key={group.key} role="row" data-group={group.key} className={active ? 'summary__row summary__row--active' : 'summary__row'}>
                <th scope="row" role="rowheader">
                  <button type="button" className="summary__filter" aria-pressed={active} onClick={() => onSelect(active ? null : group.key)}>
                    {group.label}
                  </button>
                  {group.note && <span className="summary__note">{group.note}</span>}
                </th>
                {[group.properties, group.definite, group.uncertain, group.conflict].map((value, index) => (
                  <td key={COLUMNS[index]} role="cell" className="summary__num" data-label={COLUMNS[index]}>
                    {value}
                  </td>
                ))}
              </tr>
            );
          })}
          {!groups.length && (
            <tr role="row">
              <td colSpan={5} role="cell" className="table__muted summary__empty">
                {pending ?? 'No property has a changed result.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
