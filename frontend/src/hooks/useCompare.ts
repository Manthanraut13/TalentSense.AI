import { useMutation } from '@tanstack/react-query';
import { compareJobs } from '../lib/api';
import type { CompareResponse } from '../types';

export function useCompareMutation() {
  return useMutation<CompareResponse, unknown, { resumeText: string; jobDescriptions: string[] }>({
    mutationFn: compareJobs,
  });
}
