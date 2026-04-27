import { expect, test } from '@playwright/test';

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'USER',
};

async function captureStep(page, testInfo, stepName) {
  testInfo.attach(stepName, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

test.beforeEach(async ({ page }) => {
  // Mock CSRF token endpoint
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

  // Mock login endpoint
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: mockUser,
        message: 'Login successful',
      }),
    });
  });

  // Mock profile endpoint for dashboard
  await page.route('**/api/profile/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profile: mockUser }),
    });
  });
});

test('login flow and protected route redirect', async ({ page, baseURL }, testInfo) => {
  await test.step('Open login page', async () => {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Вхід' })).toBeVisible();
    await captureStep(page, testInfo, '01-login-page-opened');
  });

  await test.step('Fill and submit login form', async () => {
    await page.getByPlaceholder('Email').fill('test@example.com');
    await page.getByPlaceholder('Пароль').fill('password123');
    
    const [request] = await Promise.all([
      page.waitForRequest('**/api/auth/login'),
      page.getByRole('button', { name: 'Увійти' }).click(),
    ]);
    
    expect(request.method()).toBe('POST');
    expect(request.postDataJSON()).toEqual({
      email: 'test@example.com',
      password: 'password123',
    });
    await captureStep(page, testInfo, '02-login-form-submitted');
  });

  await test.step('Verify redirect to dashboard after login', async () => {
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    await expect(page.getByText('testuser').nth(1)).toBeVisible({ timeout: 10000 });
    await captureStep(page, testInfo, '03-redirected-to-dashboard');
  });

  await test.step('Verify login page redirects authenticated user to dashboard', async () => {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    await expect(page.getByText('testuser').nth(1)).toBeVisible();
    await captureStep(page, testInfo, '04-login-page-redirects-to-dashboard');
  });
});
