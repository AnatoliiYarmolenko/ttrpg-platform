const test = require('node:test');
const assert = require('node:assert/strict');

const { renderEmailTemplate } = require('../../src/services/email/email-template-renderer');

test('password reset template escapes userName and blocks javascript href', () => {
  const payload = {
    userName: '<script>alert(1)</script>',
    resetUrl: 'javascript:alert(1)',
  };

  const { html } = renderEmailTemplate('password-reset', payload);

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /href="javascript:/i);
});

test('email verification template renders escaped fallback text for invalid link', () => {
  const payload = {
    userName: 'User',
    verificationUrl: 'javascript:alert(1)',
  };

  const { html } = renderEmailTemplate('email-verification', payload);

  assert.match(html, /Посилання недоступне/);
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.doesNotMatch(html, /<p class="link-text">javascript:alert\(1\)<\/p>/);
});

