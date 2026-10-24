import { useRef, useState, type ReactNode } from 'react';
import { useInView, usePrefersReducedMotion } from '../../lib/hooks';

/**
 * Fades its content up once, the first time it scrolls into view. The landing page's only
 * scroll effect, and off for people who reduce motion (their content is simply there).
 */
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.15);
  const reducedMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(reducedMotion);
  if (inView && !shown) setShown(true);

  return (
    <div
      ref={ref}
      className={`transition duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

/** The heading every landing section starts with: a small label, the headline, a line of text. */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  dark?: boolean;
}) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
      <p
        className={`text-sm font-semibold uppercase tracking-widest ${dark ? 'text-secondary-light' : 'text-primary'}`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-2 font-display text-3xl font-bold sm:text-4xl ${dark ? 'text-white' : 'text-gray-900'}`}
      >
        {title}
      </h2>
      {intro && <p className={`mt-3 ${dark ? 'text-white/85' : 'text-gray-600'}`}>{intro}</p>}
    </div>
  );
}
