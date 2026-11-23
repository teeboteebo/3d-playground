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
    await user.click(screen.getByRole('button', { name: 'Mustard' }));
    const accentPillow = within(screen.getByRole('group', { name: 'Pillows and throw' })).getByRole('button', { name: 'Accent' });
    expect(accentPillow.querySelector('.dot')).toHaveStyle({ background: '#C49A3A' });
  });

  it('sets the room spacing and dado height', async () => {
    await renderIn('bedroom');
    const room = within(screen.getByTestId('bedroom-mould-room'));
    fireEvent.change(room.getByRole('slider', { name: /^Spacing/ }), { target: { value: '12' } });
    expect(lastApplied().bedroom.mouldSpacing).toBe(12);
    fireEvent.change(room.getByRole('slider', { name: /^Dado height/ }), { target: { value: '90' } });
    expect(lastApplied().bedroom.mouldDado).toBe(90);
  });

  it('overrides a wall spacing and goes back to the room spacing', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
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
    const tv = within(screen.getByTestId('mould-tv'));
    expect(lastApplied().living.mouldWalls.tv.fixedColumn).toBe(2);
    const roomSpacing = within(screen.getByTestId('living-mould-room')).getByRole('slider', { name: /^Spacing/ });
    fireEvent.change(roomSpacing, { target: { value: (roomSpacing as HTMLInputElement).max } });
    expect(lastApplied().living.mouldSpacing).toBeGreaterThan(8);
    expect(lastApplied().living.mouldWalls.tv.fixedColumn).toBe(2);
    fireEvent.change(tv.getByRole('slider', { name: /^Columns/ }), { target: { value: '1' } });
    expect(lastApplied().living.mouldWalls.tv.fixedColumn).toBe(0);
    expect(lastApplied().living.mouldWalls.tv.columns).toBe(1);
  });

  it('offers "Centred on bed" on the bed wall only', async () => {
    await renderIn('bedroom');
    expect(within(screen.getByTestId('mould-bed')).getByRole('button', { name: 'Centred on bed' })).toBeInTheDocument();
    expect(screen.getByTestId('mould-dresserWindow')).toBeInTheDocument();
    // a dresser section with a fixed column shows its position chips, but not the bed one
    fireEvent.change(within(screen.getByTestId('mould-dresserWindow')).getByRole('combobox'), { target: { value: '1' } });
    const win = within(screen.getByTestId('mould-dresserWindow'));
    expect(win.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
    expect(win.queryByRole('button', { name: 'Centred on bed' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Centred on bed' })).toHaveLength(1);
  });

  it('disables the position chips while the fixed column\'s centre is forced', async () => {
    await renderIn('bedroom');
    const win = within(screen.getByTestId('mould-dresserWindow'));
    fireEvent.change(win.getByRole('combobox'), { target: { value: '1' } });
    for (const name of ['Even', 'Custom']) expect(win.getByRole('button', { name })).toBeDisabled();
    // a middle column of the bed wall can still move
    const bed = within(screen.getByTestId('mould-bed'));
    expect(bed.getByRole('button', { name: 'Custom' })).toBeEnabled();
  });

  it('disables a section\'s controls with its wall', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    const bed = screen.getByTestId('mould-bed');
    expect(bed).not.toHaveClass('off');
    expect(within(bed).getByRole('slider', { name: /^Columns/ })).toBeEnabled();
    await user.click(within(screen.getByRole('group', { name: 'Show moulding on' })).getByRole('button', { name: 'Bed wall' }));
    expect(bed).toHaveClass('off');
    expect(within(bed).getByRole('slider', { name: /^Columns/ })).toBeDisabled();
    expect(within(bed).getByRole('combobox')).toBeDisabled();
    expect(screen.getByTestId('mould-dresserWindow')).not.toHaveClass('off');
    expect(lastApplied().bedroom.mouldBedWall).toBe('off');
  });

  it('labels each section and shows how many columns fit', async () => {
    await renderIn('bedroom');
    expect(screen.getByRole('group', { name: 'Dresser wall: By the window' })).toBe(screen.getByTestId('mould-dresserWindow'));
    expect(screen.getByRole('group', { name: 'Bed wall' })).toBe(screen.getByTestId('mould-bed'));
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
    const walls = within(screen.getByRole('group', { name: 'Show moulding on' }));
    const sofa = screen.getByTestId('mould-sofa');
    const tv = screen.getByTestId('mould-tv');
    await user.click(walls.getByRole('button', { name: /TV wall/ }));
    expect(lastApplied().living.mouldTvWall).toBe('off');
    expect(tv).toHaveClass('off');
    expect(sofa).not.toHaveClass('off');
    expect(within(sofa).getByRole('slider', { name: /^Columns/ })).toBeEnabled();
    expect(within(tv).getByRole('slider', { name: /^Columns/ })).toBeDisabled();
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
    await user.click(within(screen.getByRole('group', { name: 'Furniture' })).getByRole('checkbox', { name: 'Sofa' }));
    expect(lastApplied().living.hidden).toEqual(['sofa']);
    await user.click(back());
    await user.click(within(roomList()).getByRole('button', { name: /Hall/ }));
    await user.click(within(screen.getByRole('group', { name: 'Wall colour' })).getByRole('button', { name: 'Chalk white' }));
    expect(lastApplied().walls.hall).toBe('chalk');
  });

  it('shows the office with its furniture note', async () => {
    await renderIn('office');
    expect(screen.getByRole('heading', { name: 'Office' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Furniture' })).toBeVisible();
    expect(screen.getByText(/METOD/)).toBeVisible();
    expect(screen.getByText(/IDÅSEN/)).toBeVisible();
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
    expect(screen.getByRole('button', { name: 'Pendant on' })).toBeInTheDocument();
  });
});

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe.each(['living', 'office'] as const)('lighting in the %s', (room) => {
  it('offers pendants and floor lamps and applies the choice', async () => {
    await renderIn(room);
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
    expect(screen.getByRole('heading', { name: 'Reading corner' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name });
    await userEvent.click(within(group).getByRole('button', { name: new RegExp(esc(items[2].name)) }));
    expect(lastApplied().office[key]).toBe(items[2].id);
    expect(stored().office[key]).toBe(items[2].id);
  });
  it.each(lists)('does not select in the %s list when a shop link is clicked', async (name, items, key) => {
    await renderIn('office');
    const card = within(screen.getByRole('group', { name })).getByRole('button', { name: new RegExp(esc(items[2].name)) });
    const link = within(card).getByRole('link');
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(lastApplied().office[key]).toBe(DEFAULTS.office[key]);
  });
});

it('still lists the bedroom rugs', async () => {
  await renderIn('bedroom');
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
    await user.type(search(), f.family);
    const labels = within(grid()).getAllByRole('button').map((b) => b.getAttribute('aria-label')!);
    expect(labels.length).toBeGreaterThan(1);
    for (const l of labels.filter((x) => x !== 'Original fabric')) expect(l).toContain(f.family);
  });

  it('selects a fabric, applies and stores it, and shows its price and link', async () => {
    const user = userEvent.setup();
    await renderIn('living');
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
    await user.click(within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` }));
    await user.type(search(), 'zzzz');
    expect(screen.getByText('No fabrics match')).toBeInTheDocument();
    expect(own()).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View on Bemz/ })).toHaveAttribute('href', fabricUrl(f));
  });

  it('shows 24 fabrics and 24 more on request', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    expect(within(grid()).getAllByRole('button')).toHaveLength(25);
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(within(grid()).getAllByRole('button')).toHaveLength(49);
  });

  it('goes back to the original fabric', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    await user.click(within(grid()).getByRole('button', { name: `${f.family}, ${f.colour}` }));
    await user.click(own());
    expect(lastApplied().living.sofaFabric).toBe('original');
    expect(screen.getByText("The sofa's own dark grey")).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View on Bemz/ })).not.toBeInTheDocument();
  });
});
