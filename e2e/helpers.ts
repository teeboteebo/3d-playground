import { expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'bedroom-viz';

/** open the app with these settings saved, as a returning visitor would have them */
export async function openWith(page: Page, settings: Record<string, unknown>) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(settings)] as const,
  );
  await page.goto('./');
}

/** wait until the camera has arrived and the furniture has loaded */
export async function settled(page: Page) {
  await expect(page.locator('canvas.stage-canvas')).toHaveAttribute('data-settled', 'true', { timeout: 60_000 });
}
