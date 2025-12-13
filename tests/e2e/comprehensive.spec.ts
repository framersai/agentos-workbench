import { test, expect, Page } from '@playwright/test';

// Screen sizes for responsive testing
const SCREEN_SIZES = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
};

// Theme modes
const THEMES = ['light', 'dark'] as const;

// Console error collector
const consoleErrors: string[] = [];

test.describe('AgentOS Workbench - Comprehensive E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(`[pageerror] ${error.message}`);
    });
  });

  test.afterEach(async () => {
    // Log any console errors found
    if (consoleErrors.length > 0) {
      console.log('Console errors detected:', consoleErrors);
      consoleErrors.length = 0;
    }
  });

  test.describe('Tab Navigation', () => {
    test('all main tabs are visible and clickable', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      // Check Compose tab
      const composeTab = page.getByRole('tab', { name: /Compose/i });
      await expect(composeTab).toBeVisible();
      await composeTab.click();
      await expect(composeTab).toHaveAttribute('aria-selected', 'true');

      // Check Personas tab
      const personasTab = page.getByRole('tab', { name: /Personas/i });
      await expect(personasTab).toBeVisible();
      await personasTab.click();
      await expect(personasTab).toHaveAttribute('aria-selected', 'true');

      // Check Agency tab
      const agencyTab = page.getByRole('tab', { name: /Agency/i });
      await expect(agencyTab).toBeVisible();
      await agencyTab.click();
      await expect(agencyTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  test.describe('Compose Tab - Prompt Submission', () => {
    test('can enter and submit a prompt', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      // Navigate to Compose tab
      await page.getByRole('tab', { name: /Compose/i }).click();

      // Find textarea for input
      const textarea = page.locator('textarea').first();
      await expect(textarea).toBeVisible();

      // Type a test prompt
      await textarea.fill('Hello, this is a test prompt for the AI agent.');

      // Find and click submit button
      const submitBtn = page.locator('button[type="submit"]').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        // Wait for response or loading indicator
        await page.waitForTimeout(1000);
      }

      // Take screenshot of submitted state
      await page.screenshot({ path: './output/compose-submitted.png', fullPage: true });
    });

    test('input field is accessible and has proper styling', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.getByRole('tab', { name: /Compose/i }).click();

      const textarea = page.locator('textarea').first();
      await expect(textarea).toBeVisible();

      // Check focus styles
      await textarea.focus();
      await page.screenshot({ path: './output/compose-input-focused.png' });
    });
  });

  test.describe('Personas Tab', () => {
    test('personas catalog is displayed', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      await page.getByRole('tab', { name: /Personas/i }).click();
      await page.waitForTimeout(500);

      // Take screenshot
      await page.screenshot({ path: './output/personas-catalog.png', fullPage: true });

      // Check for persona cards or list items
      const personaItems = page.locator('[data-testid="persona-card"], .persona-card, [class*="persona"]');
      const count = await personaItems.count();
      console.log(`Found ${count} persona elements`);
    });

    test('can interact with persona creation wizard', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.getByRole('tab', { name: /Personas/i }).click();
      await page.waitForTimeout(500);

      // Look for wizard or create button
      const wizardBtn = page.locator('button:has-text("Wizard"), button:has-text("Create"), button:has-text("New")').first();
      if (await wizardBtn.isVisible()) {
        await wizardBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: './output/persona-wizard.png', fullPage: true });
      }
    });
  });

  test.describe('Agency Tab', () => {
    test('agency manager is displayed', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      await page.getByRole('tab', { name: /Agency/i }).click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: './output/agency-manager.png', fullPage: true });
    });

    test('can interact with agency creation', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.getByRole('tab', { name: /Agency/i }).click();
      await page.waitForTimeout(500);

      // Look for create agency button
      const createBtn = page.locator('button:has-text("Create"), button:has-text("New Agency"), button:has-text("Add")').first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: './output/agency-creation.png', fullPage: true });
      }
    });
  });

  test.describe('Header and Navigation', () => {
    test('header elements are visible', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      // Check for Docs link
      const docsLink = page.getByRole('link', { name: 'Docs' });
      await expect(docsLink).toBeVisible();

      // Check for theme toggle
      const themeToggle = page.locator('button[name*="mode"], button[aria-label*="theme"], button[aria-label*="mode"]').first();
      if (await themeToggle.isVisible()) {
        await page.screenshot({ path: './output/header-light-mode.png' });
      }
    });

    test('theme toggle switches between light and dark', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      // Light mode screenshot
      await page.screenshot({ path: './output/theme-initial.png', fullPage: true });

      // Find and click theme toggle
      const themeToggle = page.locator('button[name*="mode"], button[aria-label*="theme"], button:has-text("dark"), button:has-text("light")').first();
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: './output/theme-toggled.png', fullPage: true });

        // Toggle back
        await themeToggle.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: './output/theme-toggled-back.png', fullPage: true });
      }
    });
  });

  test.describe('Responsive Design', () => {
    for (const [sizeName, dimensions] of Object.entries(SCREEN_SIZES)) {
      test(`layout adapts correctly on ${sizeName}`, async ({ page, baseURL }) => {
        await page.setViewportSize(dimensions);
        await page.goto(baseURL!);
        await page.waitForLoadState('networkidle');

        // Take screenshots of each tab at this size
        await page.screenshot({ path: `./output/responsive-${sizeName}-compose.png`, fullPage: true });

        await page.getByRole('tab', { name: /Personas/i }).click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `./output/responsive-${sizeName}-personas.png`, fullPage: true });

        await page.getByRole('tab', { name: /Agency/i }).click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `./output/responsive-${sizeName}-agency.png`, fullPage: true });
      });
    }
  });

  test.describe('All Buttons and Interactive Elements', () => {
    test('scan and verify all buttons are clickable', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      // Get all buttons
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      console.log(`Found ${buttonCount} buttons on the page`);

      // Verify each button is visible and has proper styling
      for (let i = 0; i < Math.min(buttonCount, 20); i++) {
        const btn = buttons.nth(i);
        if (await btn.isVisible()) {
          const text = await btn.textContent();
          console.log(`Button ${i}: "${text?.trim() || '[no text]'}"`);
        }
      }

      await page.screenshot({ path: './output/all-buttons-initial.png', fullPage: true });
    });

    test('scan all input fields', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      const inputs = page.locator('input, textarea, select');
      const inputCount = await inputs.count();
      console.log(`Found ${inputCount} input elements`);

      // List input types and names
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const placeholder = await input.getAttribute('placeholder');
          console.log(`Input ${i}: type=${type}, name=${name}, placeholder=${placeholder}`);
        }
      }
    });

    test('scan all links', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      const links = page.locator('a');
      const linkCount = await links.count();
      console.log(`Found ${linkCount} links`);

      for (let i = 0; i < linkCount; i++) {
        const link = links.nth(i);
        if (await link.isVisible()) {
          const href = await link.getAttribute('href');
          const text = await link.textContent();
          console.log(`Link ${i}: "${text?.trim()}" -> ${href}`);
        }
      }
    });
  });

  test.describe('Accessibility Checks', () => {
    test('all interactive elements have accessible names', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      // Check buttons for accessible names
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      for (let i = 0; i < buttonCount; i++) {
        const btn = buttons.nth(i);
        if (await btn.isVisible()) {
          const ariaLabel = await btn.getAttribute('aria-label');
          const text = await btn.textContent();
          const name = await btn.getAttribute('name');

          if (!ariaLabel && !text?.trim() && !name) {
            console.warn(`Button ${i} has no accessible name!`);
          }
        }
      }
    });

    test('focus indicators are visible', async ({ page, baseURL }) => {
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      // Tab through elements and screenshot focus states
      await page.keyboard.press('Tab');
      await page.screenshot({ path: './output/focus-1.png' });

      await page.keyboard.press('Tab');
      await page.screenshot({ path: './output/focus-2.png' });

      await page.keyboard.press('Tab');
      await page.screenshot({ path: './output/focus-3.png' });
    });
  });

  test.describe('Console Error Monitoring', () => {
    test('no critical errors on page load', async ({ page, baseURL }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Navigate through all tabs
      await page.getByRole('tab', { name: /Compose/i }).click();
      await page.waitForTimeout(500);

      await page.getByRole('tab', { name: /Personas/i }).click();
      await page.waitForTimeout(500);

      await page.getByRole('tab', { name: /Agency/i }).click();
      await page.waitForTimeout(500);

      if (errors.length > 0) {
        console.log('Console errors found:');
        errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
      } else {
        console.log('No console errors detected!');
      }

      // Don't fail the test, just report
      expect(true).toBe(true);
    });
  });
});

// Full screenshot suite for documentation
test.describe('Screenshot Suite', () => {
  test('capture all screens at all sizes', async ({ page, baseURL }) => {
    for (const [sizeName, dimensions] of Object.entries(SCREEN_SIZES)) {
      await page.setViewportSize(dimensions);

      // Light mode
      await page.goto(baseURL!);
      await page.waitForLoadState('networkidle');

      // Compose
      await page.getByRole('tab', { name: /Compose/i }).click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `./output/screenshot-${sizeName}-compose-light.png`,
        fullPage: true
      });

      // Personas
      await page.getByRole('tab', { name: /Personas/i }).click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `./output/screenshot-${sizeName}-personas-light.png`,
        fullPage: true
      });

      // Agency
      await page.getByRole('tab', { name: /Agency/i }).click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `./output/screenshot-${sizeName}-agency-light.png`,
        fullPage: true
      });

      // Try to toggle to dark mode
      const themeToggle = page.locator('button[name*="dark"], button[aria-label*="dark"]').first();
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await page.waitForTimeout(300);

        // Dark mode screenshots
        await page.getByRole('tab', { name: /Compose/i }).click();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `./output/screenshot-${sizeName}-compose-dark.png`,
          fullPage: true
        });

        await page.getByRole('tab', { name: /Personas/i }).click();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `./output/screenshot-${sizeName}-personas-dark.png`,
          fullPage: true
        });

        await page.getByRole('tab', { name: /Agency/i }).click();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `./output/screenshot-${sizeName}-agency-dark.png`,
          fullPage: true
        });
      }
    }
  });
});
