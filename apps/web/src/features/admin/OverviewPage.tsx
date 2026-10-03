import { CLAIM_STATUSES, ROLES, type UniversityStatsDto } from '@ru-lost-found/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, Flag, Handshake, PackageOpen, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ErrorState, PageLoader } from '../../components/ui/misc';
import { adminApi } from '../../lib/api/endpoints';
import { CLAIM_STATUS, ROLE_LABELS, formatDay, formatPercent } from '../../lib/format';
import { queryKeys } from '../../lib/queryClient';

export default function OverviewPage() {
  const stats = useQuery({ queryKey: queryKeys.admin.stats, queryFn: adminApi.stats });

  if (stats.isPending) return <PageLoader />;
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  return <Overview stats={stats.data} />;
}

function Overview({ stats }: { stats: UniversityStatsDto }) {
  const { items, users, claims, moderation } = stats;
  const inPlay = items.byStatus.OPEN + items.byStatus.RESERVED;
  const claimsInProgress = claims.byStatus.REQUESTED + claims.byStatus.APPROVED;

  return (
    <div className="space-y-6">
      {/* Only when something needs an admin: nothing is shown when the queue is empty. */}
      {moderation.openReports > 0 && <ReportsWaiting count={moderation.openReports} />}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<PackageOpen className="h-5 w-5" />}
          label="Posts in play"
          value={inPlay}
          detail={`${items.lost} lost · ${items.found} found in total`}
        />
        <StatCard
          icon={<Undo2 className="h-5 w-5" />}
          label="Returned"
          value={items.byStatus.RESOLVED}
          detail={`${formatPercent(items.recoveryRate)} of posts · ${items.returnedLast30Days} in the last 30 days`}
          progress={items.recoveryRate ?? undefined}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Average time to return"
          value={items.averageDaysToReturn === null ? '–' : `${items.averageDaysToReturn} d`}
          detail="From posting to handover"
        />
        <StatCard
          icon={<Handshake className="h-5 w-5" />}
          label="Claims in progress"
          value={claimsInProgress}
          detail={`${claims.byStatus.REQUESTED} waiting for a reply · ${claims.byStatus.APPROVED} meeting up`}
        />
      </div>

      <WeeklyChart weeks={stats.weekly} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="People">
          <p className="mt-1 text-sm text-gray-500">
            {users.total} accounts · {users.joinedLast30Days} joined in the last 30 days
            {users.suspended > 0 && ` · ${users.suspended} suspended`}
          </p>
          <Breakdown
            rows={ROLES.map((role) => ({ label: ROLE_LABELS[role], value: users.byRole[role] }))}
          />
        </Panel>
        <Panel title="Claims">
          <p className="mt-1 text-sm text-gray-500">Every claim ever made, by where it stands.</p>
          <Breakdown
            rows={CLAIM_STATUSES.map((status) => ({
              label: CLAIM_STATUS[status].label,
              value: claims.byStatus[status],
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}

/** The one thing on this page that needs an admin's action. */
function ReportsWaiting({ count }: { count: number }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-secondary-light/20 p-5 ring-1 ring-secondary/40 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-start gap-4 sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-contrast sm:h-12 sm:w-12">
          <Flag className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
        </span>
        <div>
          <h2 className="font-sans text-lg font-semibold text-gray-900">
            {count === 1
              ? '1 reported post needs a decision'
              : `${count} reported posts need a decision`}
          </h2>
          <p className="text-sm text-gray-700">
            People flagged {count === 1 ? 'a post' : 'these posts'}. Keep or remove, with a reason
            for the poster.
          </p>
        </div>
      </div>
      <Link
        to="/admin/reports"
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-contrast shadow-sm hover:bg-primary-dark"
      >
        Review now <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  progress,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail: ReactNode;
  /** 0..1, drawn as a thin bar under the number. */
  progress?: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 sm:p-5">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-10 sm:w-10">
          {icon}
        </span>
        <span className="text-xs font-medium leading-tight text-gray-600 sm:text-sm">{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-gray-900 sm:mt-4 sm:text-4xl">
        {value}
      </p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-gray-100" aria-hidden>
          <div
            className="h-1.5 rounded-full bg-secondary"
            style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function Breakdown({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <dl className="mt-4 space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3">
          <dt className="truncate text-sm text-gray-600">{row.label}</dt>
          <div className="h-2 rounded-full bg-gray-100" aria-hidden>
            <div
              className="h-2 rounded-full bg-primary/70"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
          <dd className="text-right text-sm font-medium text-gray-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Posted vs returned per week, as paired bars. The numbers are also in a table for screen readers. */
function WeeklyChart({ weeks }: { weeks: UniversityStatsDto['weekly'] }) {
  const max = Math.max(1, ...weeks.flatMap((week) => [week.reported, week.returned]));
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Last 8 weeks</h2>
        <div className="flex gap-4 text-xs text-gray-600" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Posted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-secondary" /> Returned
          </span>
        </div>
      </div>
      <div className="mt-5 flex h-40 items-end gap-2 sm:gap-4" aria-hidden>
        {weeks.map((week) => (
          <div key={week.weekStart} className="flex h-full flex-1 flex-col justify-end">
            <div className="flex flex-1 items-end justify-center gap-1">
              <Bar value={week.reported} max={max} className="bg-primary" />
              <Bar value={week.returned} max={max} className="bg-secondary" />
            </div>
            <p className="mt-2 truncate text-center text-[11px] text-gray-500">
              {formatDay(week.weekStart).replace(/ \d{4}$/, '')}
            </p>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Items posted and returned per week</caption>
        <thead>
          <tr>
            <th>Week starting</th>
            <th>Posted</th>
            <th>Returned</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <td>{formatDay(week.weekStart)}</td>
              <td>{week.reported}</td>
              <td>{week.returned}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="relative flex h-full w-full max-w-[1.25rem] items-end">
      <div
        className={`w-full rounded-t ${className}`}
        style={{ height: value === 0 ? '2px' : `${(value / max) * 100}%` }}
        title={String(value)}
      />
    </div>
  );
}
