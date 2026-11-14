import { expect, test } from '@playwright/test';
import { openWith } from './helpers';

/* CI renders WebGL in software, at a few frames a second, so these tests check the scene draws and responds
   without waiting for the camera to come to rest; the screenshot tests (local, on the GPU) cover the look. */
test.use({ viewport: { width: 800, height: 500 } });

test('loads the apartment and draws the scene without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openWith(page, {});
  await expect(page.getByRole('heading', { name: 'Apartment' })).toBeVisible();
  const canvas = page.locator('canvas.stage-canvas');
  /* the first frame: compiling the shaders takes a while in software */
  await expect(canvas).toHaveAttribute('data-settled', /true|false/, { timeout: 30_000 });
  /* a blank canvas compresses to almost nothing; a drawn room does not */
  await expect.poll(async () => (await canvas.screenshot()).length, { timeout: 30_000 }).toBeGreaterThan(20_000);
  expect(errors).toEqual([]);
});

test('selects a room from the list', async ({ page }) => {
  await openWith(page, {});
  await page.getByRole('list', { name: 'Rooms' }).getByRole('button', { name: /Living room/ }).click();
  await expect(page.getByRole('heading', { name: 'Living room' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Camera views' }).getByRole('button')).toHaveText(['Living room', 'Sofa wall']);
});
