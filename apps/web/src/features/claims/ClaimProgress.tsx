import type { ClaimDto, ClaimStatus } from '@ru-lost-found/shared';
import { Check, X } from 'lucide-react';

type StepState = 'done' | 'current' | 'upcoming' | 'stopped';

const STOPPED_LABEL: Partial<Record<ClaimStatus, string>> = {
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

/**
 * Where a claim is on its way: sent → approved → handed over. A claim that ended early
 * (declined, cancelled, expired) shows where it stopped.
 */
export function ClaimProgress({ claim }: { claim: ClaimDto }) {
  const reached = new Set(claim.history.map((entry) => entry.status));
  const approved = reached.has('APPROVED');
  const stopped = STOPPED_LABEL[claim.status];
  const steps: { label: string; state: StepState }[] = [
    { label: claim.kind === 'OWNERSHIP' ? 'Claim sent' : 'Report sent', state: 'done' },
    {
      label: stopped && !approved ? stopped : 'Approved',
      state: approved ? 'done' : stopped ? 'stopped' : 'current',
    },
    {
      label: stopped && approved ? stopped : 'Handed over',
      state:
        claim.status === 'COMPLETED'
          ? 'done'
          : stopped
            ? approved
              ? 'stopped'
              : 'upcoming'
            : approved
              ? 'current'
              : 'upcoming',
    },
  ];

  return (
    <ol aria-label="Progress" className="mt-6 flex items-start rounded-2xl bg-white p-4 shadow-sm">
      {steps.map((step, index) => (
        <li
          key={step.label}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="relative flex flex-1 flex-col items-center text-center"
        >
          {index > 0 && (
            <span
              aria-hidden
              className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${step.state === 'done' || step.state === 'stopped' ? 'bg-primary' : 'bg-gray-200'}`}
            />
          )}
          <span
            className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
              step.state === 'done'
                ? 'bg-primary text-white'
                : step.state === 'stopped'
                  ? 'bg-red-100 text-red-700'
                  : step.state === 'current'
                    ? 'border-2 border-primary bg-white text-primary'
                    : 'border-2 border-gray-200 bg-white text-gray-400'
            }`}
          >
            {step.state === 'done' ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : step.state === 'stopped' ? (
              <X className="h-4 w-4" aria-hidden />
            ) : (
              index + 1
            )}
          </span>
          <span
            className={`mt-2 text-xs font-medium sm:text-sm ${step.state === 'upcoming' ? 'text-gray-400' : step.state === 'stopped' ? 'text-red-700' : 'text-gray-900'}`}
          >
            {step.label}
            <span className="sr-only">
              {step.state === 'done'
                ? ' (done)'
                : step.state === 'current'
                  ? ' (in progress)'
                  : step.state === 'stopped'
                    ? ''
                    : ' (not yet)'}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
