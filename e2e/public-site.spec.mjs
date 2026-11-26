import { test, expect } from '@playwright/test';

const publicRoutes = [
  '/', '/about', '/contact', '/privacy', '/terms', '/cookies', '/refunds',
  '/login', '/signup', '/auth/reset', '/admin', '/super-admin'
];

test.describe('public-page browser smoke', () => {
  for (const route of publicRoutes) {
    test(\`\${route} renders successfully with a primary heading\`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response, \`No document response for \${route}\`).not.toBeNull();
      expect(response.status(), \`Unexpected HTTP status for \${route}\`).toBe(200);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    });
  }

  test('legacy login and role routes redirect to the public workspace', async ({ page, request }) => {
    for (const route of ['/login', '/signup', '/auth/reset', '/admin', '/super-admin', '/verify']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\\/dashboard$/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    const legacyApi = await request.get('/api/admin/academic');
    expect(legacyApi.status()).toBe(410);
  });

  test('visible homepage navigation links have a 44px tap area', async ({ page }) => {
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
    expect(dimensions.every((item) => item.height >= 44), JSON.stringify(dimensions)).toBe(true);
  });

  test('legacy authentication pages do not render sign-in or signup forms', async ({ page }) => {
    for (const route of ['/login', '/signup', '/auth/reset']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\\/dashboard$/);
      await expect(page.getByLabel('Email address')).toHaveCount(0);
      await expect(page.getByLabel('Password')).toHaveCount(0);
    }
  });

  test('the homepage workspace link is reachable in a visible keyboard focus order', async ({ page }) => {
    await page.goto('/');
    const brand = page.getByRole('link', { name: 'CoursePulse' }).first();
    const howItWorks = page.getByRole('link', { name: 'How it works' });
    const workspace = page.getByRole('link', { name: /Open workspace/ }).first();
    await page.keyboard.press('Tab');
    await expect(brand).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(howItWorks).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(workspace).toBeFocused();
    await expect.poll(() => workspace.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  });

  const viewportRoutes = ['/', '/login', '/signup', '/privacy', '/terms'];
  const viewportWidths = [320, 375, 480, 768, 1024, 1280, 1440];
  for (const route of viewportRoutes) {
    for (const width of viewportWidths) {
      test(\`\${route} has no horizontal overflow at \${width}px\`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        const dimensions = await page.evaluate(() => ({
          viewportWidth: document.documentElement.clientWidth,
          contentWidth: document.documentElement.scrollWidth
        }));
        expect(dimensions.contentWidth, \`Horizontal overflow on \${route} at \${width}px: \${JSON.stringify(dimensions)}\`).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
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
    expect(securityText).toContain('Canonical: https://coursepulse-site.vercel.app/.well-known/security.txt');
    const rootSecurityResponse = await request.get('/security.txt');
    expect(rootSecurityResponse.status()).toBe(200);
    expect(rootSecurityResponse.headers()['content-type']).toContain('text/plain');
    const rootSecurityText = await rootSecurityResponse.text();
    expect(rootSecurityText).toContain('Contact: https://github.com/akashsharmapb09-cpu/coursePulse.site/security/advisories/new');
    expect(rootSecurityText).toContain('Canonical: https://coursepulse-site.vercel.app/.well-known/security.txt');
  });

  test('homepage and public content pages no longer advertise login or signup', async ({ page }) => {
    for (const route of ['/', '/about', '/features', '/contact', '/privacy', '/terms', '/support']) {
      await page.goto(route);
      await expect(page.locator('a[href="/login"]')).toHaveCount(0);
      await expect(page.locator('a[href="/signup"]')).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Open workspace/ }).first()).toBeVisible();
    }
    await page.goto('/');
    await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible();
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
