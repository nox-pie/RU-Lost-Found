import { Home, MessagesSquare, Package, Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { ReportItemDialog } from '../../features/items/ReportItemDialog';

const LINKS = [
  { to: '/', label: 'Browse', icon: Home, end: true },
  { to: '/my-items', label: 'My items', icon: Package, end: false },
  null, // the Report button sits in the middle
  { to: '/claims', label: 'Claims', icon: MessagesSquare, end: false },
  { to: '/profile', label: 'Profile', icon: UserRound, end: false },
] as const;

/** Phones: the main sections within thumb reach, with reporting in the middle. */
export function BottomNav() {
  const [reporting, setReporting] = useState(false);

  return (
    <>
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {LINKS.map((link) =>
            link ? (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium ${isActive ? 'text-primary' : 'text-gray-500'}`
                  }
                >
                  <link.icon className="h-5 w-5" aria-hidden />
                  {link.label}
                </NavLink>
              </li>
            ) : (
              <li key="report" className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setReporting(true)}
                  aria-label="Report an item"
                  className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-4 ring-surface hover:bg-primary-dark focus:outline-none focus-visible:ring-primary/40"
                >
                  <Plus className="h-7 w-7" aria-hidden />
                </button>
              </li>
            ),
          )}
        </ul>
      </nav>
      <ReportItemDialog open={reporting} onClose={() => setReporting(false)} />
    </>
  );
}
