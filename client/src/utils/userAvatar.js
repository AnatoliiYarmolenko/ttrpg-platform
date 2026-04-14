const API_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export function getInitials(name) {
  if (!name) return '??';
  const words = name.trim().split(' ').filter((word) => word.length > 0);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0][0].toUpperCase();
  return words
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function resolveAvatarUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
  return url;
}
