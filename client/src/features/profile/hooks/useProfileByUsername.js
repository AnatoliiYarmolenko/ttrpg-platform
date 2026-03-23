import { useProfileByUsernameQuery } from './useProfileQueries';

/**
 * Завантажує публічний профіль за username.
 *
 * @param {string|undefined} username
 * @returns {{ profile: import('../profileModel').ProfileShape|null, isLoading: boolean, error: string|null }}
 */
export function useProfileByUsername(username) {
  const { data: profile, isLoading, error } = useProfileByUsernameQuery(username);

  return { 
    profile: profile || null, 
    isLoading, 
    error: error?.message || null 
  };
}
