import { useQuery } from '@tanstack/react-query';

import { fetchBillingStatus } from '../lib/api';
import type { BillingStatus } from '../types';

export function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ['billing'],
    queryFn: fetchBillingStatus,
    staleTime: 60000,
  });
}
