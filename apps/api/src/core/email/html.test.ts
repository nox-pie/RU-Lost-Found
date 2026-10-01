import { describe, expect, it } from 'vitest';
import { EmailLayout } from './EmailLayout';
import { SafeHtml, escapeHtml, html } from './html';

describe('email html', () => {
  it('escapes every interpolated value', () => {
    const name = '<script>alert("x")</script> & \'friends\'';

    expect(html`<p>${name}</p>`.value).toBe(
      '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;friends&#39;</p>',
    );
  });

  it('keeps nested templates and SafeHtml as markup, and skips null values', () => {
    const inner = html`<b>${'<i>'}</b>`;

    expect(html`<p>${inner}${null}${new SafeHtml('<br>')}${[1, '<']}</p>`.value).toBe(
      '<p><b>&lt;i&gt;</b><br>1&lt;</p>',
    );
  });

  it('escapes the title in the layout', () => {
    expect(layout.page('<Title>', html`body`)).toContain('&lt;Title&gt;');
    expect(escapeHtml('a"b')).toBe('a&quot;b');
  });
});

const layout = new EmailLayout({
  name: 'Acme & Co Lost Property',
  primaryColor: '#123456',
  backgroundColor: '#abcdef',
});

describe('EmailLayout', () => {
  it('uses the configured name and colours instead of hard-coded branding', () => {
    const page = layout.page('Hello', html`${layout.code('123456')}${layout.button('Open', '/x')}`);

    expect(page).toContain('Acme &amp; Co Lost Property');
    expect(page).toContain('background:#abcdef');
    expect(page.match(/#123456/g)).toHaveLength(4);
    expect(page).not.toMatch(/RU Lost|#e63946|#fcf1e8/);
  });
});
