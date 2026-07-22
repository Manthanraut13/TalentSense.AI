export default function ErrorFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-textPrimary">Something went wrong</h1>
        <p className="mt-3 text-sm text-textSecondary">
          The app hit an unexpected error. The incident can be reported automatically when monitoring is configured.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-md bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Reload page
        </button>
      </div>
    </main>
  );
}
