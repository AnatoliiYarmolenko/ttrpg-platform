const { renderBaseTemplate } = require('./templates/base.template');
const { buildPasswordResetTemplate } = require('./templates/password-reset.template');
const { buildEmailVerificationTemplate } = require('./templates/email-verification.template');
const { buildEmailChangeTemplate } = require('./templates/email-change.template');

function renderEmailTemplate(templateType, payload) {
  if (templateType === 'password-reset') {
    const template = buildPasswordResetTemplate(payload);
    return {
      subject: template.subject,
      html: renderBaseTemplate(template.headerTitle, template.bodyContent),
    };
  }

  if (templateType === 'email-verification') {
    const template = buildEmailVerificationTemplate(payload);
    return {
      subject: template.subject,
      html: renderBaseTemplate(template.headerTitle, template.bodyContent),
    };
  }

  if (templateType === 'email-change') {
    const template = buildEmailChangeTemplate(payload);
    return {
      subject: template.subject,
      html: renderBaseTemplate(template.headerTitle, template.bodyContent),
    };
  }

  throw new Error(`Unknown email template type: ${templateType}`);
}

module.exports = {
  renderEmailTemplate,
};
