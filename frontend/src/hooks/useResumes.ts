import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createResume, deleteResume, fetchResumes } from '../lib/api';
import type { SavedResume } from '../types';

export function useResumes() {
  const { userId, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const key = ['resumes', userId];

  const { data: resumes, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => {
      console.debug('[useResumes] Fetching saved resumes');
      return fetchResumes();
    },
    enabled: isLoaded && !!userId,
  });

  const invalidate = () => {
    console.debug('[useResumes] Invalidating resumes');
    return queryClient.invalidateQueries({ queryKey: key });
  };

  const addMutation = useMutation({
    mutationFn: createResume,
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: deleteResume,
    onSuccess: invalidate,
  });

  return {
    resumes,
    isLoading,
    error,
    addResume: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    addError: addMutation.error,
    removeResume: removeMutation.mutateAsync,
    removeError: removeMutation.error,
  };
}

export type { SavedResume };
