import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createApplication,
  deleteApplication,
  fetchApplications,
  updateApplication,
  updateApplicationStatus,
} from '../lib/api';
import type {
  Application,
  ApplicationStatus,
  CreateApplicationInput,
} from '../types';

export function useApplications() {
  const { userId, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const key = ['applications', userId];

  const { data: applications, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => {
      console.debug('[useApplications] Fetching applications');
      return fetchApplications();
    },
    enabled: isLoaded && !!userId,
  });

  const invalidate = () => {
    console.debug('[useApplications] Invalidating applications');
    return queryClient.invalidateQueries({ queryKey: key });
  };

  const addMutation = useMutation({
    mutationFn: createApplication,
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: ApplicationStatus; notes?: string }) =>
      updateApplicationStatus(id, { status, notes }),
    onSuccess: invalidate,
  });

  const editMutation = useMutation({
    mutationFn: ({
      id,
      ...rest
    }: {
      id: string;
      company?: string;
      role?: string;
      job_url?: string;
      notes?: string;
      applied_date?: string;
    }) => updateApplication(id, rest),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: invalidate,
  });

  return {
    applications,
    isLoading,
    error,
    addApplication: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    changeStatus: statusMutation.mutateAsync,
    editApplication: editMutation.mutateAsync,
    removeApplication: removeMutation.mutateAsync,
    removeError: removeMutation.error,
  };
}
