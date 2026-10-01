import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';
import { brand } from '../../brand/brand.config';
import { adminApi } from '../../lib/api/endpoints';
import { queryKeys } from '../../lib/queryClient';

const TABS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/reports', label: 'Reports', end: false },
  { to: '/admin/users', label: 'People', end: false },
  { to: '/admin/activity', label: 'Activity', end: false },
];

/** Admin area: tabs over the overview, review queue, people and activity log. */
export default function AdminLayout() {
  const stats = useQuery({ queryKey: queryKeys.admin.stats, queryFn: adminApi.stats });
  const openReports = stats.data?.moderation.openReports ?? 0;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-gray-900">Admin</h1>
      <p className="mt-1 text-gray-600">Keep {brand.organisation.name}’s portal healthy.</p>

      <nav
        aria-label="Admin sections"
        className="-mx-4 mt-6 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${isActive ? 'bg-primary text-white' : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50'}`
            }
          >
            {tab.label}
            {tab.to === '/admin/reports' && openReports > 0 && (
              <span className="rounded-full bg-secondary px-2 text-xs font-semibold text-white">
                {openReports}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
