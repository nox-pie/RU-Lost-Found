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
  /** Text and icons placed on DEFAULT (and its shades): white on a dark colour, dark on a light one. */
  contrast: string;
};

export interface Brand {
  /** The product's name, shown in the header, page titles and messages. */
  productName: string;
  /** Name under the icon when installed on a phone's home screen (about 12 characters fit). */
  shortName: string;
  /** Browser tab title. */
  pageTitle: string;
  /** Search-engine and link-preview description. */
  description: string;
  organisation: {
    name: string;
    location: string;
    /** Opens the organisation on a map (Google Maps), from the footer. */
    mapUrl: string;
    /** The organisation's own website, linked from the footer. */
    website: string;
  };
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
    /** Organisation logo in white, for dark backgrounds (footer). */
    logoOnDark: string;
    /** White line drawing of the campus, shown on its own band in the footer (transparent PNG). */
    footerArt: string;
    /** Installed-app icons (square PNGs): 192 and 512 px, a 512 px "maskable" one with the art
     * inside the central 80 % (Android may crop it to a circle), and 180 px for iOS. */
    appIcons: { small: string; large: string; maskable: string; apple: string };
  };
  /**
   * Text on a colour uses its `contrast` value, which needs at least 4.5:1 against DEFAULT and
   * its shades (WCAG AA; the accessibility e2e test checks it). `primary` is also used as text
   * on light backgrounds, so it needs 4.5:1 against white and the surface too; `secondary` is
   * used only as a background and for decoration.
   */
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
  shortName: 'Lost & Found',
  pageTitle: 'RU Lost & Found - Rishihood University',
  description:
    'Lost & Found portal for Rishihood University - Connect lost items with their owners',
  organisation: {
    name: 'Rishihood University',
    location: 'Sonipat, Haryana',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Rishihood+University+Sonipat+Haryana',
    website: 'https://rishihood.edu.in',
  },
  tagline:
    'Helping the Rishihood University community reconnect with their belongings, one item at a time.',
  emailHint: 'Students: use your university email. Visitors can try it with any email.',
  contactEmail: 'prashant.k23csai@nst.rishihood.edu.in',
  credit: 'Prashant Kumar',
  images: {
    logo: '/brand/logo.png',
    symbol: '/brand/symbol.png',
    authBackground: '/brand/auth-background.jpg',
    logoOnDark: '/brand/logo-white.webp',
    footerArt: '/brand/campus-drawing-white.png',
    appIcons: {
      small: '/brand/app-icon-192.png',
      large: '/brand/app-icon-512.png',
      maskable: '/brand/app-icon-maskable-512.png',
      apple: '/brand/apple-touch-icon.png',
    },
  },
  colors: {
    primary: { DEFAULT: '#C62835', light: '#FF6B6B', dark: '#A8232B', contrast: '#FFFFFF' },
    secondary: { DEFAULT: '#C4500A', light: '#F4A261', dark: '#A3420A', contrast: '#FFFFFF' },
    surface: '#fcf1e8',
  },
};
