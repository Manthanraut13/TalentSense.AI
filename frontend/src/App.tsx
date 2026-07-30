import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { setTokenGetter } from './lib/api';
import ProtectedRoute from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import UsageBadge from './components/UsageBadge';

const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const ResultsPage = lazy(() => import('./pages/ResultsPage').then((m) => ({ default: m.ResultsPage })));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));

function LoadingFallback() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-14">
      <div className="h-40 animate-pulse rounded-lg bg-surface" />
    </main>
  );
}

export function App() {
  const { getToken, isLoaded } = useAuth();

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
      <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-subtle text-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </span>
            Resume Analyzer
          </a>
          <AuthNav />
        </nav>
      </header>

      <Routes>
        {/* Public routes */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />

        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
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

function AuthNav() {
  const { user } = useUser();
  const { signOut } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <a href="/sign-in" className="text-sm text-textSecondary hover:text-textPrimary">
          Sign in
        </a>
        <a href="/sign-up" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover">
          Sign up
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link to="/dashboard" className="text-sm text-textSecondary transition hover:text-primary">
        Dashboard
      </Link>
      <UsageBadge />
      <span className="text-sm text-textSecondary hidden md:block">
        {user.firstName || user.emailAddresses[0]?.emailAddress}
      </span>
      <button
        onClick={() => signOut()}
        className="rounded-md border border-line px-3 py-2 text-sm text-textSecondary hover:bg-elevated hover:text-textPrimary transition"
      >
        Sign out
      </button>
    </div>
  );
}
