import type { ReactNode } from 'react';
import { Input } from '../../components/ui/Field';
import { brand } from '../../brand/brand.config';

/** Campus background, organisation logo and a card for the form. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${brand.images.authBackground}')` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/20" aria-hidden />
      <img
        src={brand.images.logo}
        alt={brand.organisation.name}
        className="relative mb-6 w-48 rounded-xl bg-white p-3 shadow-md"
      />
      <main className="relative w-full max-w-md rounded-2xl border border-white/60 bg-surface/95 p-7 shadow-xl backdrop-blur-md sm:p-8">
        <h1 className="text-center font-display text-2xl font-bold text-gray-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-center text-sm text-gray-600">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

/** Six-digit code field that phones can fill from the SMS/email suggestion bar. */
export function CodeInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <Input
      label="6-digit code"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="••••••"
      className="text-center font-mono text-2xl tracking-[0.5em]"
      error={error}
      autoFocus
    />
  );
}
