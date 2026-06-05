import { expect, test } from '@playwright/test';

const currentUser = {
  id: 42,
  username: 'demo-player',
  email: 'demo@example.com',
  role: 'USER',
};

const persistedAuthState = JSON.stringify({
  state: { user: currentUser },
  version: 0,
});

async function captureStep(page, testInfo, stepName) {
  testInfo.attach(stepName, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((authState) => {
    localStorage.setItem('ttrpg_app_user', authState);
  }, persistedAuthState);

  await page.route('**/api/auth/csrf-token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'set-cookie': 'XSRF-TOKEN=e2e-csrf-token; Path=/; SameSite=Lax',
      },
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/profile/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profile: currentUser }),
    });
  });

  await page.route('**/api/security/account', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
});

test('allows a signed-in user to delete their account from profile security', async ({ page, baseURL }, testInfo) => {
  await test.step('Open security section', async () => {
    await page.goto(`${baseURL}/?tab=profile&section=security`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\?tab=profile&section=security/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Безпека акаунту' })).toBeVisible({ timeout: 15000 });
    await captureStep(page, testInfo, '01-security-section-opened');
  });

  await test.step('Switch to delete confirmation form', async () => {
    await page.getByRole('button', { name: 'Я розумію, продовжити видалення' }).click();
    await expect(page.getByRole('button', { name: 'Видалити назавжди' })).toBeVisible({ timeout: 10000 });
    await captureStep(page, testInfo, '02-delete-form-opened');
  });

  await test.step('Fill delete confirmation fields', async () => {
    await page.getByLabel('Ваш пароль').fill('secret-password');
    await page.getByLabel('Введіть "ВИДАЛИТИ" для підтвердження').fill('ВИДАЛИТИ');
    await expect(page.getByRole('button', { name: 'Видалити назавжди' })).toBeEnabled();
    await captureStep(page, testInfo, '03-delete-form-filled');
  });

  await test.step('Submit account deletion and verify redirect', async () => {
    const [request] = await Promise.all([
      page.waitForRequest('**/api/security/account'),
      page.getByRole('button', { name: 'Видалити назавжди' }).click(),
    ]);
    expect(request.method()).toBe('DELETE');
    expect(request.postDataJSON()).toEqual({
      password: 'secret-password',
      confirmation: 'ВИДАЛИТИ',
    });
    await expect(page).toHaveURL(/.*\/login(\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Вхід' })).toBeVisible();
    await captureStep(page, testInfo, '04-redirected-to-login');
  });
});