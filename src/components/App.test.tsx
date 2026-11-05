import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VIEWS } from '../data/catalog';
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
  createBedroomScene.mockImplementation(() => scene);
});

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
    render(<App />);
    const painting = screen.getByRole('group', { name: 'Painting' });
    await user.click(within(painting).getByRole('button', { name: 'Hills' }));
    expect(within(painting).getByRole('button', { name: 'Hills' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(painting).getByRole('button', { name: 'Clay sun' })).toHaveAttribute('aria-pressed', 'false');
    expect(lastApplied().art).toBe('hills');
    expect(stored().art).toBe('hills');
  });

  it('toggles lighting and the pendant', async () => {
    const user = userEvent.setup();
    render(<App />);
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
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Top down' }));
    expect(scene.setView).toHaveBeenCalledWith(VIEWS.find((v) => v.name === 'Top down')!.pose);
  });

  it('accepts valid accent hex input and rejects invalid input', async () => {
    const user = userEvent.setup();
    render(<App />);
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
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Mustard' }));
    const accentPillow = within(screen.getByRole('group', { name: 'Pillows and throw' })).getByRole('button', { name: 'Accent' });
    expect(accentPillow.querySelector('.dot')).toHaveStyle({ background: '#C49A3A' });
  });

  it('disables the bed-wall layout sliders when bed-wall moulding is hidden', async () => {
    const user = userEvent.setup();
    render(<App />);
    const slider = screen.getByRole('slider', { name: /Column spacing/ });
    expect(slider).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Bed wall' }));
    expect(slider).toBeDisabled();
    expect(screen.getByTestId('bed-wall-layout')).toHaveClass('off');
    expect(lastApplied().mouldB).toBe('off');
  });

  it('selects a rug by click or keyboard, but not via its shop link', async () => {
    const user = userEvent.setup();
    render(<App />);
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
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('needs WebGL');
    await user.click(screen.getByRole('button', { name: 'Arches' }));
    expect(stored().art).toBe('arches');
  });
});
