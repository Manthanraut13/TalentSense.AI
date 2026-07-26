import { useQuery } from '@tanstack/react-query';

import { fetchDashboardStats } from '../lib/api';
import type { DashboardStats } from '../types';

export function useDashboard() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardStats,
    staleTime: 30000,
  });
}
