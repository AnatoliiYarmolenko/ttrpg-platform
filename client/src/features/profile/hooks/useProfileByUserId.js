import { useProfileByUserIdQuery } from './useProfileQueries';

/**
 * Завантажує публічний профіль за userId.
 *
 * @param {number|null|undefined} userId
 * @param {{ participants?: Array }} [options]
 * @returns {{ profile: import('../profileModel').ProfileShape|null, isLoading: boolean, error: string|null }}
 */
export function useProfileByUserId(userId, { participants = [] } = {}) {
  const { data: profile, isLoading, error } = useProfileByUserIdQuery(userId, participants);

  return { 
    profile: profile || null, 
    isLoading, 
    error: error?.message || null 
  };
}
