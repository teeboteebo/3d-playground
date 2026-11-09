import { expect, test } from '@playwright/test';
import { VIEWS } from '../src/data/catalog';
import { openWith, settled } from './helpers';

for (const time of ['day', 'eve'] as const) {
  for (const view of VIEWS) {
    test(`${view.name}, ${time}`, async ({ page }) => {
      await openWith(page, { room: view.room, time });
      await settled(page);
      await page.getByRole('group', { name: 'Camera views' }).getByRole('button', { name: view.name, exact: true }).click();
      await page.waitForTimeout(100);
      await settled(page);
      await expect(page.locator('canvas.stage-canvas')).toHaveScreenshot(`${view.name}-${time}.png`.replace(/ /g, '-').toLowerCase());
    });
  }
}
