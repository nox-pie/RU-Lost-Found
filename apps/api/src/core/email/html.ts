/** A string that is already safe to insert into HTML. */
export class SafeHtml {
  constructor(readonly value: string) {}

  toString(): string {
    return this.value;
  }
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

type Interpolation = SafeHtml | string | number | null | undefined | Interpolation[];

function render(value: Interpolation): string {
  if (value === null || value === undefined) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(String(value));
}

/**
 * Tagged template for email HTML. Every interpolated value is escaped unless it is already
 * SafeHtml, so user input (names, item titles, messages) can never inject markup or links.
 *
 *   html`<p>Hello ${user.firstName}</p>`
 */
export function html(strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml {
  let out = strings[0] ?? '';
  values.forEach((value, index) => {
    out += render(value) + (strings[index + 1] ?? '');
  });
  return new SafeHtml(out);
}
