const { escapeHtml, sanitizeHttpUrl } = require('../email-safety');

function buildPasswordResetTemplate({ resetUrl, userName = 'Користувач' }) {
  const safeUserName = escapeHtml(userName);
  const safeResetUrl = sanitizeHttpUrl(resetUrl);
  const resetUrlText = safeResetUrl ? escapeHtml(safeResetUrl) : 'Посилання недоступне';
  const resetHref = safeResetUrl ? escapeHtml(safeResetUrl) : '#';

  return {
    headerTitle: 'Скидання пароля',
    subject: '🔐 Скидання пароля - TTRPG Platform',
    bodyContent: `
      <h2>Привіт, ${safeUserName}! 👋</h2>
      <p>Ми отримали запит на скидання пароля для вашого акаунту. Якщо це не ви, просто ігноруйте цей лист.</p>
      <p>Щоб встановити новий пароль, натисніть на кнопку нижче:</p>

      <div style="text-align: center;">
        <a href="${resetHref}" class="btn">Скинути пароль</a>
      </div>

      <div class="warning-box">
        ⚠️ <strong>Важливо:</strong> Це посилання дійсне тільки 1 годину. Якщо ви не скидаєте пароль протягом цього часу, запросіть нове посилання.
      </div>

      <p><strong>Безпека вашого акаунту:</strong></p>
      <ul class="security-list">
        <li>Ніколи не діліться цим посиланням з іншими</li>
        <li>TTRPG Staff ніколи не буде просити вас клікати на підозрілі посилання</li>
        <li>Переконайтеся, що ви на сайті ttrpg.local перед введенням пароля</li>
      </ul>

      <p style="font-size: 14px; color: #666; margin-top: 30px;">Якщо кнопка не працює, скопіюйте це посилання у браузер:</p>
      <p class="link-text">${resetUrlText}</p>
    `,
  };
}

module.exports = {
  buildPasswordResetTemplate,
};
