import React from 'react';

/**
 * FullPageLoader — повноекранний стан завантаження.
 *
 * Використовується в DashboardPage, CampaignPage, SessionPage
 * для уніфікованого відображення стану "Завантаження...".
 *
 * @param {Object} props
 * @param {string} [props.text='Завантаження...'] — текст, що відображається
 */
export default function FullPageLoader({ text = 'Завантаження...' }) {
  return (
    <div className="min-h-screen w-full bg-[#164A41] flex flex-col items-center justify-center text-[#F1B24A] font-sans">
      <div className="w-[50px] h-[50px] rounded-full border-4 border-[#F1B24A]/30 border-t-[#F1B24A] animate-spin mb-4"></div>
      <div className="font-medium tracking-wide">{text}</div>
    </div>
  );
}
