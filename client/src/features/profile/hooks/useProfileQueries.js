import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfileByUsername, getProfileByUserId, getMyProfile, updateProfile, uploadAvatar as uploadAvatarApi, deleteAvatar as deleteAvatarApi } from '../api/profileApi';
import { toast } from '@/stores/useToastStore';

export const useProfileByUsernameQuery = (username) => {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      const result = await getProfileByUsername(username);
      if (!result?.profile) throw new Error('Профіль не знайдено');
      return result.profile;
    },
    enabled: !!username,
    staleTime: 5 * 60 * 1000,
  });
};

export const useProfileByUserIdQuery = (userId, participants = []) => {
  return useQuery({
    queryKey: ['profile', 'id', userId],
    queryFn: async () => {
      try {
        const result = await getProfileByUserId(userId);
        if (result?.profile) return result.profile;
      } catch {
        // Fallback 1: via participant username
      }

      const participant = participants.find((p) => p.user?.id === userId);
      if (participant?.user?.username) {
        try {
          const result = await getProfileByUsername(participant.user.username);
          if (result?.profile) return result.profile;
        } catch {
          // Fallback 2: via participant object
        }
      }

      if (participant?.user) return participant.user;

      throw new Error('Не вдалося завантажити профіль');
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useMyProfileQuery = () => {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const result = await getMyProfile();
      if (!result?.profile) throw new Error('Профіль не знайдено');
      return result.profile;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useProfileMutations = () => {
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: (data) => updateProfile(data),
    onSuccess: (result) => {
      if (result.success && result.profile) {
        // Оновлюємо кеш поточного юзера та його юзернейму
        queryClient.setQueryData(['profile', 'me'], result.profile);
        queryClient.setQueryData(['profile', result.profile.username], result.profile);
      } else {
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
    }
  });

  const handleAvatarSuccess = (result, successMsg) => {
    if (result.profile) {
      queryClient.setQueryData(['profile', 'me'], result.profile);
      queryClient.setQueryData(['profile', result.profile.username], result.profile);
      toast.success(successMsg);
    } else {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  };

  const uploadAvatarMutation = useMutation({
    mutationFn: (file) => uploadAvatarApi(file),
    onSuccess: (result) => handleAvatarSuccess(result, 'Аватар успішно оновлено'),
    onError: (err) => toast.error(err.response?.data?.error || 'Помилка завантаження'),
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: () => deleteAvatarApi(),
    onSuccess: (result) => handleAvatarSuccess(result, 'Аватар видалено'),
    onError: (err) => toast.error(err.response?.data?.error || 'Помилка видалення'),
  });

  return {
    updateProfile: updateProfileMutation.mutateAsync,
    uploadAvatar: uploadAvatarMutation.mutateAsync,
    deleteAvatar: deleteAvatarMutation.mutateAsync,
    uploadAvatarStatus: uploadAvatarMutation.isPending,
    deleteAvatarStatus: deleteAvatarMutation.isPending,
  };
};
