import { LogOut, Menu, Plus, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { isAdmin, useAuth, useCurrentUser } from '../../features/auth/authContext';
import { ReportItemDialog } from '../../features/items/ReportItemDialog';
import { NotificationBell } from '../../features/notifications/NotificationBell';
import { Avatar } from '../ui/misc';
import { brand } from '../../brand/brand.config';

const LINKS = [
  { to: '/', label: 'Browse', end: true },
  { to: '/my-items', label: 'My items', end: false },
  { to: '/claims', label: 'Claims', end: false },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-white text-primary' : 'text-white/90 hover:bg-white/15'}`;
}

export function Header() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const account = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const links = isAdmin(user) ? [...LINKS, { to: '/admin', label: 'Admin', end: false }] : LINKS;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus when navigating.
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!account.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [accountOpen]);

  return (
    <header
      className={`sticky top-0 z-40 transition-shadow ${scrolled ? 'header-glass shadow-lg' : 'header-solid shadow-md'}`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-secondary bg-white p-1.5">
            <img src={brand.images.symbol} alt="" className="h-full w-full object-contain" />
          </span>
          <span className="font-display text-lg font-bold text-white sm:text-xl">
            {brand.productName}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={navClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="hidden items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm hover:bg-surface sm:inline-flex"
          >
            <Plus className="h-4 w-4" /> Report item
          </button>
          <NotificationBell />
          <div className="relative hidden md:block" ref={account}>
            <button
              type="button"
              onClick={() => setAccountOpen((value) => !value)}
              aria-label="Account menu"
              aria-expanded={accountOpen}
              className="rounded-full ring-2 ring-white/40 hover:ring-white"
            >
              <Avatar name={`${user.firstName} ${user.lastName}`} url={user.avatarUrl} size="sm" />
            </button>
            {accountOpen && (
              <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border bg-white shadow-xl animate-slide-down">
                <div className="border-b px-4 py-3">
                  <p className="truncate font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-gray-500">{user.email}</p>
                </div>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <UserRound className="h-4 w-4" /> Profile
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="rounded-full p-2 text-white hover:bg-white/15 md:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          className="border-t border-white/20 px-4 pb-4 pt-2 md:hidden animate-slide-down"
          aria-label="Mobile"
        >
          <p className="px-3 pb-2 pt-1 text-sm text-white/80">
            {user.firstName} {user.lastName}
          </p>
          {/* Browse, My items, Claims, Profile and Report are in the bottom bar on phones. */}
          {links
            .filter((link) => link.to === '/admin')
            .map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2.5 text-base font-medium ${isActive ? 'bg-white text-primary' : 'text-white'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-white"
          >
            Sign out
          </button>
        </nav>
      )}

      <ReportItemDialog open={reporting} onClose={() => setReporting(false)} />
    </header>
  );
}
