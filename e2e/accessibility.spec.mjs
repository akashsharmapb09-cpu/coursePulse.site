import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';

const require = createRequire(import.meta.url);
const axeScript = require.resolve('axe-core/axe.min.js');
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const routes = ['/', '/about', '/contact', '/privacy', '/terms', '/cookies', '/refunds', '/login', '/signup', '/auth/reset'];

test.describe('automated WCAG A/AA accessibility checks', () => {
  for (const route of routes) {
    test(`${route} has no automated WCAG A/AA violations`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ path: axeScript });

      const results = await page.evaluate(async (tags) => {
        return window.axe.run(document, {
          runOnly: { type: 'tag', values: tags }
        });
      }, wcagTags);

      const violations = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary
        }))
      }));

      if (violations.length) {
        console.error(`Accessibility violations on ${route}: ${JSON.stringify(violations, null, 2)}`);
      }

      expect(violations, `WCAG violations on ${route}`).toEqual([]);
    });
  }
});
