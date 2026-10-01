import { type SafeHtml, html } from './html';

/** How emails look for this deployment. Set from configuration (BRAND_*), never hard-coded. */
export interface EmailBrand {
  name: string;
  /** Hex colour for the header, codes and buttons. */
  primaryColor: string;
  /** Hex colour behind the email card. */
  backgroundColor: string;
}

/**
 * The shared look of every email: header with the product name, content, footer. Templates
 * build their content with `code()` and `button()` so colours stay consistent.
 */
export class EmailLayout {
  constructor(readonly brand: EmailBrand) {}

  page(title: string, body: SafeHtml): string {
    const { name, primaryColor, backgroundColor } = this.brand;
    return html`<!doctype html>
      <html lang="en">
        <body
          style="margin:0;padding:24px;background:${backgroundColor};font-family:Arial,Helvetica,sans-serif;color:#1f2937"
        >
          <table
            role="presentation"
            width="100%"
            style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px"
          >
            <tr>
              <td style="padding:24px 28px;border-bottom:3px solid ${primaryColor}">
                <strong style="font-size:18px;color:${primaryColor}">${name}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:28px">
                <h1 style="margin:0 0 16px;font-size:20px">${title}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;font-size:12px;color:#6b7280">
                You received this email because of activity on your ${name} account.
              </td>
            </tr>
          </table>
        </body>
      </html>`.value;
  }

  /** A one-time or handover code, shown large. */
  code(code: string): SafeHtml {
    return html`<p
      style="margin:24px 0;font-size:32px;font-weight:bold;letter-spacing:8px;color:${
        this.brand.primaryColor
      }"
    >
      ${code}
    </p>`;
  }

  button(label: string, url: string): SafeHtml {
    return html`<p style="margin-top:24px">
      <a
        href="${url}"
        style="display:inline-block;padding:12px 20px;background:${
          this.brand.primaryColor
        };color:#ffffff;border-radius:8px;text-decoration:none"
        >${label}</a
      >
    </p>`;
  }
}
