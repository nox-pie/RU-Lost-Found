import type { ExportedPost } from './PostExportReader';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Tells Excel the file is UTF-8 (otherwise curly quotes and ₹ come out garbled). */
const BYTE_ORDER_MARK = '\uFEFF';

const COLUMNS: [string, (post: ExportedPost) => string | number | null][] = [
  ['Posted on', (p) => day(p.createdAt)],
  ['Type', (p) => p.type],
  ['Category', (p) => p.category],
  ['Title', (p) => p.title],
  ['Campus place', (p) => p.place],
  ['Exact spot', (p) => p.location],
  ['Happened on', (p) => day(p.occurredOn)],
  ['Status', (p) => p.status],
  ['Closed because', (p) => p.closeReason],
  ['Returned on', (p) => (p.resolvedAt ? day(p.resolvedAt) : null)],
  [
    'Days to return',
    (p) =>
      p.resolvedAt
        ? Math.round(((p.resolvedAt.getTime() - p.createdAt.getTime()) / DAY_MS) * 10) / 10
        : null,
  ],
  ['Held at the security desk', (p) => (p.heldAtSecurityDesk ? 'yes' : 'no')],
];

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * One CSV cell. Text a spreadsheet would read as a formula (=, +, -, @ at the start) is kept as
 * text with a leading apostrophe, so a post title can't run anything when the file is opened.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The posts as a CSV file (RFC 4180: CRLF line ends, quoted cells), with a byte-order mark so
 * Excel reads it as UTF-8.
 */
export function postsCsv(posts: readonly ExportedPost[]): string {
  const lines = [
    COLUMNS.map(([header]) => csvCell(header)).join(','),
    ...posts.map((post) => COLUMNS.map(([, read]) => csvCell(read(post))).join(',')),
  ];
  return `${BYTE_ORDER_MARK}${lines.join('\r\n')}\r\n`;
}
