/**
 * Everything that makes this deployment look like Rishihood University's portal.
 *
 * To deploy for another organisation, edit this file and replace the images in public/brand/;
 * no component needs to change. The API has matching settings for emails (BRAND_* in
 * apps/api/.env) and its own list of universities (apps/api/seed/universities.json).
 * See docs/branding.md.
 *
 * Plain data only: this file is also read by tailwind.config.ts and vite.config.ts at build time.
 */

/** A colour with lighter and darker shades, as hex values. */
export type ColorScale = {
  DEFAULT: string;
  light: string;
  dark: string;
};

export interface Brand {
  /** The product's name, shown in the header, page titles and messages. */
  productName: string;
  /** Browser tab title. */
  pageTitle: string;
  /** Search-engine and link-preview description. */
  description: string;
  organisation: { name: string; location: string };
  /** One line under the product name in the footer. */
  tagline: string;
  /**
   * Which email to use, shown on the sign-in and sign-up pages. Keep it in line with the API's
   * seed/universities.json: "*" in emailDomains means any address may sign up.
   */
  emailHint: string;
  /** Where people can reach the team running this deployment. */
  contactEmail: string;
  /** "Created with ♥ by …" in the footer; null hides the line. */
  credit: string | null;
  /** Paths under public/. */
  images: {
    /** Organisation logo on the sign-in pages (wide). */
    logo: string;
    /** Small square mark: header, loading screen, favicon. */
    symbol: string;
    /** Photo behind the sign-in card. */
    authBackground: string;
    /** Line drawing faded into the footer. */
    footerArt: string;
  };
  colors: {
    /** Header, buttons, links. */
    primary: ColorScale;
    /** Accents and highlights. */
    secondary: ColorScale;
    /** Page background. */
    surface: string;
  };
}

export const brand: Brand = {
  productName: 'RU Lost & Found',
  pageTitle: 'RU Lost & Found - Rishihood University',
  description:
    'Lost & Found portal for Rishihood University - Connect lost items with their owners',
  organisation: { name: 'Rishihood University', location: 'Sonipat, Haryana' },
  tagline:
    'Helping the Rishihood University community reconnect with their belongings, one item at a time.',
  emailHint: 'Students: use your university email. Visitors can try it with any email.',
  contactEmail: 'prashant.k23csai@nst.rishihood.edu.in',
  credit: 'Prashant Kumar',
  images: {
    logo: '/brand/logo.png',
    symbol: '/brand/symbol.png',
    authBackground: '/brand/auth-background.png',
    footerArt: '/brand/footer-art.png',
  },
  colors: {
    primary: { DEFAULT: '#E63946', light: '#FF6B6B', dark: '#D32F2F' },
    secondary: { DEFAULT: '#F4A261', light: '#FFB085', dark: '#E67E22' },
    surface: '#fcf1e8',
  },
};
