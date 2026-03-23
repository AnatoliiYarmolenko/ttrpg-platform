const { escapeHtml, sanitizeHttpUrl } = require('../email-safety');

function buildEmailChangeTemplate({ confirmUrl, userName = 'Користувач' }) {
  const safeUserName = escapeHtml(userName);
  const safeConfirmUrl = sanitizeHttpUrl(confirmUrl);
  const confirmUrlText = safeConfirmUrl ? escapeHtml(safeConfirmUrl) : 'Посилання недоступне';
  const confirmHref = safeConfirmUrl ? escapeHtml(safeConfirmUrl) : '#';

  return {
    headerTitle: 'Підтвердження зміни Email',
    subject: '📧 Підтвердження зміни Email - TTRPG Platform',
    bodyContent: `
      <h2>Привіт, ${safeUserName}! 👋</h2>
      <p>Ви запросили зміну email адреси вашого акаунту на TTRPG Platform.</p>
      <p>Щоб підтвердити цю зміну, натисніть на кнопку нижче:</p>

      <div style="text-align: center;">
        <a href="${confirmHref}" class="btn">Підтвердити новий Email</a>
      </div>

      <div class="warning-box">
        ⚠️ <strong>Важливо:</strong> Посилання дійсне протягом 15 хвилин. Якщо ви не запитували зміну email, проігноруйте цей лист.
      </div>

      <p style="font-size: 14px; color: #666; margin-top: 30px;">Якщо кнопка не працює, скопіюйте це посилання у браузер:</p>
      <p class="link-text">${confirmUrlText}</p>
    `,
  };
}

module.exports = {
  buildEmailChangeTemplate,
};
