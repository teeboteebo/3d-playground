import { expect, test } from '@playwright/test';
import { FLOOR_LAMPS, PENDANTS, VIEWS } from '../src/data/catalog';
import { openWith, settled } from './helpers';

/* the buttons and hint drawn over the canvas: their text antialiasing varies between runs, and they are not the scene */
const overlays = (page: import('@playwright/test').Page) => ({ mask: [page.locator('.hint, .lightbar, .viewbar')] });

for (const time of ['day', 'eve'] as const) {
  for (const view of VIEWS) {
    test(`${view.name}, ${time}`, async ({ page }) => {
      await openWith(page, { room: view.room, time });
      await settled(page);
      await page.getByRole('group', { name: 'Camera views' }).getByRole('button', { name: view.name, exact: true }).click();
      await settled(page);
      await expect(page.locator('canvas.stage-canvas')).toHaveScreenshot(`${view.name}-${time}.png`.replace(/ /g, '-').toLowerCase(), overlays(page));
    });
  }
}

/* every bedroom and living-room option changed from its default, saved in the flat pre-version-2 format under the
   old key, so the same test runs against older builds and also checks the migration */
const CUSTOM = {
  rug: 'palma', pillows: 'ink', art: 'arches', frame: 'oak', ward: 'ink', mould: 'tone', mouldF: 'off',
  mgap: 20, mcen: 160, msw: 60, pendant: 'off', accent: '#2F5D62',
  walls: { bedroom: 'linen', hall: 'stone', living: 'chalk', end: 'antique' }, hidden: ['sofa', 'plant'],
};
const customViews = [
  { room: 'bedroom', view: 'Overview' },
  { room: 'bedroom', view: 'Dresser wall' },
  { room: 'living', view: 'Living room' },
  { room: 'all', view: 'Apartment' },
];
for (const time of ['day', 'eve'] as const) {
  for (const { room, view } of customViews) {
    test(`${view}, customised, ${time}`, async ({ page }) => {
      await page.addInitScript((v) => window.localStorage.setItem('bedroom-viz', v), JSON.stringify({ ...CUSTOM, room, time }));
      await page.goto('./');
      await settled(page);
      await page.getByRole('group', { name: 'Camera views' }).getByRole('button', { name: view, exact: true }).click();
      await settled(page);
      await expect(page.locator('canvas.stage-canvas')).toHaveScreenshot(`${view}-custom-${time}.png`.replace(/ /g, '-').toLowerCase(), overlays(page));
    });
  }
}

/* each lamp room with a pendant and a floor lamp chosen, by day and lit by them in the evening */
for (const time of ['day', 'eve'] as const) {
  for (const [room, view] of [['living', 'Living room'], ['office', 'Office']] as const) {
    test(`${view}, with lamps, ${time}`, async ({ page }) => {
      await openWith(page, { room, time, [room]: { pendant: PENDANTS[1].id, floorLamp: FLOOR_LAMPS[1].id } });
      await settled(page);
      await expect(page.locator('canvas.stage-canvas')).toHaveScreenshot(`${view}-lamps-${time}.png`.replace(/ /g, '-').toLowerCase(), overlays(page));
    });
  }
}

test('selects the room clicked in the 3D view', async ({ page }) => {
  await openWith(page, { room: 'all' });
  await settled(page);
  /* the apartment view looks straight down on the living room's middle */
  const box = (await page.locator('canvas.stage-canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('heading', { name: 'Living room' })).toBeVisible();
});
