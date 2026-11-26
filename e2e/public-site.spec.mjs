import { test, expect } from '@playwright/test';

const publicRoutes = [
  '/', '/about', '/contact', '/privacy', '/terms', '/cookies', '/refunds',
  '/login', '/signup', '/auth/reset', '/admin', '/super-admin'
];

test.describe('public-page browser smoke', () => {
  for (const route of publicRoutes) {
    test(route + ' renders successfully with a primary heading', async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response, 'No document response for ' + route).not.toBeNull();
      expect(response.status(), 'Unexpected HTTP status for ' + route).toBe(200);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    });
  }

  test('legacy login and role routes redirect to the public workspace', async ({ page, request }) => {
    for (const route of ['/auth/reset', '/admin', '/super-admin', '/verify']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    const legacyApi = await request.get('/api/admin/academic');
    expect(legacyApi.status()).toBe(410);
  });

  test('visible homepage navigation links have a 44px tap area', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.locator('.public-header-actions a[href="/login"]')).toBeVisible();
    await expect(page.locator('.public-header-actions a[href="/signup"]')).toBeVisible();
    const dimensions = await page.locator('.public-nav a:visible').evaluateAll((links) =>
      links.map((link) => ({
        text: link.textContent?.trim(),
        width: link.getBoundingClientRect().width,
        height: link.getBoundingClientRect().height,
        display: getComputedStyle(link).display,
        minHeight: getComputedStyle(link).minHeight
      }))
    );
    expect(dimensions.length).toBeGreaterThan(0);
    expect(dimensions.every((item) => item.height >= 44), JSON.stringify(dimensions)).toBe(true);
  });

  test('students can open the registration and sign-in forms', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Create your student account' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Programme / Course')).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveCount(0);
    await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
    const programmes = await page.locator('select option').allTextContents();
    for (const item of ['B.Tech', 'M.Tech', 'BBA', 'B.Com', 'Other']) expect(programmes).toContain(item);
    expect(programmes.join(' ')).not.toMatch(/admin|hod/i);

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveCount(0);
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  });

  test('the homepage workspace link is reachable in a visible keyboard focus order', async ({ page }) => {
    await page.goto('/');
    await page.locator('.public-header-actions a[href="/login"]').waitFor();
    const brand = page.locator('header a').first();
    const howItWorks = page.getByRole('link', { name: 'How it works' });
    const features = page.locator('.public-nav a[href="/features"]');
    const about = page.locator('.public-nav a[href="/about"]');
    const privacy = page.locator('.public-nav a[href="/privacy"]');
    const cookies = page.locator('.public-nav a[href="/cookies"]');
    const contact = page.locator('.public-nav a[href="/contact"]');
    const signin = page.locator('.public-header-actions a[href="/login"]');
    const createAccount = page.locator('.public-header-actions a[href="/signup"]');
    const workspace = page.getByRole('link', { name: /Open workspace/ }).first();
    await page.keyboard.press('Tab');
    await expect(brand).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(howItWorks).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(features).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(about).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(privacy).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cookies).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(contact).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(signin).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(createAccount).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(workspace).toBeFocused();
    await expect.poll(() => workspace.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  });

  const viewportRoutes = ['/', '/login', '/signup', '/privacy', '/terms'];
  const viewportWidths = [320, 375, 480, 768, 1024, 1280, 1440];
  for (const route of viewportRoutes) {
    for (const width of viewportWidths) {
      test(route + ' has no horizontal overflow at ' + width + 'px', async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        const dimensions = await page.evaluate(() => ({
          viewportWidth: document.documentElement.clientWidth,
          contentWidth: document.documentElement.scrollWidth
        }));
        expect(dimensions.contentWidth, 'Horizontal overflow on ' + route + ' at ' + width + 'px: ' + JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
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
      scripts.filter((script) => !['application/json', 'application/ld+json', 'importmap'].includes(script.type))
        .map((script) => ({ nonce: script.nonce, type: script.type, src: script.src, id: script.id, dataNscript: script.dataset.nscript, preview: script.textContent?.slice(0, 80) }))
    );
    expect(executableScripts.length).toBeGreaterThan(0);
    expect(executableScripts.every((script) => script.nonce === nonce), JSON.stringify({ nonce, executableScripts })).toBe(true);
    expect(response.headers()['x-xss-protection']).toBe('0');
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");

    const securityResponse = await request.get('/.well-known/security.txt');
    expect(securityResponse.status()).toBe(200);
    expect(securityResponse.headers()['content-type']).toContain('text/plain');
    const securityText = await securityResponse.text();
    expect(securityText).toContain('Contact: https://github.com/akashsharmapb09-cpu/coursePulse.site/security/advisories/new');
    expect(securityText).toContain('Canonical: https://coursepulse.netlify.app/.well-known/security.txt');
    const rootSecurityResponse = await request.get('/security.txt');
    expect(rootSecurityResponse.status()).toBe(200);
    expect(rootSecurityResponse.headers()['content-type']).toContain('text/plain');
    const rootSecurityText = await rootSecurityResponse.text();
    expect(rootSecurityText).toContain('Contact: https://github.com/akashsharmapb09-cpu/coursePulse.site/security/advisories/new');
    expect(rootSecurityText).toContain('Canonical: https://coursepulse.netlify.app/.well-known/security.txt');
  });

  test('homepage and public information pages advertise student accounts', async ({ page }) => {
    for (const route of ['/', '/about', '/privacy', '/cookies', '/terms']) {
      await page.goto(route);
      await expect(page.locator('a[href="/login"]').first()).toBeVisible();
      await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Open workspace/ }).first()).toBeVisible();
    }
    await page.goto('/');
    await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible();
  });

  test('home footer exposes About, Privacy Policy and Cookie Policy', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer a[href="/about"]')).toBeVisible();
    await expect(page.locator('footer a[href="/privacy"]')).toBeVisible();
    await expect(page.locator('footer a[href="/cookies"]')).toBeVisible();
    await expect(page.locator('footer').getByRole('button', { name: 'Cookie settings' })).toBeVisible();
  });

  test('public-facing pages no longer describe CoursePulse as a project', async ({ page }) => {
    for (const route of ['/', '/about', '/features', '/contact', '/privacy', '/terms', '/cookies', '/support', '/refunds', '/dashboard', '/feedback/thank-you']) {
      await page.goto(route);
      await expect(page.locator('body')).not.toContainText(/\\bproject\\b/i);
    }
  });

  test('public pages do not throw uncaught browser exceptions', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['/', '/about', '/contact', '/login', '/signup', '/privacy', '/terms']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    }
    expect(errors).toEqual([]);
  });
});
