import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { User } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

import { setTokenGetter } from './lib/api';
import ProtectedRoute from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { ComparePage } from './pages/Compare';
import UsageBadge from './components/UsageBadge';

const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const ResultsPage = lazy(() => import('./pages/ResultsPage').then((m) => ({ default: m.ResultsPage })));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const CoachPage = lazy(() => import('./pages/Coach'));
const ShareView = lazy(() => import('./pages/ShareView'));
const ApplicationsPage = lazy(() => import('./pages/Applications'));
const AccountPage = lazy(() => import('./pages/Account'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const UpgradeSuccessPage = lazy(() => import('./pages/UpgradeSuccessPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));

function LoadingFallback() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-14">
      <div className="h-40 animate-pulse rounded-2xl border border-line bg-surface" />
    </main>
  );
}

export function App() {
  const { getToken, isLoaded } = useAuth();
  const location = useLocation();
  const isSharePage = location.pathname.startsWith('/share');

  if (isLoaded) {
    setTokenGetter(getToken);
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-textSecondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-textPrimary">
      {!isSharePage ? (
        <header className="sticky top-0 z-50 border-b border-line bg-surface">
          <nav className="mx-auto flex h-[60px] max-w-[1280px] items-center gap-8 px-6">
            <Link to={isLoaded ? '/home' : '/'} className="flex shrink-0 items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-white shadow-card">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </span>
              <span className="text-lg font-semibold tracking-tight text-primary">TalentSense AI</span>
            </Link>
            <MainNav />
            <AuthNav />
          </nav>
        </header>
      ) : null}

      <Analytics />

      <Routes>
        {/* Public routes */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route
          path="/upgrade/success"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <UpgradeSuccessPage />
            </Suspense>
          }
        />
        <Route
          path="/pricing"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <PricingPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/share/:slug"
          element={
            <Suspense fallback={<div className="min-h-screen bg-base" />}>
              <ShareView />
            </Suspense>
          }
        />

        {/* Protected routes */}
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/" element={
          <Suspense fallback={<LoadingFallback />}>
            <LandingPage />
          </Suspense>
        } />
        <Route
          path="/compare"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <ComparePage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:analysisId"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <ResultsPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <HistoryPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <DashboardPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <CoachPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <ApplicationsPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingFallback />}>
                <AccountPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <main className="mx-auto max-w-3xl px-4 py-16">
              <h1 className="text-3xl font-bold">Page not found</h1>
              <p className="mt-3 text-textSecondary">The requested page does not exist.</p>
            </main>
          }
        />
      </Routes>
    </div>
  );
}

function MainNav() {
  const { user } = useUser();

  if (!user) return null;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-[15px] font-medium transition-colors ${isActive ? 'font-semibold text-primary' : 'text-textSecondary hover:text-primary'}`;

  return (
    <nav className="hidden lg:flex items-center gap-7">
      <NavLink to="/home" className={linkClass}>
        Analyze
      </NavLink>
      <NavLink to="/dashboard" className={linkClass} end>
        Dashboard
      </NavLink>
      <NavLink to="/compare" className={linkClass}>
        Compare Jobs
      </NavLink>
      <NavLink to="/applications" className={linkClass}>
        Applications
      </NavLink>
      <NavLink to="/coach" className={linkClass}>
        Career Coach
      </NavLink>
    </nav>
  );
}

function AuthNav() {
  const { user } = useUser();
  const { signOut } = useAuth();

  if (!user) {
    return (
      <div className="ml-auto flex items-center gap-4">
        <a href="/sign-in" className="text-sm font-medium text-textSecondary transition hover:text-textPrimary">
          Sign in
        </a>
        <a href="/sign-up" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover">
          Sign up
        </a>
      </div>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-5">
      <UsageBadge />
      <Link to="/account" className="flex items-center gap-2 transition-opacity hover:opacity-80">
        <span className="hidden text-[15px] font-medium text-textPrimary md:block">
          {user.firstName || user.emailAddresses[0]?.emailAddress}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white" aria-hidden="true">
          <User size={18} />
        </div>
      </Link>
      <Link
        to="/pricing"
        className="shrink-0 whitespace-nowrap rounded-lg bg-secondary px-3.5 py-2 text-sm font-medium text-white transition hover:opacity-90"
      >
        Upgrade
      </Link>
      <button
        onClick={() => signOut()}
        className="shrink-0 whitespace-nowrap rounded-lg border border-line px-3 py-2 text-sm text-textSecondary transition hover:bg-elevated hover:text-textPrimary"
      >
        Sign out
      </button>
    </div>
  );
}
