import { useQuery } from '@tanstack/react-query';
import { Flag, History, LayoutDashboard, Newspaper, Users } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { brand } from '../../brand/brand.config';
import { adminApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/queryClient';

const SECTIONS = [
  {
    to: '/admin',
    label: 'Overview',
    icon: LayoutDashboard,
    end: true,
    title: 'Overview',
    description: `How ${brand.organisation.name}’s portal is doing, and what needs you.`,
  },
  {
    to: '/admin/reports',
    label: 'Reports',
    icon: Flag,
    end: false,
    title: 'Reported posts',
    description: 'Posts people flagged. Keep each one, or remove it with a reason for the poster.',
  },
  {
    to: '/admin/posts',
    label: 'Posts',
    icon: Newspaper,
    end: false,
    title: 'All posts',
    description: 'Every post, removed ones included. Search, filter and remove any of them.',
  },
  {
    to: '/admin/users',
    label: 'People',
    icon: Users,
    end: false,
    title: 'People',
    description: 'Everyone with an account. Change roles, suspend or reactivate.',
  },
  {
    to: '/admin/activity',
    label: 'Activity',
    icon: History,
    end: false,
    title: 'Activity',
    description:
      'Security-relevant actions in the last year: sign-ins, posts, claims and admin decisions. Click a name to see everything that person did.',
  },
] as const;

/** Admin area: one header and one bar of sections over the overview, queues, people and log. */
export default function AdminLayout() {
  const { pathname } = useLocation();
  const stats = useQuery({ queryKey: queryKeys.admin.stats, queryFn: adminApi.stats });
  const openReports = stats.data?.moderation.openReports ?? 0;
  const current =
    SECTIONS.find((section) =>
      section.end ? pathname === section.to : pathname.startsWith(section.to),
    ) ?? SECTIONS[0];

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Admin</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-gray-900">{current.title}</h1>
      <p className="mt-1 max-w-2xl text-gray-600">{current.description}</p>

      <nav
        aria-label="Admin sections"
        className="-mx-4 mt-6 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        <div className="inline-flex gap-1 rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-black/5">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors sm:px-4 ${isActive ? 'bg-primary text-primary-contrast shadow-xs' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
              }
            >
              <section.icon className="h-4 w-4" aria-hidden />
              {section.label}
              {section.to === '/admin/reports' && openReports > 0 && (
                <span className="rounded-full bg-secondary px-2 text-xs font-semibold text-secondary-contrast">
                  {openReports}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
