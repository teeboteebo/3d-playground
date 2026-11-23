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

const scene = { apply: vi.fn(), setView: vi.fn(), dispose: vi.fn() };
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
  const rows = screen.getAllByRole('button', { name: new RegExp(`^${esc(title)}( |$)`) }).filter((b) => b.dataset.topic);
  expect(rows).toHaveLength(1);
  return rows[0];
};
/** open a room's menu pages in turn, by the titles on their rows */
const goTo = (...titles: string[]) => {
  for (const t of titles) fireEvent.click(row(t));
};
/** go up one page of a room's menu */
const up = (to: string) => fireEvent.click(screen.getByRole('button', { name: `Back to ${to}` }));
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
    goTo('Ceiling pendant');
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
    goTo('Dresser wall: By the window');
    // a dresser section with a fixed column shows its position chips, but not the bed one
    fireEvent.change(within(screen.getByTestId('mould-dresserWindow')).getByRole('combobox'), { target: { value: '1' } });
    const win = within(screen.getByTestId('mould-dresserWindow'));
    expect(win.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
    expect(win.queryByRole('button', { name: 'Centred on bed' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Centred on bed' })).toBeNull();
  });

  it('disables the position chips while the fixed column\'s centre is forced', async () => {
    await renderIn('bedroom');
    goTo('Wall moulding', 'Dresser wall: By the window');
    const win = within(screen.getByTestId('mould-dresserWindow'));
    fireEvent.change(win.getByRole('combobox'), { target: { value: '1' } });
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
    goTo('Dresser wall: By the window');
    expect(screen.getByTestId('mould-dresserWindow')).not.toHaveClass('off');
    expect(lastApplied().bedroom.mouldBedWall).toBe('off');
  });

  it('labels each section and shows how many columns fit', async () => {
    await renderIn('bedroom');
    goTo('Wall moulding', 'Bed wall');
    expect(screen.getByRole('group', { name: 'Bed wall' })).toBe(screen.getByTestId('mould-bed'));
    up('Wall moulding');
    goTo('Dresser wall: By the window');
    expect(screen.getByRole('group', { name: 'Dresser wall: By the window' })).toBe(screen.getByTestId('mould-dresserWindow'));
    const win = within(screen.getByTestId('mould-dresserWindow'));
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
    goTo('Furniture');
    expect(screen.getByRole('group', { name: 'Furniture' })).toBeInTheDocument();
    expect(lastApplied().room).toBe('living');
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('living').pose);
  });

  it('selects the room clicked in 3D, and deselects on a click outside', async () => {
    await renderApp();
    const onPick = createApartmentScene.mock.calls[0][3] as (room: string | null) => void;
    await act(async () => onPick('hall'));
    expect(lastApplied().room).toBe('hall');
    expect(screen.getByRole('heading', { name: 'Hall' })).toBeInTheDocument();
    await act(async () => onPick(null));
    expect(lastApplied().room).toBe('all');
  });

  it('moves only the pivot, not the rotation or zoom, when a room is picked in 3D', async () => {
    await renderApp();
    const onPick = createApartmentScene.mock.calls[0][3] as (room: string | null) => void;
    const pivot = (sel: 'hall' | 'all') => {
      const { tx, ty, tz } = mainView(sel).pose;
      return { tx, ty, tz };
    };
    await act(async () => onPick('hall'));
    expect(scene.setView).toHaveBeenLastCalledWith(pivot('hall'));
    await act(async () => onPick(null));
    expect(lastApplied().room).toBe('all');
    expect(scene.setView).toHaveBeenLastCalledWith(pivot('all'));
  });

  it('leaves the camera alone when a 3D pick changes nothing', async () => {
    await renderApp();
    const onPick = createApartmentScene.mock.calls[0][3] as (room: string | null) => void;
    scene.setView.mockClear();
    await act(async () => onPick(null)); // already at all rooms
    expect(scene.setView).not.toHaveBeenCalled();
  });

  it('still flies from the sidebar after a 3D pick that changed nothing', async () => {
    const user = userEvent.setup();
    await renderApp();
    const onPick = createApartmentScene.mock.calls[0][3] as (room: string | null) => void;
    await act(async () => onPick(null)); // already at all rooms
    await user.click(within(roomList()).getByRole('button', { name: /Living room/ }));
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('living').pose);
  });

  it('hides living-room furniture and repaints a room', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Furniture');
    await user.click(within(screen.getByRole('group', { name: 'Furniture' })).getByRole('checkbox', { name: 'Sofa' }));
    expect(lastApplied().living.hidden).toEqual(['sofa']);
    up('Living room');
    expect(row('Furniture')).toHaveTextContent(/5 of 6 shown|\d+ of \d+ shown/);
    await user.click(back());
    await user.click(within(roomList()).getByRole('button', { name: /Hall/ }));
    goTo('Walls');
    await user.click(within(screen.getByRole('group', { name: 'Wall colour' })).getByRole('button', { name: 'Chalk white' }));
    expect(lastApplied().walls.hall).toBe('chalk');
  });

  it('shows the office with its furniture note', async () => {
    await renderIn('office');
    expect(screen.getByRole('heading', { name: 'Office' })).toBeVisible();
    goTo('Furniture');
    expect(screen.getByRole('heading', { name: 'Furniture' })).toBeVisible();
    expect(screen.getByText(/METOD high cabinets/)).toBeVisible();
    expect(screen.getByText(/IDÅSEN desk/)).toBeVisible();
    up('Office');
    goTo('Walls');
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
    expect(row('Walls')).toHaveTextContent('Devine 12083');
    goTo('Walls');
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
    goTo('Ceiling pendant');
    expect(screen.getByRole('button', { name: 'Pendant on' })).toBeInTheDocument();
  });
});

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe.each(['living', 'office'] as const)('lighting in the %s', (room) => {
  it('offers pendants and floor lamps and applies the choice', async () => {
    await renderIn(room);
    goTo('Lighting');
    const pendants = screen.getByRole('group', { name: 'Pendant' });
    await userEvent.click(within(pendants).getByRole('button', { name: new RegExp(esc(PENDANTS[1].name)) }));
    expect(lastApplied()[room].pendant).toBe(PENDANTS[1].id);
    expect(stored()[room].pendant).toBe(PENDANTS[1].id);
    const floor = screen.getByRole('group', { name: 'Floor lamp' });
    await userEvent.click(within(floor).getByRole('button', { name: new RegExp(esc(FLOOR_LAMPS[1].name)) }));
    expect(lastApplied()[room].floorLamp).toBe(FLOOR_LAMPS[1].id);
    expect(lastApplied()[room].pendant).toBe(PENDANTS[1].id);
  });
  it('does not select a lamp when its shop link is clicked', async () => {
    await renderIn(room);
    goTo('Lighting');
    const link = within(screen.getByRole('group', { name: 'Pendant' })).getAllByRole('link')[0];
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(lastApplied()[room].pendant).toBe('none');
  });
});

describe('reading corner in the office', () => {
  const lists = [
    ['Reading chair', READING_CHAIRS, 'readingChair'],
    ['Dresser', DRESSERS, 'dresser'],
    ['Round rug', ROUND_RUGS, 'roundRug'],
  ] as const;
  it.each(lists)('offers the %s list and applies the choice', async (name, items, key) => {
    await renderIn('office');
    goTo('Reading corner');
    expect(screen.getByRole('heading', { name: 'Reading corner' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name });
    await userEvent.click(within(group).getByRole('button', { name: new RegExp(esc(items[2].name)) }));
    expect(lastApplied().office[key]).toBe(items[2].id);
    expect(stored().office[key]).toBe(items[2].id);
  });
  it.each(lists)('does not select in the %s list when a shop link is clicked', async (name, items, key) => {
    await renderIn('office');
    goTo('Reading corner');
    const card = within(screen.getByRole('group', { name })).getByRole('button', { name: new RegExp(esc(items[2].name)) });
    const link = within(card).getByRole('link');
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(lastApplied().office[key]).toBe(DEFAULTS.office[key]);
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
    goTo('Sofa fabric');
    await user.type(search(), f.family);
    const labels = within(grid()).getAllByRole('button').map((b) => b.getAttribute('aria-label')!);
    expect(labels.length).toBeGreaterThan(1);
    for (const l of labels.filter((x) => x !== 'Original fabric')) expect(l).toContain(f.family);
  });

  it('selects a fabric, applies and stores it, and shows its price and link', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa fabric');
    const btn = within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` });
    await user.click(btn);
    expect(lastApplied().living.sofaFabric).toBe(f.code);
    expect(stored().living.sofaFabric).toBe(f.code);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(new RegExp(fabricPrice(f).replace(/[()]/g, '\\$&')))).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /View on Bemz/ });
    expect(link).toHaveAttribute('href', fabricUrl(f));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('says so when nothing matches, and still shows the selected fabric', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa fabric');
    await user.click(within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` }));
    await user.type(search(), 'zzzz');
    expect(screen.getByText('No fabrics match')).toBeInTheDocument();
    expect(own()).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View on Bemz/ })).toHaveAttribute('href', fabricUrl(f));
  });

  it('shows 24 fabrics and 24 more on request', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa fabric');
    expect(within(grid()).getAllByRole('button')).toHaveLength(25);
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(within(grid()).getAllByRole('button')).toHaveLength(49);
  });

  it('goes back to the original fabric', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    goTo('Sofa fabric');
    await user.click(within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` }));
    await user.click(own());
    expect(lastApplied().living.sofaFabric).toBe('original');
    expect(screen.getByText("The sofa's own dark grey")).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View on Bemz/ })).not.toBeInTheDocument();
  });
});

describe('room menu', () => {
  const rowTitles = () =>
    within(screen.getByRole('list', { name: /options$/ }))
      .getAllByRole('button')
      .map((b) => b.querySelector('strong')!.textContent);

  it('opens a room on a summary of its options, with no controls on it', async () => {
    await renderIn('bedroom');
    expect(rowTitles()).toEqual([
      'Walls', 'Ceiling pendant', 'Accent colour', 'Wall moulding', 'Wardrobes', 'Pillows and throw', 'Painting', 'Rug', 'About the room',
    ]);
    expect(row('Wall moulding')).toHaveTextContent('White · Bed wall, Dresser wall');
    expect(row('Painting')).toHaveTextContent('Clay sun · brass frame');
    expect(screen.queryByRole('group', { name: 'Show moulding on' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Wall colour' })).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('lists the other rooms\' options', async () => {
    const { unmount } = await renderIn('living');
    expect(rowTitles()).toEqual(['Walls', 'Lighting', 'Sofa fabric', 'Wall moulding', 'Furniture']);
    expect(row('Lighting')).toHaveTextContent('No lamps');
    expect(row('Sofa fabric')).toHaveTextContent('Original');
    unmount();
    await renderIn('office');
    expect(rowTitles()).toEqual(['Walls', 'Lighting', 'Reading corner', 'Furniture']);
  });

  it('keeps the moulding walls a level below the moulding page', async () => {
    await renderIn('bedroom');
    goTo('Wall moulding');
    expect(screen.getByRole('heading', { level: 1, name: 'Wall moulding' })).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Show moulding on' })).toBeInTheDocument();
    expect(screen.queryByTestId('mould-bed')).toBeNull();
    const walls = within(screen.getByRole('list', { name: 'Walls' })).getAllByRole('button');
    expect(walls.map((b) => b.querySelector('strong')!.textContent)).toEqual([
      'Bed wall', 'Dresser wall: By the window', 'Dresser wall: Mirror to door', 'Dresser wall: Door to corner',
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
    const onPick = createApartmentScene.mock.calls[0][3] as (room: string | null) => void;
    await act(async () => onPick('living'));
    expect(screen.getByRole('heading', { level: 1, name: 'Living room' })).toBeInTheDocument();
    await act(async () => onPick('bedroom'));
    expect(screen.getByRole('heading', { level: 1, name: 'Bedroom' })).toBeInTheDocument();
    expect(back()).toBeInTheDocument();
  });
});
