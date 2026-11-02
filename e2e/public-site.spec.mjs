import { test, expect } from '@playwright/test';

const publicRoutes = [
  '/',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/cookies',
  '/refunds',
  '/login',
  '/signup',
  '/auth/reset'
];

test.describe('public-page browser smoke', () => {
  for (const route of publicRoutes) {
    test(`${route} renders successfully with a primary heading`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

      expect(response, `No document response for ${route}`).not.toBeNull();
      expect(response.status(), `Unexpected HTTP status for ${route}`).toBe(200);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    });
  }

  test('login and signup forms expose accessible labels and submit controls', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();

    await page.goto('/signup');
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeEnabled();
  });

  test('password reset form exposes both password fields and an accessible submit action', async ({ page }) => {
    await page.goto('/auth/reset');
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm new password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /update password/i })).toBeEnabled();
  });

  for (const route of ['/login', '/signup', '/privacy', '/terms']) {
    test(`${route} does not overflow a narrow mobile viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(route);
      const dimensions = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        contentWidth: document.documentElement.scrollWidth
      }));
      expect(
        dimensions.contentWidth,
        `Horizontal overflow on ${route}: ${JSON.stringify(dimensions)}`
      ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    });
  }

  test('home page has working sign-in and sign-up navigation targets', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
  });

  test('public pages do not throw uncaught browser exceptions', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    for (const route of ['/', '/about', '/contact', '/login', '/signup', '/privacy', '/terms']) {
      await page.goto(route);
    }

    expect(errors).toEqual([]);
  });
});
