/**
 * Date helpers. Query dates are ISO calendar days and are never derived from the machine
 * clock; formatting is done in UTC so a day never shifts with the viewer's time zone.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** True for a real calendar day written YYYY-MM-DD. */
export function isIsoDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
}

export type DatePrecision = 'year' | 'month' | 'day';

/** Precision of a contract date string (YYYY, YYYY-MM or YYYY-MM-DD), or null when malformed. */
export function datePrecision(value: string): DatePrecision | null {
  if (/^\d{4}$/.test(value)) return Number(value) >= 1 ? 'year' : null;
  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) return Number(month[2]) >= 1 && Number(month[2]) <= 12 ? 'month' : null;
  return isIsoDay(value) ? 'day' : null;
}

/** "Nov 15, 2026", "Nov 2026" or "2026" — the stated precision is preserved, never padded. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const precision = datePrecision(value);
  if (!precision) return value;
  const [year, month, day] = value.split('-');
  if (precision === 'year') return year as string;
  const name = MONTHS[Number(month) - 1];
  return precision === 'month' ? `${name} ${year}` : `${name} ${Number(day)}, ${year}`;
}

/** Retrieval timestamps: shown in UTC with the zone stated, so two viewers read the same instant. */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCDate()}, ${parsed.getUTCFullYear()}, ${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())} UTC`;
}
