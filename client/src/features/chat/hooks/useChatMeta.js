import { useQuery } from '@tanstack/react-query';
import {
  getCampaignChatDescriptor,
  getSessionChatDescriptor,
} from '../api/chatApi';

export const chatMetaQueryKeys = {
  detail: ({ entityType, entityId }) => ['chat', 'meta', entityType || null, entityId || null],
};

const resolveDescriptorFetch = (entityType) => {
  if (entityType === 'campaign') {
    return getCampaignChatDescriptor;
  }

  if (entityType === 'session') {
    return getSessionChatDescriptor;
  }

  return null;
};

const isValidId = (value) => Number.isInteger(value) && value > 0;

export default function useChatMeta(entityType, entityId) {
  const fetchDescriptor = resolveDescriptorFetch(entityType);
  const enabled = Boolean(fetchDescriptor) && isValidId(entityId);

  return useQuery({
    queryKey: chatMetaQueryKeys.detail({ entityType, entityId }),
    queryFn: async () => {
      const res = await fetchDescriptor(entityId);

      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch chat descriptor');
      }

      return res.data;
    },
    enabled,
  });
}
