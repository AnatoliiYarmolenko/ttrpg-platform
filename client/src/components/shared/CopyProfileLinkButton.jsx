import React, { useState, useCallback } from 'react';

/**
 * CopyProfileLinkButton — кнопка "Копіювати посилання на профіль".
 * Копіює в буфер обміну URL формату /user/:username.
 */
export default function CopyProfileLinkButton({ username }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!username) return;
    const url = `${window.location.origin}/user/${username}`;
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
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [username]);

  if (!username) return null;

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-brand-light/40 text-brand-dark hover:bg-brand-light/10 transition-colors w-full justify-center"
      title="Копіювати посилання на профіль"
    >
      {copied ? (
        <>
          <span>Посилання скопійовано!</span>
        </>
      ) : (
        <>
          <span>Поділитися профілем</span>
        </>
      )}
    </button>
  );
}
