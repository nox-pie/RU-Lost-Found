import { Heart, Mail, MapPin } from 'lucide-react';
import { brand } from '../../brand/brand.config';

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-primary-dark">
      <img
        src={brand.images.footerArt}
        alt=""
        loading="lazy"
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
            <p className="mt-1 max-w-md text-sm text-white/90">{brand.tagline}</p>
          </div>
          <div className="flex flex-col items-center gap-2 text-sm text-white/90 md:items-end">
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
        <div className="flex flex-col items-center justify-between gap-2 border-t border-white/20 pt-6 text-sm text-white/90 sm:flex-row">
          {brand.credit && (
            <span className="flex items-center gap-1">
              Created with <Heart className="h-3.5 w-3.5 fill-white text-white" aria-label="love" />{' '}
              by {brand.credit}
            </span>
          )}
          <span className="text-xs text-white/85">
            © {new Date().getFullYear()} {brand.productName} · {brand.organisation.name}
          </span>
        </div>
      </div>
    </footer>
  );
}
