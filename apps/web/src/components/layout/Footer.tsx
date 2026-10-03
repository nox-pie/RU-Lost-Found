import { ExternalLink, Heart, Mail, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { brand } from '../../brand/brand.config';
import { useAuth } from '../../features/auth/authContext';

/** Where the footer's links lead, depending on whether the visitor is signed in. */
const LINKS = {
  signedIn: [
    { to: '/', label: 'Browse items' },
    { to: '/my-items', label: 'My items' },
    { to: '/claims', label: 'Claims' },
    { to: '/profile', label: 'Profile' },
  ],
  signedOut: [
    { to: '/#how-it-works', label: 'How it works' },
    { to: '/#demo', label: 'Try the demo' },
    { to: '/login', label: 'Sign in' },
    { to: '/signup', label: 'Create an account' },
  ],
};

export function Footer() {
  const { status } = useAuth();
  const links = status === 'authenticated' ? LINKS.signedIn : LINKS.signedOut;
  const { organisation } = brand;

  return (
    <footer className="bg-primary-dark text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-10 pt-14 sm:px-6 md:grid-cols-12">
        <div className="md:col-span-5">
          <img
            src={brand.images.logoOnDark}
            alt={organisation.name}
            width={160}
            height={58}
            loading="lazy"
            className="h-12 w-auto"
          />
          <p className="mt-5 font-display text-2xl font-bold">{brand.productName}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/90">{brand.tagline}</p>
        </div>

        <FooterColumn title="Explore" className="md:col-span-3">
          <ul className="space-y-2.5">
            {links.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-sm text-white/90 hover:text-white hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </FooterColumn>

        <FooterColumn title="Contact" className="md:col-span-4">
          <ul className="space-y-3 text-sm text-white/90">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {organisation.name}
                <br />
                {organisation.address}
              </span>
            </li>
            <li>
              <a
                href={`mailto:${brand.contactEmail}`}
                className="flex gap-2.5 break-all hover:text-white hover:underline"
              >
                <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {brand.contactEmail}
              </a>
            </li>
            <li>
              <a
                href={organisation.website}
                target="_blank"
                rel="noreferrer"
                className="flex gap-2.5 hover:text-white hover:underline"
              >
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {organisation.website.replace(/^https?:\/\//, '')}
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </FooterColumn>
      </div>

      {/* The campus drawing on its own band: nothing is drawn on top of it. */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6" aria-hidden>
        <img
          src={brand.images.footerArt}
          alt=""
          width={1280}
          height={344}
          loading="lazy"
          className="mx-auto w-full select-none opacity-90"
        />
      </div>

      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-white/90 sm:flex-row sm:px-6">
          <span>
            © {new Date().getFullYear()} {brand.productName} · {organisation.name}
          </span>
          {brand.credit && (
            <span className="flex items-center gap-1">
              Created with <Heart className="h-3.5 w-3.5 fill-white text-white" aria-label="love" />{' '}
              by {brand.credit}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <h2 className="mb-4 font-sans text-xs font-semibold uppercase tracking-widest text-white/85">
        {title}
      </h2>
      {children}
    </div>
  );
}
