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


  test('visible public header links have a 44px tap area', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const dimensions = await page.locator('.site-nav a:visible').evaluateAll((links) =>
      links.map((link) => ({
        text: link.textContent?.trim(),
        width: link.getBoundingClientRect().width,
        height: link.getBoundingClientRect().height,
        display: getComputedStyle(link).display,
        minHeight: getComputedStyle(link).minHeight
      }))
    );
    expect(dimensions.length).toBeGreaterThan(0);
    expect(
      dimensions.every((item) => item.height >= 44),
      JSON.stringify(dimensions)
    ).toBe(true);
  });

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

  test('login and signup controls are reachable in a visible keyboard focus order', async ({ page }) => {
    await page.goto('/login');
    const loginEmail = page.getByLabel('Email address');
    const loginPassword = page.getByLabel('Password');
    const loginSubmit = page.getByRole('button', { name: /sign in/i });

    await page.keyboard.press('Tab');
    await expect(loginEmail).toBeFocused();
    await expect.poll(() => loginEmail.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Tab');
    await expect(loginPassword).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(loginSubmit).toBeFocused();

    await page.goto('/signup');
    const signupName = page.getByLabel('Full name');
    const signupEmail = page.getByLabel('Email address');
    const signupPassword = page.getByLabel('Password');
    const signupSubmit = page.getByRole('button', { name: /create account/i });

    await page.keyboard.press('Tab');
    await expect(signupName).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(signupEmail).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(signupPassword).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(signupSubmit).toBeFocused();
  });

  const viewportRoutes = ['/', '/login', '/signup', '/privacy', '/terms'];
  const viewportWidths = [320, 375, 480, 768, 1024, 1280, 1440];

  for (const route of viewportRoutes) {
    for (const width of viewportWidths) {
      test(`${route} has no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        const dimensions = await page.evaluate(() => ({
          viewportWidth: document.documentElement.clientWidth,
          contentWidth: document.documentElement.scrollWidth
        }));
        expect(
          dimensions.contentWidth,
          `Horizontal overflow on ${route} at ${width}px: ${JSON.stringify(dimensions)}`
        ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
      });
    }
  }


  test('serves a nonce-based CSP and RFC 9116 security contact', async ({ page, request }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();

    const policy = response.headers()['content-security-policy'];
    expect(policy).toBeTruthy();
    const scriptSource = policy.split(';').find((directive) => directive.trim().startsWith('script-src'));
    expect(scriptSource).toBeTruthy();
    expect(scriptSource).toContain("'strict-dynamic'");
    expect(scriptSource).not.toContain("'unsafe-inline'");
    expect(scriptSource).not.toContain("'unsafe-eval'");
    expect(scriptSource).not.toContain('data:');

    const nonceMatch = scriptSource.match(/'nonce-([^']+)'/);
    expect(nonceMatch).not.toBeNull();
    const nonce = nonceMatch[1];
    const executableScripts = await page.locator('script').evaluateAll((scripts) =>
      scripts
        .filter((script) => !['application/json', 'application/ld+json', 'importmap'].includes(script.type))
        .map((script) => ({
          nonce: script.nonce,
          type: script.type,
          src: script.src,
          id: script.id,
          dataNscript: script.dataset.nscript,
          preview: script.textContent?.slice(0, 80)
        }))
    );
    expect(executableScripts.length).toBeGreaterThan(0);
    expect(
      executableScripts.every((script) => script.nonce === nonce),
      JSON.stringify({ nonce, executableScripts })
    ).toBe(true);
    expect(response.headers()['x-xss-protection']).toBe('0');

    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");

    const securityResponse = await request.get('/.well-known/security.txt');
    expect(securityResponse.status()).toBe(200);
    expect(securityResponse.headers()['content-type']).toContain('text/plain');
    const securityText = await securityResponse.text();
    expect(securityText).toContain('Contact: https://github.com/akashsharmapb09-cpu/coursePulse.site/security/advisories/new');
    expect(securityText).toContain('Canonical: https://coursepulse-site.vercel.app/.well-known/security.txt');
  });

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
