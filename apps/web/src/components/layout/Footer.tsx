import { ExternalLink, Heart, Mail, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { brand } from '../../brand/brand.config';

export function Footer() {
  const { organisation } = brand;

  return (
    <footer className="bg-primary-dark text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-9 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-10">
        <div className="text-center md:text-left">
          <img
            src={brand.images.logoOnDark}
            alt={organisation.name}
            width={130}
            height={48}
            loading="lazy"
            className="mx-auto h-10 w-auto md:mx-0"
          />
          <p className="mt-3 font-display text-xl font-bold">{brand.productName}</p>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-white/90 md:mx-0">
            {brand.tagline}
          </p>
        </div>

        {/* The campus drawing has its own column: nothing is drawn on top of it. */}
        <img
          src={brand.images.footerArt}
          alt=""
          aria-hidden
          width={1280}
          height={344}
          loading="lazy"
          className="order-last mx-auto w-full max-w-xs select-none opacity-90 md:order-none md:w-[22rem] md:max-w-none lg:w-[35rem]"
        />

        <ul className="space-y-2.5 text-sm text-white/90 md:justify-self-end">
          <FooterLink
            href={organisation.mapUrl}
            icon={<MapPin className="h-4 w-4 shrink-0" />}
            external
          >
            {organisation.name}, {organisation.location}
          </FooterLink>
          <FooterLink
            href={`mailto:${brand.contactEmail}`}
            icon={<Mail className="h-4 w-4 shrink-0" />}
          >
            <span className="break-all">{brand.contactEmail}</span>
          </FooterLink>
          <FooterLink
            href={organisation.website}
            icon={<ExternalLink className="h-4 w-4 shrink-0" />}
            external
          >
            {organisation.website.replace(/^https?:\/\//, '')}
          </FooterLink>
        </ul>
      </div>

      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1.5 px-4 py-4 text-sm text-white/90 sm:flex-row sm:px-6">
          <span>
            © {new Date().getFullYear()} {brand.productName} · {organisation.name}
          </span>
          <nav aria-label="Legal" className="flex gap-4">
            <Link to="/privacy" className="hover:text-white hover:underline">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-white hover:underline">
              Terms
            </Link>
          </nav>
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

function FooterLink({
  href,
  icon,
  external = false,
  children,
}: {
  href: string;
  icon: ReactNode;
  external?: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
        className="flex items-start justify-center gap-2.5 hover:text-white hover:underline md:justify-start"
      >
        <span className="mt-0.5" aria-hidden>
          {icon}
        </span>
        <span>
          {children}
          {external && <span className="sr-only"> (opens in a new tab)</span>}
        </span>
      </a>
    </li>
  );
}
