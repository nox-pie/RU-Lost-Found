import { Heart, Mail, MapPin } from 'lucide-react';
import { Outlet } from 'react-router';
import { Header } from './Header';
import { brand } from '../../brand/brand.config';

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="mx-auto w-full max-w-7xl flex-grow px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-primary-dark">
      <img
        src={brand.images.footerArt}
        alt=""
        className="pointer-events-none absolute bottom-0 left-1/2 select-none mix-blend-overlay"
        style={{
          filter: 'invert(1) contrast(2)',
          transform: 'translateX(-50%) scale(0.55)',
          transformOrigin: 'bottom center',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-14 sm:px-6">
        <div className="mb-8 flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-center md:text-left">
            <p className="font-display text-2xl font-bold text-white">{brand.productName}</p>
            <p className="mt-1 max-w-md text-sm text-white/70">{brand.tagline}</p>
          </div>
          <div className="flex flex-col items-center gap-2 text-sm text-white/80 md:items-end">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {brand.organisation.name},{' '}
              {brand.organisation.location}
            </span>
            <a
              href={`mailto:${brand.contactEmail}`}
              className="flex items-center gap-2 break-all hover:text-white"
            >
              <Mail className="h-4 w-4 shrink-0" /> {brand.contactEmail}
            </a>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-2 border-t border-white/20 pt-6 text-sm text-white/60 sm:flex-row">
          {brand.credit && (
            <span className="flex items-center gap-1">
              Created with <Heart className="h-3.5 w-3.5 fill-white text-white" aria-label="love" />{' '}
              by {brand.credit}
            </span>
          )}
          <span className="text-xs text-white/40">
            © {new Date().getFullYear()} {brand.productName} · {brand.organisation.name}
          </span>
        </div>
      </div>
    </footer>
  );
}
