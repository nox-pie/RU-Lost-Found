import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { brand } from '../../brand/brand.config';
import { Footer } from '../../components/layout/Footer';

/** The privacy policy and terms: open to everyone, signed in or not. */
export function LegalLayout({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  /** e.g. "18 October 2026" */
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="header-solid shadow-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-secondary-light bg-white p-1.5">
              <img src={brand.images.symbol} alt="" className="h-full w-full object-contain" />
            </span>
            <span className="font-display text-lg font-bold text-white">{brand.productName}</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-white hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Home
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-grow px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated {updated}</p>
        <div className="mt-6 text-gray-700">{intro}</div>
        <div className="mt-8 space-y-6">{children}</div>
        <p className="mt-10 text-sm text-gray-600">
          Questions? Write to{' '}
          <a href={`mailto:${brand.contactEmail}`} className="font-medium text-primary underline">
            {brand.contactEmail}
          </a>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}

/** One numbered part of a policy, in a card. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-xl font-semibold text-gray-900">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
