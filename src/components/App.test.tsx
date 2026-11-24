import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRESSERS, FLOOR_LAMPS, PENDANTS, READING_CHAIRS, ROUND_RUGS, RUGS, VIEWS, mainView } from '../data/catalog';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { fabricPrice, fabricUrl } from '../data/fabrics';
import { BEDX } from '../scene/bedroom/dimensions';
import { layoutSection } from '../scene/mouldLayout';
import { BEDROOM_MOULD_WALLS } from '../scene/mouldWalls';
import { DEFAULTS, STORAGE_KEY, type Settings } from '../state/settings';
import { App } from './App';

const scene = { apply: vi.fn(), setView: vi.fn(), pointAt: vi.fn(), dispose: vi.fn() };
const createApartmentScene = vi.fn<(...args: unknown[]) => typeof scene>(() => scene);

vi.mock('../scene/createScene', () => ({
  createApartmentScene: (...args: unknown[]) => createApartmentScene(...args),
}));

/** the settings the scene last received: from apply, or the ones it was created with */
const lastApplied = (): Settings => scene.apply.mock.calls.at(-1)?.[0] ?? (createApartmentScene.mock.calls.at(-1)![2] as Settings);
const stored = (): Settings => JSON.parse(localStorage.getItem(STORAGE_KEY)!);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  createApartmentScene.mockImplementation(() => scene);
});

/** render the app and wait for the (lazily loaded) scene to be created */
const renderApp = async () => {
  const r = render(<App />);
  await waitFor(() => expect(createApartmentScene).toHaveBeenCalled());
  return r;
};
/** render with a room already selected, as a returning visitor would have it */
const renderIn = (room: Settings['room']) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, room }));
  return renderApp();
};
const roomList = () => screen.getByRole('list', { name: 'Rooms' });
const back = () => screen.getByRole('button', { name: 'Back to all rooms' });
/** a row of a room's menu, by the title before its summary */
const row = (title: string) => {
  const rows = screen.getAllByRole('button').filter((b) => b.dataset.topic && b.querySelector('strong')?.textContent === title);
  expect(rows).toHaveLength(1);
  return rows[0];
};
/** open a room's menu pages in turn, by the titles on their rows */
const goTo = (...titles: string[]) => {
  for (const t of titles) fireEvent.click(row(t));
};
/** go up one page of a room's menu */
const up = (to: string) => fireEvent.click(screen.getByRole('button', { name: `Back to ${to}` }));
/** a click in 3D as the scene reports it: the room it landed in, and the menu option of what it hit (a path in that room) */
const click3d = async (room: string | null, path?: string[]) => {
  const onPick = createApartmentScene.mock.calls.at(-1)![3] as (p: unknown) => void;
  await act(async () => onPick({ room, option: room && path ? { room, path } : null }));
};
/** the mouse over an option of the selected room (a path), over another room as a whole (no path), or over nothing */
const hover3d = async (room?: string, path?: string[]) => {
  const onHover = createApartmentScene.mock.calls.at(-1)![4] as (h: unknown) => void;
  await act(async () => onHover(room ? { room, option: path ? { room, path } : null, x: 10, y: 20 } : null));
};
const viewNames = () => within(screen.getByRole('group', { name: 'Camera views' })).getAllByRole('button').map((b) => b.textContent);

describe('App', () => {
  it('creates the scene with the saved settings and disposes it on unmount', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, time: 'eve', bedroom: { rug: 'rista' } }));
    const { unmount } = await renderApp();
    expect(createApartmentScene).toHaveBeenCalledTimes(1);
    expect(createApartmentScene.mock.calls[0][2]).toMatchObject({ time: 'eve', bedroom: { rug: 'rista' } });
    unmount();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
  });

  it('applies and persists chip selections', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    goTo('Painting');
    const painting = screen.getByRole('group', { name: 'Painting' });
    await user.click(within(painting).getByRole('button', { name: 'Hills' }));
    expect(within(painting).getByRole('button', { name: 'Hills' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(painting).getByRole('button', { name: 'Clay sun' })).toHaveAttribute('aria-pressed', 'false');
    expect(lastApplied().bedroom.art).toBe('hills');
    expect(stored().bedroom.art).toBe('hills');
  });

  it('toggles lighting and the pendant', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    const daynight = screen.getByRole('switch', { name: 'Evening lighting' });
    expect(daynight).toHaveAttribute('aria-checked', 'false');
    await user.click(daynight);
    expect(lastApplied().time).toBe('eve');
    expect(daynight).toHaveAttribute('aria-checked', 'true');
    await user.click(daynight);
    expect(lastApplied().time).toBe('day');
    goTo('Ceiling light');
    await user.click(screen.getByRole('button', { name: 'Pendant on' }));
    expect(screen.getByRole('button', { name: 'Pendant off' })).toHaveAttribute('aria-pressed', 'false');
    expect(lastApplied().bedroom.pendant).toBe('off');
  });

  it('moves the camera to a preset view', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    await user.click(screen.getByRole('button', { name: 'Top down' }));
    expect(scene.setView).toHaveBeenCalledWith(VIEWS.find((v) => v.name === 'Top down')!.pose);
  });

  it('accepts valid accent hex input and rejects invalid input', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    goTo('Accent colour');
    const hex = screen.getByRole('textbox', { name: 'Accent hex' });
    await user.clear(hex);
    await user.type(hex, '2f5d62{Enter}');
    expect(lastApplied().bedroom.accent).toBe('#2F5D62');
    expect(screen.getByRole('button', { name: 'Petrol' })).toHaveAttribute('aria-pressed', 'true');
    expect(hex).toHaveValue('#2F5D62');

    await user.clear(hex);
    await user.type(hex, 'zzz{Enter}');
    expect(lastApplied().bedroom.accent).toBe('#2F5D62');
    expect(hex).toHaveValue('#2F5D62');
  });

  it('pillow "Accent" swatch follows the accent colour', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    goTo('Accent colour');
    await user.click(screen.getByRole('button', { name: 'Mustard' }));
    up('Bedroom');
    goTo('Pillows and throw');
    const accentPillow = within(screen.getByRole('group', { name: 'Pillows and throw' })).getByRole('button', { name: 'Accent' });
    expect(accentPillow.querySelector('.dot')).toHaveStyle({ background: '#C49A3A' });
  });

  it('sets the room spacing and dado height', async () => {
    await renderIn('bedroom');
    goTo('Wall moulding');
    const room = within(screen.getByTestId('bedroom-mould-room'));
    fireEvent.change(room.getByRole('slider', { name: /^Spacing/ }), { target: { value: '12' } });
    expect(lastApplied().bedroom.mouldSpacing).toBe(12);
    fireEvent.change(room.getByRole('slider', { name: /^Dado height/ }), { target: { value: '90' } });
    expect(lastApplied().bedroom.mouldDado).toBe(90);
  });

  it('overrides a wall spacing and goes back to the room spacing', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    goTo('Wall moulding', 'Bed wall');
    const bed = within(screen.getByTestId('mould-bed'));
    expect(bed.queryByRole('button', { name: 'Use room spacing' })).toBeNull();
    fireEvent.change(bed.getByRole('slider', { name: /^Spacing/ }), { target: { value: '14' } });
    expect(lastApplied().bedroom.mouldWalls.bed.spacing).toBe(14);
    await user.click(bed.getByRole('button', { name: 'Use room spacing' }));
    expect(lastApplied().bedroom.mouldWalls.bed.spacing).toBeNull();
    expect(bed.queryByRole('button', { name: 'Use room spacing' })).toBeNull();
  });

  it('clears the fixed column when the count drops below it, and leaves it when only the room spacing moves', async () => {
    await renderIn('living');
    goTo('Wall moulding');
    expect(lastApplied().living.mouldWalls.tv.fixedColumn).toBe(2);
    const roomSpacing = within(screen.getByTestId('living-mould-room')).getByRole('slider', { name: /^Spacing/ });
    fireEvent.change(roomSpacing, { target: { value: (roomSpacing as HTMLInputElement).max } });
    expect(lastApplied().living.mouldSpacing).toBeGreaterThan(8);
    expect(lastApplied().living.mouldWalls.tv.fixedColumn).toBe(2);
    goTo('TV wall');
    const tv = within(screen.getByTestId('mould-tv'));
    fireEvent.change(tv.getByRole('slider', { name: /^Columns/ }), { target: { value: '1' } });
    expect(lastApplied().living.mouldWalls.tv.fixedColumn).toBe(0);
    expect(lastApplied().living.mouldWalls.tv.columns).toBe(1);
  });

  it('offers "Centred on bed" on the bed wall only', async () => {
    await renderIn('bedroom');
    goTo('Wall moulding', 'Bed wall');
    expect(within(screen.getByTestId('mould-bed')).getByRole('button', { name: 'Centred on bed' })).toBeInTheDocument();
    up('Wall moulding');
    goTo('Dresser wall');
    // the dresser wall with a fixed column shows its position chips, but not the bed one
    fireEvent.change(within(screen.getByTestId('mould-dresser')).getByRole('combobox'), { target: { value: '1' } });
    const win = within(screen.getByTestId('mould-dresser'));
    expect(win.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
    expect(win.queryByRole('button', { name: 'Centred on bed' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Centred on bed' })).toBeNull();
  });

  it('disables the position chips while the fixed column\'s centre is forced', async () => {
    await renderIn('bedroom');
    goTo('Wall moulding', 'Dresser wall');
    // the fourth column is alone between the door and the corner, so it fills that stretch and cannot move
    const win = within(screen.getByTestId('mould-dresser'));
    fireEvent.change(win.getByRole('combobox'), { target: { value: '4' } });
    for (const name of ['Even', 'Custom']) expect(win.getByRole('button', { name })).toBeDisabled();
    // a middle column of the bed wall can still move
    up('Wall moulding');
    goTo('Bed wall');
    const bed = within(screen.getByTestId('mould-bed'));
    expect(bed.getByRole('button', { name: 'Custom' })).toBeEnabled();
  });

  it('disables a section\'s controls with its wall', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    goTo('Wall moulding', 'Bed wall');
    expect(screen.getByTestId('mould-bed')).not.toHaveClass('off');
    expect(within(screen.getByTestId('mould-bed')).getByRole('slider', { name: /^Columns/ })).toBeEnabled();
    up('Wall moulding');
    await user.click(within(screen.getByRole('group', { name: 'Show moulding on' })).getByRole('button', { name: 'Bed wall' }));
    expect(row('Bed wall')).toHaveTextContent('Hidden');
    goTo('Bed wall');
    const bed = screen.getByTestId('mould-bed');
    expect(bed).toHaveClass('off');
    expect(within(bed).getByText(/moulding is hidden/)).toBeInTheDocument();
    expect(within(bed).getByRole('slider', { name: /^Columns/ })).toBeDisabled();
    expect(within(bed).getByRole('combobox')).toBeDisabled();
    up('Wall moulding');
    goTo('Dresser wall');
    expect(screen.getByTestId('mould-dresser')).not.toHaveClass('off');
    expect(lastApplied().bedroom.mouldBedWall).toBe('off');
  });

  it('labels each section and shows how many columns fit', async () => {
    await renderIn('bedroom');
    goTo('Wall moulding', 'Bed wall');
    expect(screen.getByRole('group', { name: 'Bed wall' })).toBe(screen.getByTestId('mould-bed'));
    up('Wall moulding');
    goTo('Dresser wall');
    expect(screen.getByRole('group', { name: 'Dresser wall' })).toBe(screen.getByTestId('mould-dresser'));
    const win = within(screen.getByTestId('mould-dresser'));
    fireEvent.change(win.getByRole('slider', { name: /^Columns/ }), { target: { value: '10' } });
    expect(win.getByText(/10 \(\d+ fit\)/)).toBeInTheDocument();
  });

  it('seeds a custom position with the drawn centre', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    const s = lastApplied().bedroom;
    const sec = BEDROOM_MOULD_WALLS[0].sections[0];
    const drawn = layoutSection(sec.run, { spacing: s.mouldSpacing, dado: s.mouldDado }, s.mouldWalls.bed, BEDX).fixed!;
    goTo('Wall moulding', 'Bed wall');
    const bed = within(screen.getByTestId('mould-bed'));
    expect(bed.queryByRole('slider', { name: /^Centre/ })).toBeNull();
    await user.click(bed.getByRole('button', { name: 'Custom' }));
    const w = lastApplied().bedroom.mouldWalls.bed;
    expect(w.fixedPosition).toBe('custom');
    expect(w.fixedCentre).toBe(Math.round((drawn.centre - sec.run[0]) * 100));
    expect(bed.getByRole('slider', { name: /^Centre/ })).toBeInTheDocument();
  });

  it('changes the living-room moulding walls and greys each section with its own wall', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Wall moulding');
    const walls = within(screen.getByRole('group', { name: 'Show moulding on' }));
    await user.click(walls.getByRole('button', { name: /TV wall/ }));
    expect(lastApplied().living.mouldTvWall).toBe('off');
    goTo('TV wall');
    const tv = screen.getByTestId('mould-tv');
    expect(tv).toHaveClass('off');
    expect(within(tv).getByRole('slider', { name: /^Columns/ })).toBeDisabled();
    up('Wall moulding');
    goTo('Sofa wall');
    const sofa = screen.getByTestId('mould-sofa');
    expect(sofa).not.toHaveClass('off');
    expect(within(sofa).getByRole('slider', { name: /^Columns/ })).toBeEnabled();
    fireEvent.change(within(sofa).getByRole('slider', { name: /^Columns/ }), { target: { value: '7' } });
    expect(lastApplied().living.mouldWalls.sofa.columns).toBe(7);
    expect(lastApplied().living.mouldWalls.tv).toEqual(DEFAULTS.living.mouldWalls.tv);
  });

  it('offers the Sofa wall view in the living room', async () => {
    await renderIn('living');
    expect(viewNames()).toContain('Sofa wall');
  });

  it('selects a rug by click or keyboard, but not via its shop link', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    goTo('Rug');
    const rug = screen.getByText('Palma, green vines').closest('.rug') as HTMLElement;
    await user.click(within(rug).getByRole('link'));
    expect(lastApplied().bedroom.rug).toBe(DEFAULTS.bedroom.rug);
    await user.click(rug);
    expect(rug).toHaveAttribute('aria-pressed', 'true');
    expect(lastApplied().bedroom.rug).toBe('palma');

    const none = screen.getByText('No rug').closest('.rug') as HTMLElement;
    none.focus();
    await user.keyboard('{Enter}');
    expect(lastApplied().bedroom.rug).toBe('none');
  });

  it('shows the WebGL fallback and keeps the panel working when the scene cannot be created', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createApartmentScene.mockImplementation(() => {
      throw new Error('no webgl');
    });
    const user = userEvent.setup();
    await renderIn('bedroom');
    expect(screen.getByRole('alert')).toHaveTextContent('needs WebGL');
    goTo('Painting');
    await user.click(screen.getByRole('button', { name: 'Arches' }));
    expect(stored().bedroom.art).toBe('arches');
  });

  it('shows the apartment controls when no room is selected', async () => {
    await renderApp();
    expect(screen.getByRole('heading', { name: 'Apartment' })).toBeInTheDocument();
    expect(within(roomList()).getAllByRole('button')).toHaveLength(4);
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('all').pose);
  });

  it('has no room switcher and no way back when already at all rooms', async () => {
    await renderApp();
    expect(screen.queryByRole('group', { name: 'Room' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to all rooms' })).toBeNull();
  });

  it('goes back to all rooms from a room', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    await user.click(back());
    expect(lastApplied().room).toBe('all');
    expect(screen.getByRole('heading', { name: 'Apartment' })).toBeInTheDocument();
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('all').pose);
  });

  it("selects a room from the room list and shows that room's controls", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(within(roomList()).getByRole('button', { name: /Living room/ }));
    goTo('Show or hide pieces');
    expect(screen.getByRole('group', { name: 'Furniture' })).toBeInTheDocument();
    expect(lastApplied().room).toBe('living');
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('living').pose);
  });

  it('selects the room clicked in 3D, and deselects on a click outside', async () => {
    await renderApp();
    await click3d('hall');
    expect(lastApplied().room).toBe('hall');
    expect(screen.getByRole('heading', { name: 'Hall' })).toBeInTheDocument();
    await click3d(null);
    expect(lastApplied().room).toBe('all');
  });

  it('moves only the pivot, not the rotation or zoom, when a room is picked in 3D', async () => {
    await renderApp();
    const pivot = (sel: 'hall' | 'all') => {
      const { tx, ty, tz } = mainView(sel).pose;
      return { tx, ty, tz };
    };
    await click3d('hall');
    expect(scene.setView).toHaveBeenLastCalledWith(pivot('hall'));
    await click3d(null);
    expect(lastApplied().room).toBe('all');
    expect(scene.setView).toHaveBeenLastCalledWith(pivot('all'));
  });

  it('leaves the camera alone when a 3D pick changes nothing', async () => {
    await renderApp();
    scene.setView.mockClear();
    await click3d(null); // already at all rooms
    expect(scene.setView).not.toHaveBeenCalled();
  });

  it('still flies from the sidebar after a 3D pick that changed nothing', async () => {
    const user = userEvent.setup();
    await renderApp();
    await click3d(null); // already at all rooms
    await user.click(within(roomList()).getByRole('button', { name: /Living room/ }));
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('living').pose);
  });

  it('hides living-room furniture and repaints a room', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Show or hide pieces');
    await user.click(within(screen.getByRole('group', { name: 'Furniture' })).getByRole('switch', { name: 'Sofa' }));
    expect(lastApplied().living.components.sofa.shown).toBe(false);
    up('Living room');
    expect(row('Show or hide pieces')).toHaveTextContent('5 of 8 shown');
    await user.click(back());
    await user.click(within(roomList()).getByRole('button', { name: /Hall/ }));
    goTo('Wall colour');
    await user.click(within(screen.getByRole('group', { name: 'Wall colour' })).getByRole('button', { name: 'Chalk white' }));
    expect(lastApplied().walls.hall).toBe('chalk');
  });

  it('describes a fixed office piece on its own page', async () => {
    await renderIn('office');
    expect(screen.getByRole('heading', { name: 'Office' })).toBeVisible();
    goTo('Desk');
    expect(screen.getByText(/IDÅSEN desk/)).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Show in room' })).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Desk' })).toBeNull();
    up('Office');
    goTo('Wall colour');
    expect(screen.getByRole('group', { name: 'Wall colour' })).toBeVisible();
  });

  it('offers no floor choice in any room', async () => {
    const user = userEvent.setup();
    await renderApp();
    for (const name of ['Bedroom', 'Hall', 'Living room', 'Office']) {
      await user.click(within(roomList()).getByRole('button', { name: new RegExp(name) }));
      expect(screen.queryByRole('group', { name: 'Floor' })).toBeNull();
      await user.click(back());
    }
  });

  it('offers the Jotun wall colours', async () => {
    const user = userEvent.setup();
    await renderIn('office');
    expect(row('Wall colour')).toHaveTextContent('Devine 12083');
    goTo('Wall colour');
    const walls = screen.getByRole('group', { name: 'Wall colour' });
    expect(within(walls).getByRole('button', { name: 'Devine 12083' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(walls).getByRole('button', { name: 'Froströk 1376' }));
    expect(lastApplied().walls.office).toBe('frostrok');
  });

  it('shows the camera views for the selection', async () => {
    const { unmount } = await renderApp();
    expect(viewNames()).toEqual(['Apartment', 'Foot of bed', 'Hall', 'Living room', 'Office']);
    unmount();
    await renderIn('bedroom');
    expect(viewNames()).toEqual(['Overview', 'Foot of bed', 'Wardrobe wall', 'Dresser wall', 'Top down']);
  });

  it('only offers the pendant in the bedroom', async () => {
    const { unmount } = await renderApp();
    expect(screen.queryByRole('button', { name: /Pendant/ })).toBeNull();
    unmount();
    await renderIn('bedroom');
    goTo('Ceiling light');
    expect(screen.getByRole('button', { name: 'Pendant on' })).toBeInTheDocument();
  });
});

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe.each(['living'] as const)('lighting in the %s', (room) => {
  it('offers pendants and floor lamps and applies the choice', async () => {
    await renderIn(room);
    goTo('Ceiling light');
    const pendants = screen.getByRole('group', { name: 'Ceiling light' });
    expect(within(pendants).getAllByRole('button')).toHaveLength(PENDANTS.length);
    await userEvent.click(within(pendants).getByRole('button', { name: new RegExp(esc(PENDANTS[0].name)) }));
    expect(lastApplied()[room].components['ceiling-light']).toEqual({ shown: true, variant: PENDANTS[0].id, options: {} });
    expect(stored()[room].components['ceiling-light'].variant).toBe(PENDANTS[0].id);
    up('Living room');
    expect(row('Ceiling light')).toHaveTextContent(PENDANTS[0].name.split(',')[0]);
    goTo('Floor lamp');
    const floor = screen.getByRole('group', { name: 'Floor lamp' });
    await userEvent.click(within(floor).getByRole('button', { name: new RegExp(esc(FLOOR_LAMPS[0].name)) }));
    expect(lastApplied()[room].components['floor-lamp']).toEqual({ shown: true, variant: FLOOR_LAMPS[0].id, options: {} });
    expect(lastApplied()[room].components['ceiling-light'].variant).toBe(PENDANTS[0].id);
  });
  it('starts with the lamps hidden', async () => {
    await renderIn(room);
    expect(row('Ceiling light')).toHaveTextContent('Hidden');
    expect(row('Floor lamp')).toHaveTextContent('Hidden');
  });
  it('does not select a lamp when its shop link is clicked', async () => {
    await renderIn(room);
    goTo('Ceiling light');
    const link = within(screen.getByRole('group', { name: 'Ceiling light' })).getAllByRole('link')[0];
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(lastApplied()[room].components['ceiling-light'].shown).toBe(false);
  });
});

describe('showing and hiding the office pieces together', () => {
  const pieces = () => stored().office.components;

  it('lists every piece under the office headings, each with its own switch', async () => {
    await renderIn('office');
    goTo('Show or hide pieces');
    expect(within(screen.getByRole('group', { name: 'Reading corner' })).getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual([
      'Reading chair', 'Dresser',
    ]);
    expect(screen.getByRole('heading', { level: 3, name: 'Workspace' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Dresser' }));
    expect(pieces().dresser.shown).toBe(false);
    expect(pieces()['reading-chair'].shown).toBe(true);
    up('Office');
    expect(row('Show or hide pieces')).toHaveTextContent('6 of 9 shown');
  });

  it('shows or hides them all as one step', async () => {
    await renderIn('office');
    goTo('Show or hide pieces');
    fireEvent.click(screen.getByRole('button', { name: 'Hide all' }));
    expect(Object.values(pieces()).every((c) => !c.shown)).toBe(true);
    expect(screen.getByRole('button', { name: 'Hide all' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(Object.values(pieces()).every((c) => c.shown)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(Object.values(pieces()).every((c) => !c.shown)).toBe(true);
  });

  it('resets to how the office starts, lamps off', async () => {
    await renderIn('office');
    goTo('Show or hide pieces');
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset show or hide pieces' }));
    expect(pieces()['ceiling-light'].shown).toBe(false);
    expect(pieces().desk.shown).toBe(true);
  });

  it('points at a piece in 3D while its switch is hovered', async () => {
    await renderIn('office');
    goTo('Show or hide pieces');
    fireEvent.mouseEnter(screen.getByRole('switch', { name: 'Round rug' }));
    expect(scene.pointAt.mock.calls.at(-1)?.[0]).toEqual({ room: 'office', path: ['round-rug'] });
  });
});

describe('showing and hiding the living room pieces together', () => {
  const pieces = () => stored().living.components;

  it('hides every piece as one step that Undo restores', async () => {
    await renderIn('living');
    goTo('Show or hide pieces');
    const before = JSON.parse(JSON.stringify(pieces()));
    fireEvent.click(screen.getByRole('button', { name: 'Hide all' }));
    expect(Object.values(pieces()).every((c) => !c.shown)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(pieces()).toEqual(before);
    expect(pieces().sofa.shown).toBe(true);
  });

  it('resets to how the room starts, lamps hidden and the rest shown', async () => {
    await renderIn('living');
    goTo('Show or hide pieces');
    fireEvent.click(screen.getByRole('button', { name: 'Hide all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset show or hide pieces' }));
    expect(pieces()['ceiling-light'].shown).toBe(false);
    expect(pieces()['floor-lamp'].shown).toBe(false);
    expect(pieces().sofa.shown).toBe(true);
    expect(pieces().rug.shown).toBe(true);
  });
});

describe('office pieces', () => {
  const lists = [
    ['Reading chair', READING_CHAIRS, 'reading-chair'],
    ['Dresser', DRESSERS, 'dresser'],
    ['Round rug', ROUND_RUGS, 'round-rug'],
    ['Ceiling light', PENDANTS, 'ceiling-light'],
    ['Floor lamp', FLOOR_LAMPS, 'floor-lamp'],
  ] as const;
  it.each(lists)('offers the %s products and applies the choice', async (name, items, id) => {
    await renderIn('office');
    goTo(name);
    const group = screen.getByRole('group', { name });
    expect(within(group).getAllByRole('button')).toHaveLength(items.length);
    await userEvent.click(within(group).getByRole('button', { name: new RegExp(esc(items[2].name)) }));
    expect(lastApplied().office.components[id]).toEqual({ shown: true, variant: items[2].id, options: {} });
    expect(stored().office.components[id]).toEqual({ shown: true, variant: items[2].id, options: {} });
  });
  it('hides a piece and says so on its row', async () => {
    await renderIn('office');
    goTo('Reading chair');
    await userEvent.click(screen.getByRole('switch', { name: 'Show in room' }));
    const c = lastApplied().office.components;
    expect(c['reading-chair'].shown).toBe(false);
    expect(c.dresser.shown).toBe(true);
    up('Office');
    expect(row('Reading chair')).toHaveTextContent('Hidden');
    expect(row('Reading chair')).toHaveFocus();
  });
  it('shows a hidden piece when a product is picked', async () => {
    const hidden = { ...DEFAULTS.office.components, 'ceiling-light': { shown: false, variant: PENDANTS[0].id, options: {} } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULTS, room: 'office', office: { components: hidden } }));
    await renderApp();
    goTo('Ceiling light');
    await userEvent.click(within(screen.getByRole('group', { name: 'Ceiling light' })).getByRole('button', { name: new RegExp(esc(PENDANTS[1].name)) }));
    expect(lastApplied().office.components['ceiling-light']).toEqual({ shown: true, variant: PENDANTS[1].id, options: {} });
  });
  it('does not pick a product when its shop link is clicked', async () => {
    await renderIn('office');
    goTo('Reading chair');
    const card = within(screen.getByRole('group', { name: 'Reading chair' })).getByRole('button', { name: new RegExp(esc(READING_CHAIRS[1].name)) });
    const link = within(card).getByRole('link');
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(lastApplied().office.components['reading-chair'].variant).toBe(READING_CHAIRS[0].id);
  });
});

it('still lists the bedroom rugs', async () => {
  await renderIn('bedroom');
  goTo('Rug');
  expect(within(screen.getByRole('group', { name: 'Rug' })).getAllByRole('button')).toHaveLength(RUGS.length);
});

describe('sofa fabric', () => {
  const grid = () => screen.getByRole('group', { name: 'Sofa fabrics' });
  const search = () => screen.getByRole('searchbox', { name: 'Search Bemz fabrics' });
  const f = BEMZ_FABRICS[0];
  const own = () => within(grid()).getByRole('button', { name: 'Original fabric' });

  it('filters the grid by search', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa');
    await user.type(search(), f.family);
    const labels = within(grid()).getAllByRole('button').map((b) => b.getAttribute('aria-label')!);
    expect(labels.length).toBeGreaterThan(1);
    for (const l of labels.filter((x) => x !== 'Original fabric')) expect(l).toContain(f.family);
  });

  it('selects a fabric, applies and stores it, and shows its price and link', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa');
    const btn = within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` });
    await user.click(btn);
    expect(lastApplied().living.components.sofa.options.fabric).toBe(f.code);
    expect(stored().living.components.sofa.options.fabric).toBe(f.code);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(new RegExp(fabricPrice(f).replace(/[()]/g, '\\$&')))).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /View on Bemz/ });
    expect(link).toHaveAttribute('href', fabricUrl(f));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('says so when nothing matches, and still shows the selected fabric', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa');
    await user.click(within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` }));
    await user.type(search(), 'zzzz');
    expect(screen.getByText('No fabrics match')).toBeInTheDocument();
    expect(own()).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View on Bemz/ })).toHaveAttribute('href', fabricUrl(f));
  });

  it('shows 24 fabrics and 24 more on request', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa');
    expect(within(grid()).getAllByRole('button')).toHaveLength(25);
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(within(grid()).getAllByRole('button')).toHaveLength(49);
  });

  it('says which fabric the sofa has on its row, with its swatch', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    expect(row('Sofa')).toHaveTextContent('Original fabric');
    goTo('Sofa');
    await user.click(within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` }));
    up('Living room');
    expect(row('Sofa')).toHaveTextContent(`Bemz ${f.family}, ${f.colour}`);
    expect(row('Sofa').querySelector<HTMLElement>('.swatch, [style]')?.getAttribute('style') ?? '').toMatch(/background/);
  });

  it('drops the sofa swatch from its row while the sofa is hidden', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa');
    await user.click(within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` }));
    await user.click(screen.getByRole('switch', { name: 'Show in room' }));
    up('Living room');
    expect(row('Sofa')).toHaveTextContent('Hidden');
    expect(row('Sofa').querySelector('i')).toBeNull();
  });

  it("puts the sofa's fabric back to the original with the page's Reset", async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa');
    await user.click(within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` }));
    expect(stored().living.components.sofa.options.fabric).toBe(f.code);
    await user.click(screen.getByRole('button', { name: 'Reset sofa' }));
    expect(stored().living.components.sofa.options.fabric).toBe('original');
    expect(screen.queryByRole('button', { name: 'Reset sofa' })).toBeNull();
  });

  it('goes back to the original fabric', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa');
    await user.click(within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` }));
    await user.click(own());
    expect(lastApplied().living.components.sofa.options.fabric).toBe('original');
    expect(screen.getByText("The sofa's own dark grey")).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View on Bemz/ })).not.toBeInTheDocument();
  });
});

describe('room menu', () => {
  const rowTitles = () => [...document.querySelectorAll('.topic strong')].map((b) => b.textContent);
  /** the section headings of a room's first page */
  const sections = () => screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);

  it('opens a room on a summary of its options, with no controls on it', async () => {
    await renderIn('bedroom');
    expect(sections()).toEqual(['Room', 'Lighting', 'Furniture', 'Textiles and decor']);
    expect(rowTitles()).toEqual([
      'Wall colour', 'Wall moulding', 'Ceiling light', 'Wardrobes', 'Rug', 'Pillows and throw', 'Painting', 'Accent colour', 'About the room',
    ]);
    expect(row('Wall moulding')).toHaveTextContent('White · Bed wall, Dresser wall');
    expect(row('Painting')).toHaveTextContent('Clay sun · brass frame');
    expect(screen.queryByRole('group', { name: 'Show moulding on' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Wall colour' })).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('lists the other rooms\' options', async () => {
    const { unmount } = await renderIn('living');
    expect(sections()).toEqual(['Room', 'Lighting', 'Furniture', 'Textiles and decor']);
    expect(rowTitles()).toEqual([
      'Wall colour', 'Wall moulding', 'Show or hide pieces', 'Ceiling light', 'Floor lamp', 'Sofa', 'Frame TV', 'Sideboard', 'String shelving', 'Plant',
      'Rug', 'About the room',
    ]);
    expect(row('Ceiling light')).toHaveTextContent('Hidden');
    expect(row('Sofa')).toHaveTextContent('Original fabric');
    unmount();
    const office = await renderIn('office');
    expect(rowTitles()).toEqual([
      'Wall colour', 'Show or hide pieces', 'Ceiling light', 'Floor lamp', 'Cabinets', 'Desk', 'Drawer unit', 'Desk chair', 'Reading chair', 'Dresser', 'Round rug',
      'About the room',
    ]);
    for (const name of ['Room', 'Lighting', 'Furniture', 'Textiles and decor']) expect(screen.getByRole('heading', { level: 2, name })).toBeVisible();
    for (const name of ['Workspace', 'Reading corner']) expect(screen.getByRole('heading', { level: 3, name })).toBeVisible();
    office.unmount();
    await renderIn('hall');
    expect(sections()).toEqual(['Room']);
    expect(rowTitles()).toEqual(['Wall colour', 'About the room']);
  });

  it('keeps the moulding walls a level below the moulding page', async () => {
    await renderIn('bedroom');
    goTo('Wall moulding');
    expect(screen.getByRole('heading', { level: 1, name: 'Wall moulding' })).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Show moulding on' })).toBeInTheDocument();
    expect(screen.queryByTestId('mould-bed')).toBeNull();
    const walls = within(screen.getByRole('list', { name: 'Walls and shopping list' })).getAllByRole('button');
    expect(walls.map((b) => b.querySelector('strong')!.textContent)).toEqual([
      'Bed wall', 'Dresser wall', 'Shopping list',
    ]);
  });

  it('updates a row\'s summary and returns focus to it on the way back', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    goTo('Painting');
    await user.click(screen.getByRole('button', { name: 'Hills' }));
    up('Bedroom');
    expect(row('Painting')).toHaveTextContent('Hills · brass frame');
    expect(row('Painting')).toHaveFocus();
  });

  it('starts over at the summary after leaving the room', async () => {
    await renderIn('bedroom');
    goTo('Wall moulding', 'Bed wall');
    expect(screen.queryByRole('button', { name: 'Back to all rooms' })).toBeNull();
    await click3d('living');
    expect(screen.getByRole('heading', { level: 1, name: 'Living room' })).toBeInTheDocument();
    await click3d('bedroom');
    expect(screen.getByRole('heading', { level: 1, name: 'Bedroom' })).toBeInTheDocument();
    expect(back()).toBeInTheDocument();
  });
});

describe('pointing at menu rows', () => {
  const pointed = () => scene.pointAt.mock.calls.at(-1)?.[0];

  it('highlights in 3D what a hovered or focused row opens, and nothing once it leaves', async () => {
    await renderIn('office');
    fireEvent.mouseEnter(row('Desk'));
    expect(pointed()).toEqual({ room: 'office', path: ['desk'] });
    fireEvent.mouseLeave(row('Desk'));
    expect(pointed()).toBeNull();
    fireEvent.focus(row('Round rug'));
    expect(pointed()).toEqual({ room: 'office', path: ['round-rug'] });
  });

  it('points with the path of the page the row is on', async () => {
    await renderIn('bedroom');
    goTo('Wall moulding');
    fireEvent.mouseEnter(row('Bed wall'));
    expect(pointed()).toEqual({ room: 'bedroom', path: ['moulding', 'bed'] });
  });

  it('stops pointing when the row opens its page', async () => {
    await renderIn('office');
    fireEvent.mouseEnter(row('Desk'));
    goTo('Desk');
    expect(pointed()).toBeNull();
  });
});

describe('clicking options in 3D', () => {
  const h1 = () => screen.getByRole('heading', { level: 1 }).textContent;

  it('opens the page of what was clicked in the selected room', async () => {
    await renderIn('bedroom');
    await click3d('bedroom', ['moulding', 'bed']);
    expect(h1()).toBe('Bed wall');
    expect(screen.getByTestId('mould-bed')).toBeInTheDocument();
    up('Wall moulding');
    expect(h1()).toBe('Wall moulding');
  });

  it('goes back to the summary on a click at something with no option of its own', async () => {
    await renderIn('bedroom');
    goTo('Painting');
    await click3d('bedroom');
    expect(h1()).toBe('Bedroom');
    expect(lastApplied().room).toBe('bedroom');
  });

  it('only selects the room from the apartment overview', async () => {
    await renderApp();
    await click3d('bedroom', ['moulding', 'bed']);
    expect(lastApplied().room).toBe('bedroom');
    expect(h1()).toBe('Bedroom');
  });

  it('switches to another room clicked from inside one, at its summary', async () => {
    await renderIn('bedroom');
    goTo('Rug');
    await click3d('living', ['sofa']);
    expect(lastApplied().room).toBe('living');
    expect(h1()).toBe('Living room');
  });

  it.each([
    ['bedroom', ['walls'], 'Wall colour'],
    ['bedroom', ['ceiling'], 'Ceiling light'],
    ['bedroom', ['accent'], 'Accent colour'],
    ['bedroom', ['moulding', 'dresser'], 'Dresser wall'],
    ['bedroom', ['wardrobes'], 'Wardrobes'],
    ['bedroom', ['pillows'], 'Pillows and throw'],
    ['bedroom', ['painting'], 'Painting'],
    ['bedroom', ['rug'], 'Rug'],
    ['hall', ['walls'], 'Wall colour'],
    ['living', ['ceiling-light'], 'Ceiling light'],
    ['living', ['floor-lamp'], 'Floor lamp'],
    ['living', ['sofa'], 'Sofa'],
    ['living', ['tv'], 'Frame TV'],
    ['living', ['tv-bench'], 'Sideboard'],
    ['living', ['shelving'], 'String shelving'],
    ['living', ['plant'], 'Plant'],
    ['living', ['rug'], 'Rug'],
    ['living', ['moulding', 'sofa'], 'Sofa wall'],
    ['living', ['moulding', 'tv'], 'TV wall'],
    ['office', ['cabinets'], 'Cabinets'],
    ['office', ['desk'], 'Desk'],
    ['office', ['drawers'], 'Drawer unit'],
    ['office', ['desk-chair'], 'Desk chair'],
    ['office', ['ceiling-light'], 'Ceiling light'],
    ['office', ['floor-lamp'], 'Floor lamp'],
    ['office', ['reading-chair'], 'Reading chair'],
    ['office', ['dresser'], 'Dresser'],
    ['office', ['round-rug'], 'Round rug'],
    ['office', ['about'], 'About the room'],
  ] as const)('opens %s › %j as the "%s" page', async (room, path, title) => {
    await renderIn(room);
    await click3d(room, [...path]);
    expect(h1()).toBe(title);
  });

  it('names the option under the mouse and hides the name off it', async () => {
    const { container } = await renderIn('bedroom');
    const label = container.querySelector<HTMLElement>('.pick-label')!;
    expect(label).not.toBeVisible();
    await hover3d('bedroom', ['moulding', 'bed']);
    expect(label).toBeVisible();
    expect(label).toHaveTextContent('Wall moulding · Bed wall');
    expect(label.style.transform).toBe('translate(24px, 36px)');
    await hover3d('bedroom', ['pillows']);
    expect(label).toHaveTextContent('Pillows and throw');
    await hover3d();
    expect(label).not.toBeVisible();
  });

  it('names an office piece under the mouse', async () => {
    const { container } = await renderIn('office');
    const label = container.querySelector<HTMLElement>('.pick-label')!;
    await hover3d('office', ['round-rug']);
    expect(label).toHaveTextContent('Round rug');
  });

  it('names a living-room piece under the mouse', async () => {
    const { container } = await renderIn('living');
    const label = container.querySelector<HTMLElement>('.pick-label')!;
    await hover3d('living', ['sofa']);
    expect(label).toHaveTextContent('Sofa');
  });

  it('points at the living-room piece whose row is hovered', async () => {
    await renderIn('living');
    fireEvent.mouseEnter(row('Sofa'));
    expect(scene.pointAt.mock.calls.at(-1)?.[0]).toEqual({ room: 'living', path: ['sofa'] });
  });

  it('names the room a click would select', async () => {
    const { container } = await renderIn('bedroom');
    const label = container.querySelector<HTMLElement>('.pick-label')!;
    await hover3d('living');
    expect(label).toBeVisible();
    expect(label).toHaveTextContent('Living room');
    await hover3d('office');
    expect(label).toHaveTextContent('Office');
  });
});

describe('moulding shopping list', () => {
  /* the bed wall alone, so that the list is worked out at once */
  const renderBedWall = (extra: Record<string, unknown> = {}) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, room: 'bedroom', bedroom: { mouldDresserWall: 'off' }, ...extra }));
    return renderApp();
  };
  const field = (name: string) => screen.getByRole('spinbutton', { name });

  it('asks for products, then lists what to buy once a length is added', async () => {
    await renderBedWall();
    goTo('Wall moulding');
    expect(row('Shopping list')).toHaveTextContent('Add store lengths');
    goTo('Shopping list');
    fireEvent.click(screen.getByRole('button', { name: 'Add your store’s lengths' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Products and settings');
    fireEvent.click(screen.getByRole('button', { name: 'Add panel length' }));
    expect(field('Panel price 1, kronor')).toHaveValue(null);
    expect(stored().mouldShop.panel.lengths).toEqual([{ length: 240, price: null }]);
    fireEvent.change(field('Panel price 1, kronor'), { target: { value: '89' } });
    expect(stored().mouldShop.panel.lengths).toEqual([{ length: 240, price: 89 }]);
    up('Shopping list');
    expect(await screen.findByText(/^\d+ × 240 cm$/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/^Spare 1 × 240 cm$/)).toBeInTheDocument();
    expect(screen.getByTestId('shop-total')).toHaveTextContent(/\d kr/);
    up('Wall moulding');
    expect(row('Shopping list')).toHaveTextContent(/\d kr/);
  });

  it('says there is nothing to buy when no moulding wall is on', async () => {
    await renderBedWall({ bedroom: { mouldBedWall: 'off', mouldDresserWall: 'off' } });
    goTo('Wall moulding');
    expect(row('Shopping list')).toHaveTextContent('Nothing to buy');
    goTo('Shopping list');
    expect(screen.getByText(/no moulding wall is switched on/i)).toBeInTheDocument();
  });

  it('keeps a typed width inside its limits', async () => {
    await renderBedWall();
    goTo('Wall moulding', 'Shopping list', 'Products and settings');
    fireEvent.change(field('Panel profile width, millimetres'), { target: { value: '-5' } });
    expect(stored().mouldShop.panel.width).toBe(10);
    fireEvent.change(field('Panel profile width, millimetres'), { target: { value: '45' } });
    expect(stored().mouldShop.panel.width).toBe(45);
    fireEvent.change(field('Panel profile width, millimetres'), { target: { value: '' } });
    expect(stored().mouldShop.panel.width).toBe(45);
  });

  it('shows the rail product only when the rail is a different product, and saves the switches', async () => {
    await renderBedWall();
    goTo('Wall moulding', 'Shopping list', 'Products and settings');
    expect(screen.queryByRole('spinbutton', { name: 'Rail height, millimetres' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'A different moulding' }));
    expect(field('Rail height, millimetres')).toHaveValue(40);
    expect(stored().mouldShop.rail.lengths).toEqual([{ length: 240, price: null }, { length: 300, price: null }]);
    expect(field('Rail price 1, kronor')).toHaveFocus();
    fireEvent.change(field('Rail price 1, kronor'), { target: { value: '59' } });
    expect(stored().mouldShop.rail.lengths[0]).toEqual({ length: 240, price: 59 });
    expect(stored().mouldShop.railSeparate).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Allow joins in panel frames' }));
    expect(stored().mouldShop.joins).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Spare length' }));
    expect(stored().mouldShop.spare).toBe(false);
  });

  it('draws the moulding at the product width', async () => {
    await renderBedWall();
    goTo('Wall moulding', 'Shopping list', 'Products and settings');
    fireEvent.change(field('Panel profile width, millimetres'), { target: { value: '45' } });
    expect(lastApplied().mouldShop.panel.width).toBe(45);
  });
});

describe('moulding shopping list, example lengths', () => {
  it('starts from the usual lengths with prices to fill in, and lists them at once', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, room: 'bedroom', bedroom: { mouldDresserWall: 'off' } }));
    await renderApp();
    goTo('Wall moulding', 'Shopping list');
    fireEvent.click(screen.getByRole('button', { name: 'Use 240 and 300 cm' }));
    expect(stored().mouldShop.panel.lengths).toEqual([{ length: 240, price: null }, { length: 300, price: null }]);
    expect(await screen.findByText(/No price yet for/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('shop-total')).toHaveTextContent('0 kr');
  });
});

describe('undo, redo and reset', () => {
  const undoButton = () => screen.getByRole('button', { name: 'Undo' });
  const redoButton = () => screen.getByRole('button', { name: 'Redo' });

  it('undoes and redoes a change from the header, keeping the room open', async () => {
    await renderIn('bedroom');
    expect(undoButton()).toBeDisabled();
    goTo('Rug');
    fireEvent.click(screen.getAllByRole('button', { pressed: false }).find((b) => b.classList.contains('rug'))!);
    const picked = stored().bedroom.rug;
    expect(picked).not.toBe(DEFAULTS.bedroom.rug);
    fireEvent.click(undoButton());
    expect(stored().bedroom.rug).toBe(DEFAULTS.bedroom.rug);
    expect(stored().room).toBe('bedroom');
    fireEvent.click(redoButton());
    expect(stored().bedroom.rug).toBe(picked);
  });

  it('undoes with ⌘Z or Ctrl+Z and redoes with Shift, but leaves the keys to a text field', async () => {
    await renderIn('bedroom');
    goTo('Wardrobes');
    const other = within(screen.getByRole('group', { name: 'Wardrobes' })).getAllByRole('button', { pressed: false })[0];
    fireEvent.click(other);
    const picked = stored().bedroom.wardrobes;
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(stored().bedroom.wardrobes).toBe(DEFAULTS.bedroom.wardrobes);
    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(stored().bedroom.wardrobes).toBe(picked);
    up('Bedroom');
    goTo('Accent colour');
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Accent hex' }), { key: 'z', metaKey: true });
    expect(stored().bedroom.wardrobes).toBe(picked);
  });

  it('puts one page back to how the room started', async () => {
    await renderIn('living');
    goTo('Show or hide pieces');
    expect(screen.queryByRole('button', { name: 'Reset show or hide pieces' })).toBeNull();
    fireEvent.click(within(screen.getByRole('group', { name: 'Furniture' })).getAllByRole('switch')[0]);
    expect(Object.values(stored().living.components).filter((c) => !c.shown)).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Reset show or hide pieces' }));
    expect(Object.values(stored().living.components).filter((c) => !c.shown)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Reset show or hide pieces' })).toBeNull();
  });

  it('starts every room over from the apartment page, keeps the store lengths, and can undo it', async () => {
    const lengths = [{ length: 240, price: 89 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, room: 'all', bedroom: { rug: 'none' }, mouldShop: { panel: { lengths } } }));
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(stored().bedroom.rug).toBe(DEFAULTS.bedroom.rug);
    expect(stored().mouldShop.panel.lengths).toEqual(lengths);
    const note = screen.getByText(/back to how it started/);
    fireEvent.click(within(note).getByRole('button', { name: 'Undo' }));
    expect(stored().bedroom.rug).toBe('none');
  });
});

describe('panel header', () => {
  it('shows every page above the open one, and goes to any of them', async () => {
    await renderIn('living');
    goTo('Wall moulding', 'Sofa wall');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getAllByRole('button').map((b) => b.textContent)).toEqual(['All rooms', 'Living room', 'Wall moulding']);
    fireEvent.click(within(crumbs).getByRole('button', { name: 'Living room' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Living room');
  });

  it('goes up a page with Escape, then out of the room', async () => {
    await renderIn('living');
    goTo('Wall moulding');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Living room');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(stored().room).toBe('all');
  });
});

describe('camera views', () => {
  const views = () => within(screen.getByRole('group', { name: 'Camera views' }));

  it('marks the view the camera is on, and offers a way back once the user moves it', async () => {
    await renderIn('bedroom');
    const main = mainView('bedroom').name;
    const other = VIEWS.find((v) => v.room === 'bedroom' && v.name !== main)!.name;
    expect(views().getByRole('button', { name: main })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(views().getByRole('button', { name: other }));
    expect(views().getByRole('button', { name: other })).toHaveAttribute('aria-pressed', 'true');
    expect(views().getByRole('button', { name: main })).toHaveAttribute('aria-pressed', 'false');
    const onCameraMove = createApartmentScene.mock.calls.at(-1)![5] as () => void;
    await act(async () => onCameraMove());
    expect(views().queryAllByRole('button', { pressed: true })).toHaveLength(0);
    fireEvent.click(views().getByRole('button', { name: 'Reset view' }));
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('bedroom').pose);
    expect(views().getByRole('button', { name: mainView('bedroom').name })).toHaveAttribute('aria-pressed', 'true');
  });

  it('picks a view with a number key and the room view with Home on the focused canvas', async () => {
    const { container } = await renderIn('bedroom');
    const canvas = container.querySelector('canvas')!;
    expect(canvas).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(canvas, { key: '2' });
    expect(scene.setView).toHaveBeenLastCalledWith(VIEWS.filter((v) => v.room === 'bedroom')[1].pose);
    fireEvent.keyDown(canvas, { key: 'Home' });
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('bedroom').pose);
  });

  it('says what a click in 3D did', async () => {
    await renderIn('all');
    await click3d('living');
    expect(screen.getByText('Living room selected')).toBeInTheDocument();
    await click3d('living', ['moulding', 'sofa']);
    expect(screen.getByText(/^Opened Wall moulding/)).toBeInTheDocument();
  });
});
