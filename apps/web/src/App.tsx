import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router';
import { PageLoader } from './components/ui/misc';
import { PublicOnly, RequireAdmin, RequireAuth } from './features/auth/guards';
// Not lazy: it is the first screen of every new visitor, and small.
import LandingPage from './features/landing/LandingPage';

// Each page is loaded on first visit, keeping the initial download small. The signed-in layout
// too: its header carries the report form, which signed-out visitors never need.
const AppLayout = lazy(() =>
  import('./components/layout/AppLayout').then((module) => ({ default: module.AppLayout })),
);
const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const SignupPage = lazy(() => import('./features/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const FeedPage = lazy(() => import('./features/items/FeedPage'));
const ItemPage = lazy(() => import('./features/items/ItemPage'));
const MyItemsPage = lazy(() => import('./features/items/MyItemsPage'));
const ClaimsPage = lazy(() => import('./features/claims/ClaimsPage'));
const ClaimPage = lazy(() => import('./features/claims/ClaimPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
const AdminLayout = lazy(() => import('./features/admin/AdminLayout'));
const OverviewPage = lazy(() => import('./features/admin/OverviewPage'));
const ReportsPage = lazy(() => import('./features/admin/ReportsPage'));
const PostsPage = lazy(() => import('./features/admin/PostsPage'));
const UsersPage = lazy(() => import('./features/admin/UsersPage'));
const ActivityPage = lazy(() => import('./features/admin/ActivityPage'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnly>
              <SignupPage />
            </PublicOnly>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnly>
              <ForgotPasswordPage />
            </PublicOnly>
          }
        />

        <Route
          element={
            <RequireAuth home={<LandingPage />}>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<FeedPage />} />
          <Route path="items/:id" element={<ItemPage />} />
          <Route path="my-items" element={<MyItemsPage />} />
          <Route path="claims" element={<ClaimsPage />} />
          <Route path="claims/:id" element={<ClaimPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="posts" element={<PostsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="activity" element={<ActivityPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="font-display text-3xl font-bold text-gray-900">Page not found</p>
      <p className="mt-2 text-gray-600">The page you were looking for doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-primary hover:underline">
        Back to browsing
      </Link>
    </div>
  );
}
