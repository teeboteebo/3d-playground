import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VIEWS, mainView } from '../data/catalog';
import { DEFAULTS, STORAGE_KEY, type Settings } from '../state/settings';
import { App } from './App';

const scene = { apply: vi.fn(), setView: vi.fn(), dispose: vi.fn() };
const createBedroomScene = vi.fn<(...args: unknown[]) => typeof scene>(() => scene);

vi.mock('../scene/createScene', () => ({
  createBedroomScene: (...args: unknown[]) => createBedroomScene(...args),
}));

const lastApplied = (): Settings => scene.apply.mock.calls.at(-1)![0];
const stored = (): Settings => JSON.parse(localStorage.getItem(STORAGE_KEY)!);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  createBedroomScene.mockImplementation(() => scene);
});

/** render with a room already selected, as a returning visitor would have it */
const renderIn = (room: Settings['room']) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ room }));
  return render(<App />);
};
const roomList = () => screen.getByRole('list', { name: 'Rooms' });
const back = () => screen.getByRole('button', { name: 'Back to all rooms' });
const viewNames = () => within(screen.getByRole('group', { name: 'Camera views' })).getAllByRole('button').map((b) => b.textContent);

describe('App', () => {
  it('creates the scene with the saved settings and disposes it on unmount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rug: 'rista', time: 'eve' }));
    const { unmount } = render(<App />);
    expect(createBedroomScene).toHaveBeenCalledTimes(1);
    expect(createBedroomScene.mock.calls[0][2]).toMatchObject({ rug: 'rista', time: 'eve' });
    unmount();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
  });

  it('applies and persists chip selections', async () => {
    const user = userEvent.setup();
    renderIn('bedroom');
    const painting = screen.getByRole('group', { name: 'Painting' });
    await user.click(within(painting).getByRole('button', { name: 'Hills' }));
    expect(within(painting).getByRole('button', { name: 'Hills' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(painting).getByRole('button', { name: 'Clay sun' })).toHaveAttribute('aria-pressed', 'false');
    expect(lastApplied().art).toBe('hills');
    expect(stored().art).toBe('hills');
  });

  it('toggles lighting and the pendant', async () => {
    const user = userEvent.setup();
    renderIn('bedroom');
    const daynight = screen.getByRole('switch', { name: 'Evening lighting' });
    expect(daynight).toHaveAttribute('aria-checked', 'false');
    await user.click(daynight);
    expect(lastApplied().time).toBe('eve');
    expect(daynight).toHaveAttribute('aria-checked', 'true');
    await user.click(daynight);
    expect(lastApplied().time).toBe('day');
    await user.click(screen.getByRole('button', { name: 'Pendant on' }));
    expect(screen.getByRole('button', { name: 'Pendant off' })).toHaveAttribute('aria-pressed', 'false');
    expect(lastApplied().pendant).toBe('off');
  });

  it('moves the camera to a preset view', async () => {
    const user = userEvent.setup();
    renderIn('bedroom');
    await user.click(screen.getByRole('button', { name: 'Top down' }));
    expect(scene.setView).toHaveBeenCalledWith(VIEWS.find((v) => v.name === 'Top down')!.pose);
  });

  it('accepts valid accent hex input and rejects invalid input', async () => {
    const user = userEvent.setup();
    renderIn('bedroom');
    const hex = screen.getByRole('textbox', { name: 'Accent hex' });
    await user.clear(hex);
    await user.type(hex, '2f5d62{Enter}');
    expect(lastApplied().accent).toBe('#2F5D62');
    expect(screen.getByRole('button', { name: 'Petrol' })).toHaveAttribute('aria-pressed', 'true');
    expect(hex).toHaveValue('#2F5D62');

    await user.clear(hex);
    await user.type(hex, 'zzz{Enter}');
    expect(lastApplied().accent).toBe('#2F5D62');
    expect(hex).toHaveValue('#2F5D62');
  });

  it('pillow "Accent" swatch follows the accent colour', async () => {
    const user = userEvent.setup();
    renderIn('bedroom');
    await user.click(screen.getByRole('button', { name: 'Mustard' }));
    const accentPillow = within(screen.getByRole('group', { name: 'Pillows and throw' })).getByRole('button', { name: 'Accent' });
    expect(accentPillow.querySelector('.dot')).toHaveStyle({ background: '#C49A3A' });
  });

  it('disables the bed-wall layout sliders when bed-wall moulding is hidden', async () => {
    const user = userEvent.setup();
    renderIn('bedroom');
    const slider = screen.getByRole('slider', { name: /Column spacing/ });
    expect(slider).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Bed wall' }));
    expect(slider).toBeDisabled();
    expect(screen.getByTestId('bed-wall-layout')).toHaveClass('off');
    expect(lastApplied().mouldB).toBe('off');
  });

  it('selects a rug by click or keyboard, but not via its shop link', async () => {
    const user = userEvent.setup();
    renderIn('bedroom');
    const rug = screen.getByText('Palma, green vines').closest('.rug') as HTMLElement;
    await user.click(within(rug).getByRole('link'));
    expect(lastApplied().rug).toBe(DEFAULTS.rug);
    await user.click(rug);
    expect(rug).toHaveAttribute('aria-pressed', 'true');
    expect(lastApplied().rug).toBe('palma');

    const none = screen.getByText('No rug').closest('.rug') as HTMLElement;
    none.focus();
    await user.keyboard('{Enter}');
    expect(lastApplied().rug).toBe('none');
  });

  it('shows the WebGL fallback and keeps the panel working when the scene cannot be created', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createBedroomScene.mockImplementation(() => {
      throw new Error('no webgl');
    });
    const user = userEvent.setup();
    renderIn('bedroom');
    expect(screen.getByRole('alert')).toHaveTextContent('needs WebGL');
    await user.click(screen.getByRole('button', { name: 'Arches' }));
    expect(stored().art).toBe('arches');
  });

  it('shows the apartment controls when no room is selected', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Apartment' })).toBeInTheDocument();
    expect(within(roomList()).getAllByRole('button')).toHaveLength(4);
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('all').pose);
  });

  it('has no room switcher and no way back when already at all rooms', () => {
    render(<App />);
    expect(screen.queryByRole('group', { name: 'Room' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to all rooms' })).toBeNull();
  });

  it('goes back to all rooms from a room', async () => {
    const user = userEvent.setup();
    renderIn('living');
    await user.click(back());
    expect(lastApplied().room).toBe('all');
    expect(screen.getByRole('heading', { name: 'Apartment' })).toBeInTheDocument();
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('all').pose);
  });

  it("selects a room from the room list and shows that room's controls", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(roomList()).getByRole('button', { name: /Living room/ }));
    expect(screen.getByRole('group', { name: 'Furniture' })).toBeInTheDocument();
    expect(lastApplied().room).toBe('living');
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('living').pose);
  });

  it('selects the room clicked in 3D, and deselects on a click outside', async () => {
    render(<App />);
    const onPick = createBedroomScene.mock.calls[0][3] as (room: string | null) => void;
    await act(async () => onPick('hall'));
    expect(lastApplied().room).toBe('hall');
    expect(screen.getByRole('heading', { name: 'Hall' })).toBeInTheDocument();
    await act(async () => onPick(null));
    expect(lastApplied().room).toBe('all');
  });

  it('keeps the camera where it is when a room is picked in 3D', async () => {
    render(<App />);
    const onPick = createBedroomScene.mock.calls[0][3] as (room: string | null) => void;
    scene.setView.mockClear();
    await act(async () => onPick('hall'));
    await act(async () => onPick('living'));
    await act(async () => onPick(null));
    expect(lastApplied().room).toBe('all');
    expect(scene.setView).not.toHaveBeenCalled();
  });

  it('still flies from the sidebar after a 3D pick that changed nothing', async () => {
    const user = userEvent.setup();
    render(<App />);
    const onPick = createBedroomScene.mock.calls[0][3] as (room: string | null) => void;
    await act(async () => onPick(null)); // already at all rooms
    await user.click(within(roomList()).getByRole('button', { name: /Living room/ }));
    expect(scene.setView).toHaveBeenLastCalledWith(mainView('living').pose);
  });

  it('hides living-room furniture and repaints a room', async () => {
    const user = userEvent.setup();
    renderIn('living');
    await user.click(within(screen.getByRole('group', { name: 'Furniture' })).getByRole('checkbox', { name: 'Sofa' }));
    expect(lastApplied().hidden).toEqual(['sofa']);
    await user.click(back());
    await user.click(within(roomList()).getByRole('button', { name: /Hall/ }));
    await user.click(within(screen.getByRole('group', { name: 'Wall colour' })).getByRole('button', { name: 'Chalk white' }));
    expect(lastApplied().walls.hall).toBe('chalk');
  });

  it('offers no floor choice in any room', async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const name of ['Bedroom', 'Hall', 'Living room', 'End room']) {
      await user.click(within(roomList()).getByRole('button', { name: new RegExp(name) }));
      expect(screen.queryByRole('group', { name: 'Floor' })).toBeNull();
      await user.click(back());
    }
  });

  it('offers the Jotun wall colours', async () => {
    const user = userEvent.setup();
    renderIn('end');
    const walls = screen.getByRole('group', { name: 'Wall colour' });
    expect(within(walls).getByRole('button', { name: 'Devine 12083' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(walls).getByRole('button', { name: 'Froströk 1376' }));
    expect(lastApplied().walls.end).toBe('frostrok');
  });

  it('shows the camera views for the selection', () => {
    const { unmount } = render(<App />);
    expect(viewNames()).toEqual(['Apartment', 'Foot of bed', 'Hall', 'Living room', 'End room']);
    unmount();
    renderIn('bedroom');
    expect(viewNames()).toEqual(['Overview', 'Foot of bed', 'Wardrobe wall', 'Dresser wall', 'Top down']);
  });

  it('only offers the pendant in the bedroom', () => {
    const { unmount } = render(<App />);
    expect(screen.queryByRole('button', { name: /Pendant/ })).toBeNull();
    unmount();
    renderIn('bedroom');
    expect(screen.getByRole('button', { name: 'Pendant on' })).toBeInTheDocument();
  });
});
