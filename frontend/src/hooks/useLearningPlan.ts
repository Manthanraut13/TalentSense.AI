import { useMutation } from '@tanstack/react-query';
import { fetchLearningPlan } from '../lib/api';
import type { LearningPlanResponse } from '../types';

export function useLearningPlan() {
  return useMutation<
    LearningPlanResponse,
    unknown,
    { skills: string[]; jobContext?: string }
  >({
    mutationFn: fetchLearningPlan,
  });
}
