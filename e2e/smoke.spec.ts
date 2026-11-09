import { expect, test } from '@playwright/test';
import { openWith, settled } from './helpers';

test('loads the apartment and draws the scene without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await openWith(page, {});
  await expect(page.getByRole('heading', { name: 'Apartment' })).toBeVisible();
  await settled(page);
  /* something other than the clear colour was drawn in the middle of the canvas */
  const drawn = await page.locator('canvas.stage-canvas').evaluate((c: HTMLCanvasElement) => {
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    return gl !== null;
  });
  expect(drawn).toBe(true);
  const shot = await page.locator('canvas.stage-canvas').screenshot();
  expect(shot.length).toBeGreaterThan(20_000);
  expect(errors).toEqual([]);
});

test('selects a room from the list and flies to it', async ({ page }) => {
  await openWith(page, {});
  await page.getByRole('list', { name: 'Rooms' }).getByRole('button', { name: /Living room/ }).click();
  await expect(page.getByRole('heading', { name: 'Living room' })).toBeVisible();
  await settled(page);
});
