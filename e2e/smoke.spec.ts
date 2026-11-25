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

  test.describe('room placement', () => {
    test('previews a wall group without saving, drops it once, then reads the saved location in the plan', async ({ page }) => {
      await openWith(page, { version: 6, room: 'bedroom' });
      await settled(page);
      const views = page.getByRole('combobox', { name: 'Planogram' });
      const pair = () => page.evaluate(() => {
        const c = JSON.parse(localStorage.getItem('apartment-playground')!).rooms.bedroom.components;
        return ['left','right'].map((side) => c[`bedside-table-${side}`].pose ?? null) as ({ x: number; y: number; z: number } | null)[];
      });
      await views.selectOption('top');
      const table = () => page.locator('.room-plan__map polygon[aria-label$="Left bedside table"]');
      const before = await table().getAttribute('points');
      await views.selectOption({ label: 'Wall 1' });
      const elevationBefore = await table().getAttribute('points');
      await views.selectOption('3d');
      await page.mouse.click(276,442);
      await expect(page.getByRole('checkbox', { name: 'Bedside tables' })).toBeChecked();
      const guides = page.locator('.move-guides');
      const drag = async () => {
        await page.mouse.move(276,442);
        await page.mouse.down();
        await page.mouse.move(278,442);
        await expect(guides).toHaveCount(0);
        await page.mouse.move(300,425,{ steps: 5 });
        await expect(page.locator('.move-status')).toContainText('Release to place Bedside tables');
        await expect(guides).toContainText('Along wall');
        await expect(guides).toContainText('Down to floor');
        await expect(page.getByRole('button', { name: 'Foot of bed' })).toHaveAttribute('aria-pressed', 'true');
      };
      await drag();
      expect(await pair()).toEqual([null,null]);
      await page.keyboard.press('Escape');
      await expect(guides).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Room clearances' })).toHaveCount(0);
      await page.mouse.up();
      await expect(page.locator('.move-status')).toHaveText('Move cancelled.');
      expect(await pair()).toEqual([null,null]);
      await drag();
      await page.mouse.up();
      await expect(page.locator('.move-status')).toContainText('Moved Bedside tables.');
      await expect(guides).toHaveCount(0);
      const [left,right] = await pair();
      expect(left).not.toBeNull();
      expect(right).toEqual(left);
      expect(left!.y).toBeGreaterThan(0);
      expect(left!.z).toBe(0);
      await views.selectOption('top');
      await expect(table()).not.toHaveAttribute('points', before!);
      const after = await table().getAttribute('points');
      const minX = (str: string) => Math.min(...str.split(' ').map((p) => Number(p.split(',')[0])));
      expect(minX(after!) - minX(before!)).toBeCloseTo(left!.x, 5);
      await views.selectOption({ label: 'Wall 1' });
      const elevationAfter = await table().getAttribute('points');
      const minY = (str: string) => Math.min(...str.split(' ').map((p) => Number(p.split(',')[1])));
      expect(minY(elevationBefore!) - minY(elevationAfter!)).toBeCloseTo(left!.y, 5);
      await expect(table()).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(table()).toHaveAttribute('points', elevationBefore!);
      await views.selectOption('top');
      await expect(table()).toHaveAttribute('points', before!);
      expect(await pair()).toEqual([null,null]);
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await page.reload();
      await settled(page);
      await views.selectOption('top');
      await expect(table()).toHaveAttribute('points', after!);
      await table().click({ force: true });
      expect(await pair()).toEqual([left,right]);
    });

    test('keeps a floor drag level, rejects an invalid drop, and supports precise wall changes', async ({ page }) => {
      await openWith(page, { version: 6, room: 'bedroom' });
      await settled(page);
      const topic = (name: string) => page.locator('button.topic').filter({ has: page.getByText(name, { exact: true }) });
      await topic('Bench').click();
      await expect(page.getByRole('heading', { name: 'Bench', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Room clearances' })).toHaveCount(0);
      const current = () => page.evaluate(() => JSON.parse(localStorage.getItem('apartment-playground')!).rooms.bedroom.components);
      await page.mouse.move(470,600);
      await page.mouse.down();
      await page.mouse.move(492,610,{ steps: 3 });
      await expect(page.locator('.move-status')).toContainText('Release to place Bench');
      await expect(page.locator('.move-guides')).toContainText('X to wall');
      await expect(page.locator('.move-guides')).toContainText('Z to wall');
      await page.mouse.up();
      const saved = (await current()).bench.pose;
      expect(saved.x).not.toBe(0);
      expect(saved.y).toBe(0);
      await page.mouse.move(492,610);
      await page.mouse.down();
      await page.mouse.move(945,500,{ steps: 4 });
      await page.mouse.up();
      await expect(page.locator('.move-status')).toContainText('Not moved.');
      expect((await current()).bench.pose).toEqual(saved);
      await expect(page.locator('.move-guides')).toHaveCount(0);
      await page.getByRole('button', { name: 'Back to Bedroom' }).click();
      await topic('Ceiling light').click();
      await expect(page.locator('.move-panel')).toContainText('Ceiling light is fixed to the ceiling.');
      await page.getByRole('button', { name: 'Back to Bedroom' }).click();
      await topic('Painting').click();
      await page.getByLabel('Mounting wall').selectOption('1');
      expect((await current()).painting.pose).toBeUndefined();
      await page.getByRole('button', { name: 'Change wall', exact: true }).click();
      expect((await current()).painting.pose).toMatchObject({ support: { kind: 'wall', edge: 1 } });
      await page.getByRole('button', { name: 'Raise', exact: true }).press('Enter');
      expect((await current()).painting.pose.y).toBeCloseTo(0.05);
    });

    test('drags a bench from floor to wall and back, restores its support on undo and reload', async ({ page }) => {
      await openWith(page, { version: 6, room: 'bedroom' });
      await settled(page);
      const selectBench = () => page.locator('button.topic').filter({ has: page.getByText('Bench', { exact: true }) }).click();
      const pose = () => page.evaluate(() => JSON.parse(localStorage.getItem('apartment-playground')!).rooms.bedroom.components.bench.pose);
      const drag = async (x: number, y: number, toX: number, toY: number) => {
        await page.mouse.move(x,y);
        await page.mouse.down();
        await page.mouse.move(toX,toY,{ steps: 8 });
      };
      await selectBench();
      await drag(470,600,350,300);
      await expect(page.locator('.move-status')).toContainText('on Wall 1');
      expect(await pose()).toBeUndefined();
      await page.mouse.up();
      const mounted = await pose();
      expect(mounted.support).toEqual({ kind: 'wall', edge: 0 });
      expect(mounted.y).toBeGreaterThan(0);
      await drag(350,300,470,600);
      await expect(page.locator('.move-status')).toContainText('on floor');
      await page.keyboard.press('Escape');
      await page.mouse.up();
      expect(await pose()).toEqual(mounted);
      await drag(350,300,470,600);
      await page.mouse.up();
      expect((await pose()).support).toEqual({ kind: 'floor' });
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      expect(await pose()).toEqual(mounted);
      await page.reload();
      await settled(page);
      await selectBench();
      await expect(page.getByRole('button', { name: 'Raise', exact: true })).toBeVisible();
      await page.getByRole('combobox', { name: 'Planogram' }).selectOption({ label: 'Wall 1' });
      await expect(page.getByRole('button', { name: '5. Bench' })).toHaveAttribute('aria-pressed', 'true');
      expect(await pose()).toEqual(mounted);
    });

    test('hands a touch drag to pinch zoom without placing the piece', async ({ page }) => {
      await openWith(page, { version: 6, room: 'bedroom' });
      await settled(page);
      await page.touchscreen.tap(470, 600);
      await expect(page.getByRole('heading', { name: 'Bench', exact: true })).toBeVisible();
      const cdp = await page.context().newCDPSession(page);
      const finger = (id: number, x: number, y: number) => ({ id, x, y });
      const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', ...touchPoints: ReturnType<typeof finger>[]) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
      await touch('touchStart', finger(1, 470, 600));
      await touch('touchMove', finger(1, 492, 610));
      await expect(page.locator('.move-guides')).toBeVisible();
      await touch('touchStart', finger(1, 492, 610), finger(2, 535, 610));
      await expect(page.locator('.move-guides')).toHaveCount(0);
      await touch('touchMove', finger(1, 482, 610), finger(2, 565, 610));
      await touch('touchEnd');
      await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('apartment-playground')!).rooms.bedroom.components.bench.pose)).toBeUndefined();
      await page.getByRole('combobox', { name: 'Planogram' }).selectOption('top');
      await expect(page.getByText(/−X to wall: .* cm/)).toBeVisible();
    });
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
    await canvas.dragTo(canvas, { sourcePosition: { x: 120, y: 150 }, targetPosition: { x: 194, y: 171 } });
    await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Group pieces' })).toBeVisible();
  });
});
