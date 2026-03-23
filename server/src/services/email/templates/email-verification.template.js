const { escapeHtml, sanitizeHttpUrl } = require('../email-safety');

function buildEmailVerificationTemplate({ verificationUrl, userName = 'Користувач' }) {
  const safeUserName = escapeHtml(userName);
  const safeVerificationUrl = sanitizeHttpUrl(verificationUrl);
  const verificationUrlText = safeVerificationUrl ? escapeHtml(safeVerificationUrl) : 'Посилання недоступне';
  const verificationHref = safeVerificationUrl ? escapeHtml(safeVerificationUrl) : '#';

  return {
    headerTitle: 'Підтвердження реєстрації',
    subject: '✅ Підтвердження реєстрації - TTRPG Platform',
    bodyContent: `
      <h2>Привіт, ${safeUserName}! 👋</h2>
      <p>Дякуємо за реєстрацію на TTRPG Platform! Щоб почати користуватися всіма можливостями та активувати акаунт, будь ласка, підтвердіть свою електронну адресу.</p>

      <div style="text-align: center;">
        <a href="${verificationHref}" class="btn">Підтвердити Email</a>
      </div>

      <div class="warning-box" style="background-color: #e3f2fd; border-color: #90caf9; color: #0d47a1;">
        ℹ️ <strong>Інформація:</strong> Посилання дійсне протягом 15 хвилин.
      </div>

      <p style="font-size: 14px; color: #666; margin-top: 30px;">Якщо кнопка не працює, скопіюйте це посилання у браузер:</p>
      <p class="link-text">${verificationUrlText}</p>
    `,
  };
}

module.exports = {
  buildEmailVerificationTemplate,
};
