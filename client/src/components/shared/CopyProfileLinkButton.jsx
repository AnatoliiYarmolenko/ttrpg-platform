import React, { useState, useCallback } from 'react';

/**
 * CopyProfileLinkButton — кнопка "Копіювати посилання на профіль".
 * Копіює в буфер обміну URL формату /user/:username.
 */
export default function CopyProfileLinkButton({ username }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!username) return;
    const url = `${globalThis.location.origin}/user/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      // Fallback path for environments without async clipboard support.
      document.execCommand('copy');
      textarea.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [username]);

  if (!username) return null;

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-light/40 bg-white px-4 py-2 text-sm font-semibold text-brand-dark shadow-none transition-colors hover:border-brand-dark hover:bg-brand-light/15 hover:text-brand-dark hover:shadow-sm"
      title="Копіювати посилання на профіль"
    >
      <span>{copied ? 'Посилання скопійовано!' : 'Поділитися профілем'}</span>
    </button>
  );
}
