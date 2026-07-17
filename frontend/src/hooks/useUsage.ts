import { useQuery } from '@tanstack/react-query';
import { fetchUsage } from '../lib/api';

export interface UsageStatus {
  used: number;
  limit: number;
  remaining: number;
  is_pro: boolean;
}

export function useUsage() {
  return useQuery<UsageStatus>({
    queryKey: ['usage'],
    queryFn: fetchUsage,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}