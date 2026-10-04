/** A small original icon set. Icons are decorative; meaning is always carried by adjacent text. */
const PATHS = {
  applies: <path d="M5 10.5 8.5 14 15 6.5" />,
  unknown: (
    <>
      <path d="M7.4 7.4a2.7 2.7 0 1 1 3.9 2.4c-.8.4-1.3 1-1.3 1.9v.3" />
      <path d="M10 14.6v.1" />
    </>
  ),
  future: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10l2.5 1.8" />
    </>
  ),
  pending: <circle cx="10" cy="10" r="6.5" strokeDasharray="2.6 2.6" />,
  muted: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="m5.6 14.4 8.8-8.8" />
    </>
  ),
  danger: (
    <>
      <path d="M10 3.5 17 16H3z" />
      <path d="M10 8.5v3.2M10 13.9v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 9.2v4M10 6.6v.1" />
    </>
  ),
  neutral: <circle cx="10" cy="10" r="2.5" />,
  search: (
    <>
      <circle cx="9" cy="9" r="5" />
      <path d="m13 13 3.5 3.5" />
    </>
  ),
  close: <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />,
  external: (
    <>
      <path d="M11.5 4.5h4v4M15.5 4.5 9.5 10.5" />
      <path d="M13.5 11.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
    </>
  ),
  chevron: <path d="m7.5 5 5 5-5 5" />,
  arrow: <path d="M4.5 10h11M11.5 6l4 4-4 4" />,
  quote: <path d="M5 13.5c0-3 1-5.5 3.5-7M11 13.5c0-3 1-5.5 3.5-7" />,
  edit: <path d="M4.5 15.5l1-3.6 7.6-7.6a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2l-7.6 7.6z" />,
  document: (
    <>
      <path d="M6 3.5h5.5L15 7v9.5H6z" />
      <path d="M11.5 3.5V7H15M8.3 10.5h4.4M8.3 13h4.4" />
    </>
  ),
  layers: (
    <>
      <path d="m10 4 6.5 3.4L10 10.8 3.5 7.4z" />
      <path d="m3.5 11 6.5 3.4 6.5-3.4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6.5h7M14.5 6.5H16M4 13.5h1.5M9 13.5h7" />
      <circle cx="12.7" cy="6.5" r="1.7" />
      <circle cx="7.2" cy="13.5" r="1.7" />
    </>
  ),
  list: <path d="M7 6h9M7 10h9M7 14h9M4 6h.1M4 10h.1M4 14h.1" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className ? `icon ${className}` : 'icon'} width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
