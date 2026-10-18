import { Menu, X } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { brand } from '../../brand/brand.config';

const SECTIONS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'demo', label: 'Try the demo' },
  { id: 'safeguards', label: 'Safeguards' },
] as const;

/**
 * The landing page's bar: transparent over the campus photo, frosted and light once the photo
 * has scrolled away. Links to the page's sections, with the one being read underlined.
 */
export function LandingNav({ heroRef }: { heroRef: RefObject<HTMLElement> }) {
  const [overHero, setOverHero] = useState(true);
  const [current, setCurrent] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Over the photo until its bottom comes close to the bar (64 px tall, plus a margin, so a
  // jump to the next section never leaves a strip of photo behind the bar).
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setOverHero(entry?.isIntersecting ?? false),
      { rootMargin: '-96px 0px 0px 0px' },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroRef]);

  // The section crossing the middle of the screen is the one being read.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const { id } of SECTIONS) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);

  const light = !overHero || menuOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${light ? 'border-b border-black/5 bg-surface/90 shadow-xs backdrop-blur-md' : 'bg-linear-to-b from-black/40 to-transparent'}`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-secondary-light bg-white p-1.5 shadow-xs">
            <img src={brand.images.symbol} alt="" className="h-full w-full object-contain" />
          </span>
          <span
            className={`truncate font-display text-lg font-bold transition-colors sm:text-xl ${light ? 'text-gray-900' : 'text-white'}`}
          >
            {brand.productName}
          </span>
        </Link>

        <nav aria-label="Main" className="flex shrink-0 items-center gap-1">
          <ul className="mr-2 hidden items-center gap-1 md:flex">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={current === section.id ? 'location' : undefined}
                  className={`relative rounded-full px-3 py-2 text-sm font-medium transition-colors ${light ? 'text-gray-700 hover:text-primary' : 'text-white/90 hover:text-white'}`}
                >
                  {section.label}
                  <span
                    className={`absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full transition-opacity ${light ? 'bg-primary' : 'bg-white'} ${current === section.id ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
          <Link
            to="/login"
            className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${light ? 'text-gray-700 hover:bg-black/5' : 'text-white hover:bg-white/15'}`}
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className={`hidden rounded-full px-4 py-2 text-sm font-semibold shadow-xs transition-colors sm:inline-block ${light ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-white text-primary hover:bg-surface'}`}
          >
            Create account
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Sections"
            aria-expanded={menuOpen}
            className={`rounded-full p-2 md:hidden ${light ? 'text-gray-800 hover:bg-black/5' : 'text-white hover:bg-white/15'}`}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>
      </div>

      {menuOpen && (
        <ul className="border-t border-black/5 px-4 pb-4 pt-2 md:hidden animate-slide-down">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-3 py-2.5 font-medium text-gray-800 hover:bg-black/5"
              >
                {section.label}
              </a>
            </li>
          ))}
          <li>
            <Link
              to="/signup"
              className="mt-2 block rounded-xl bg-primary px-3 py-2.5 text-center font-semibold text-white"
            >
              Create account
            </Link>
          </li>
        </ul>
      )}
    </header>
  );
}
