const { escapeHtml } = require('../email-safety');

function renderBaseTemplate(headerTitle, bodyContent) {
  const safeHeaderTitle = escapeHtml(headerTitle);

  return `
    <!DOCTYPE html>
    <html lang="uk">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.9; }
        .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
        .content h2 { margin-top: 0; color: #333; }
        .btn { display: inline-block; background-color: #5865F2; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin: 20px 0; text-align: center; }
        .btn:hover { background-color: #4752c4; }
        .warning-box { background-color: #fff8c4; border: 1px solid #e0c855; color: #755f08; padding: 15px; border-radius: 6px; font-size: 14px; margin: 20px 0; }
        .footer { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999999; border-top: 1px solid #eeeeee; }
        .security-list { margin-top: 20px; font-size: 14px; color: #555; padding-left: 20px; }
        .security-list li { margin-bottom: 8px; }
        .link-text { font-size: 12px; word-break: break-all; color: #888; margin-top: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 TTRPG Platform</h1>
          <p>${safeHeaderTitle}</p>
        </div>
        <div class="content">
          ${bodyContent}
        </div>
        <div class="footer">
          <p>&copy; 2026 TTRPG Platform. Всі права захищені.</p>
          <p>Цей лист був надісланий автоматично. Будь ласка, не відповідайте на нього.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  renderBaseTemplate,
};
