import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import FullPageLoader from '@/components/shared/FullPageLoader';
import { resolveInviteCode } from '../api/campaignApi';
import { toast } from '@/stores/useToastStore';

export default function CampaignInviteJoinPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const executeJoin = async () => {
      if (!inviteCode) {
        toast.error('Невірний invite-код');
        navigate('/', { replace: true });
        return;
      }

      try {
        const result = await resolveInviteCode(inviteCode);

        if (!result?.success) {
          throw new Error(result?.error || 'Не вдалося відкрити кампанію за invite-кодом');
        }

        const campaignId = result?.data?.campaignId;

        if (!campaignId) {
          throw new Error('Не вдалося визначити кампанію для переходу');
        }

        navigate(`/campaign/${campaignId}?inviteCode=${encodeURIComponent(inviteCode)}`, { replace: true });
      } catch (error) {
        const message = error?.response?.data?.error || error?.message || 'Не вдалося відкрити invite-посилання';
        toast.error(message);
        navigate('/', { replace: true });
      }
    };

    executeJoin();
  }, [inviteCode, navigate]);

  return <FullPageLoader text="Обробляємо invite-посилання..." />;
}
