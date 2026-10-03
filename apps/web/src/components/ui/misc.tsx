import type { ReactNode } from 'react';
import type { Tone } from '../../lib/format';
import { Spinner } from './Spinner';

const TONES: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-50 text-blue-700',
  warning: 'bg-amber-50 text-amber-800',
  success: 'bg-green-50 text-green-700',
  danger: 'bg-red-50 text-red-700',
  muted: 'bg-gray-100 text-gray-500',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  url,
  size = 'md',
}: {
  name: string;
  url: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dimensions = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-24 w-24 text-3xl',
  }[size];
  if (url) {
    return <img src={url} alt="" className={`${dimensions} rounded-full object-cover`} />;
  }
  // No picture: the person's initials on a brand-tinted circle. The tint sits on white, so the
  // initials stay readable on any background (a coloured header included).
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span aria-hidden className={`${dimensions} inline-flex shrink-0 rounded-full bg-white`}>
      <span className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
        {initials || '?'}
      </span>
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-gray-400">{icon}</div>}
      <p className="font-display text-lg text-gray-800">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-gray-500">{children}</div>}
    </div>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500" role="status">
      <Spinner className="mb-3 h-8 w-8 text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center" role="alert">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-sm font-medium text-red-700 underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
