import { expect, test } from '@playwright/test';
import { openWith, settled } from './helpers';

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

test.describe('physical room groups', () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', hasTouch: true });

  test('ungroups two real table picks, preserves hidden members, and restores a renamed group on reload', async ({ page }) => {
    await openWith(page, { version: 5, room: 'bedroom' });
    await settled(page);
    const canvas = page.locator('.stage-canvas');
    const check = (name: string) => page.getByRole('checkbox', { name, exact: true });
    // The two table fronts in the bedroom's default Foot of bed view.
    await canvas.click({ position: { x: 276, y: 442 } });
    await expect(check('Bedside tables')).toBeChecked();
    await page.getByRole('button', { name: 'Ungroup', exact: true }).click();
    await expect(check('Left bedside table')).toBeChecked();
    await expect(check('Right bedside table')).toBeChecked();
    await canvas.click({ position: { x: 632, y: 442 }, modifiers: ['Shift'] });
    await expect(check('Right bedside table')).not.toBeChecked();
    await page.getByRole('button', { name: 'Hide selection' }).click();
    await check('Right bedside table').check();
    await page.getByRole('button', { name: 'Group selected' }).click();
    await page.getByRole('textbox', { name: 'Group name' }).fill('Nightstands');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await page.reload();
    await settled(page);
    await canvas.click({ position: { x: 632, y: 442 } });
    await expect(check('Nightstands')).toBeChecked();
    const row = page.getByRole('listitem').filter({ has: check('Nightstands') });
    await expect(row).toContainText('Partly hidden');
    await page.getByRole('button', { name: 'Enter Nightstands' }).click();
    await expect(page.getByRole('listitem').filter({ has: check('Left bedside table') })).toContainText('Hidden');
    await expect(page.getByRole('listitem').filter({ has: check('Right bedside table') })).toContainText('Shown');
  });

  test('creates nested groups and ungroups one level using the narrow-screen list', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openWith(page, { room: 'office' });
    await page.getByRole('button', { name: /Group pieces/ }).tap();
    const mark = async (name: string) => {
      const field = page.getByRole('checkbox', { name, exact: true });
      await field.focus();
      await page.keyboard.press('Space');
      await expect(field).toBeChecked();
    };
    const rename = async (name: string) => {
      await page.getByRole('textbox', { name: 'Group name' }).fill(name);
      await page.getByRole('button', { name: 'Rename', exact: true }).click();
    };
    const group = page.getByRole('button', { name: 'Group selected' });
    await mark('Desk');
    await mark('Drawer unit');
    await group.press('Enter');
    await rename('Desk set');
    await mark('Desk chair');
    await group.tap();
    await rename('Workspace setup');
    const writes = await page.evaluateHandle(() => {
      const record = { count: 0 };
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'apartment-playground') record.count++;
        return set.call(this, key, value);
      };
      return record;
    });
    await page.getByRole('button', { name: 'Enter Workspace setup' }).click();
    await page.getByRole('button', { name: 'Enter Desk set' }).click();
    await expect(page.getByRole('checkbox', { name: 'Drawer unit', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Options for Desk', exact: true }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Desk', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('list', { name: 'Pieces and groups in Desk set' })).toBeVisible();
    await page.getByRole('button', { name: 'Leave group' }).click();
    await page.getByRole('button', { name: 'Leave group' }).click();
    expect(await writes.evaluate((r) => r.count)).toBe(0);
    const outer = page.getByRole('checkbox', { name: 'Workspace setup', exact: true });
    await outer.check();
    await page.getByRole('button', { name: 'Ungroup', exact: true }).click();
    await expect(outer).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Desk set', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(outer).toBeVisible();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(outer).toHaveCount(0);
  });

  test('picks a late-loading TV at each level without turning an orbit into a pick', async ({ page }) => {
    let loadTV!: () => void;
    const gate = new Promise<void>((resolve) => { loadTV = resolve; });
    await page.route('**/tv.glb', async (route) => { await gate; await route.continue(); });
    await openWith(page, { version: 6, room: 'living', rooms: { living: { tree: {
      root: ['media'],
      groups: { media: { name: 'Media wall', children: ['screen', 'plant'] }, screen: { name: 'TV set', children: ['tv', 'tv-bench'] } },
    } } } });
    await page.getByRole('button', { name: /Group pieces/ }).click();
    const outer = page.getByRole('checkbox', { name: 'Media wall' });
    await outer.check();
    loadTV();
    await settled(page);
    const tvEdges = { clip: { x: 402, y: 265, width: 170, height: 105 } };
    const outlined = await page.screenshot(tvEdges);
    await outer.uncheck();
    expect(outlined.equals(await page.screenshot(tvEdges))).toBe(false);
    const canvas = page.locator('.stage-canvas');
    const screen = { position: { x: 486, y: 319 } };
    await canvas.click(screen);
    await expect(outer).toBeChecked();
    await page.getByRole('button', { name: 'Enter Media wall' }).click();
    await canvas.click(screen);
    await expect(page.getByRole('checkbox', { name: 'TV set' })).toBeChecked();
    await page.getByRole('button', { name: 'Enter TV set' }).click();
    await canvas.hover(screen);
    const tooltip = page.locator('.pick-label');
    await expect(tooltip).toHaveText('Frame TV');
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveText('TV set');
    await page.getByRole('button', { name: 'Enter TV set' }).click();
    await canvas.click(screen);
    await expect(page.getByRole('heading', { name: 'Frame TV' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Group pieces' }).click();
    await expect(page.getByRole('list', { name: 'Pieces and groups in TV set' })).toBeVisible();
    await canvas.dragTo(canvas, { sourcePosition: screen.position, targetPosition: { x: 560, y: 340 } });
    await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Group pieces' })).toBeVisible();
  });
});
