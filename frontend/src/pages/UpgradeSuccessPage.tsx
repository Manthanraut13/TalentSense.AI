import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

export default function UpgradeSuccessPage() {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['billing'] });
    queryClient.invalidateQueries({ queryKey: ['usage'] });
  }, [queryClient]);

  return (
    <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold">Welcome to Pro</h1>
        <p className="mt-3 text-sm text-textSecondary">
          Your billing status is being refreshed. You can now continue analyzing resumes.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          Start analyzing
        </Link>
      </div>
    </main>
  );
}
