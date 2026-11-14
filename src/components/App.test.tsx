import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FLOOR_LAMPS, PENDANTS, RUGS, VIEWS, mainView } from '../data/catalog';
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

  it('disables the bed-wall layout sliders when bed-wall moulding is hidden', async () => {
    const user = userEvent.setup();
    await renderIn('bedroom');
    const slider = screen.getByRole('slider', { name: /Column spacing/ });
    expect(slider).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Bed wall' }));
    expect(slider).toBeDisabled();
    expect(screen.getByTestId('bed-wall-layout')).toHaveClass('off');
    expect(lastApplied().bedroom.mouldBedWall).toBe('off');
  });

  it('changes the living-room moulding', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    await user.click(within(screen.getByRole('group', { name: 'Show moulding on' })).getByRole('button', { name: /TV wall/ }));
    expect(lastApplied().living.mouldTvWall).toBe('off');
    fireEvent.change(screen.getByRole('slider', { name: /Centre width/ }), { target: { value: '160' } });
    expect(lastApplied().living.mouldCentre).toBe(160);
  });

  it('greys out the living layout only when both walls are off', async () => {
    const user = userEvent.setup();
    await renderIn('living');
    const walls = within(screen.getByRole('group', { name: 'Show moulding on' }));
    const slider = screen.getByRole('slider', { name: /Column spacing/ });
    await user.click(walls.getByRole('button', { name: /Sofa wall/ }));
    expect(slider).toBeEnabled();
    await user.click(walls.getByRole('button', { name: /TV wall/ }));
    expect(slider).toBeDisabled();
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

it('still lists the bedroom rugs', async () => {
  await renderIn('bedroom');
  expect(within(screen.getByRole('group', { name: 'Rug' })).getAllByRole('button')).toHaveLength(RUGS.length);
});
