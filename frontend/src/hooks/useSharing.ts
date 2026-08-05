import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { disableSharing, enableSharing } from '../lib/api';

export function useSharing() {
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const enableMutation = useMutation({
    mutationFn: enableSharing,
    onSuccess: (data) => setShareUrl(data.share_url),
  });

  const disableMutation = useMutation({
    mutationFn: disableSharing,
    onSuccess: () => setShareUrl(null),
  });

  return {
    shareUrl,
    enableSharing: enableMutation.mutate,
    disableSharing: disableMutation.mutate,
    isEnabling: enableMutation.isPending,
    isDisabling: disableMutation.isPending,
  };
}
