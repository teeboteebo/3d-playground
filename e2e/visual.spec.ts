import { expect, test } from '@playwright/test';
import { FLOOR_LAMPS, PENDANTS, VIEWS } from '../src/data/catalog';
import { BEMZ_FABRICS } from '../src/data/bemzFabrics';
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

/* the sofa in a Bemz fabric: a pattern (its swatch photo is routed to a generated test weave, so nothing leaves
   the machine) and a plain weave (drawn from its colour; the route only catches an accidental request) */
const pinned = (code: string) => {
  const f = BEMZ_FABRICS.find((x) => x.code === code);
  if (!f) {
    throw new Error(`The Bemz fabric ${code} is no longer in BEMZ_FABRICS; pin another one and regenerate the baselines`);
  }
  return f;
};
const patternFabric = pinned('SAS101');
const plainFabric = pinned('OT190');
for (const time of ['day', 'eve'] as const) {
  for (const [label, file, fabric] of [
    ['a Bemz fabric', 'fabric', patternFabric],
    ['a plain Bemz fabric', 'fabric-plain', plainFabric],
  ] as const) {
    test(`Living room, with ${label}, ${time}`, async ({ page }) => {
      await page.route('https://image.bemz.com/**', (r) =>
        r.fulfill({
          path: 'e2e/fixtures/fabric.png',
          contentType: 'image/png',
          headers: { 'access-control-allow-origin': '*' },
        }));
      await openWith(page, { room: 'living', time, living: { sofaFabric: fabric.code } });
      await settled(page);
      await expect(page.locator('canvas.stage-canvas')).toHaveScreenshot(`living-room-${file}-${time}.png`, overlays(page));
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

/* the bedroom's shopping list on a phone, for a bed wall bought from two lengths: it has to read well in the store */
test('shopping list, on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const lengths = [{ length: 240, price: 89 }, { length: 300, price: 109 }];
  await openWith(page, { room: 'bedroom', bedroom: { mouldDresserWall: 'off' }, mouldShop: { panel: { lengths } } });
  await page.locator('[data-topic="moulding"]').click();
  await page.locator('[data-topic="shopping"]').click();
  await expect(page.getByTestId('shop-total')).toBeVisible({ timeout: 30_000 });
  /* the 3D view sticks over the top of the page on a phone: mask it, so the picture is the list alone */
  await expect(page.getByTestId('shopping-list')).toHaveScreenshot('shopping-list-phone.png', { mask: [page.locator('canvas.stage-canvas, .hint, .lightbar, .viewbar')] });
});
