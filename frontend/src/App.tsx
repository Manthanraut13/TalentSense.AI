import { FileText, History } from 'lucide-react';
import { Link, Route, Routes } from 'react-router-dom';

import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { ResultsPage } from './pages/ResultsPage';

export function App() {
  return (
    <div className="min-h-screen bg-base text-textPrimary">
      <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-subtle text-primary">
              <FileText size={18} />
            </span>
            Resume Analyzer
          </Link>
          <Link
            to="/history"
            className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-textSecondary transition hover:bg-elevated hover:text-textPrimary"
          >
            <History size={16} />
            History
          </Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/results/:analysisId" element={<ResultsPage />} />
        <Route path="/history" element={<HistoryPage />} />
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
