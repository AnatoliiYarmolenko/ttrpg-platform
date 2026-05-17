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

  if (url.startsWith('http')) {
    return url;
  }

  if (import.meta.env.DEV) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const baseUrl = apiUrl.replace(/\/api$/, '');
    return `${baseUrl}${url}`;
  }

  return url;
}
