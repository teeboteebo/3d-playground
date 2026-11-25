import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentState } from '../data/components';
import { ROOMS } from '../data/rooms';
import type { RoomTree } from '../data/tree';
import type { PlacedLeaf } from '../scene/rigidPlacement';
import { RoomPlan } from './RoomPlan';

const room = ROOMS.find((r) => r.id === 'living')!;
const xs = room.poly.map((p) => p[0]);
const zs = room.poly.map((p) => p[1]);
const x0 = Math.min(...xs) + 1;
const z0 = Math.min(...zs) + 1;
const leaf = (dx: number, over: Partial<PlacedLeaf> = {}): PlacedLeaf => ({
  footprint: [[x0 + dx, z0], [x0 + dx + 0.5, z0], [x0 + dx + 0.5, z0 + 0.4], [x0 + dx, z0 + 0.4]],
  bottom: 0, top: 0.75, mount: { kind: 'floor' }, obstructs: true, ...over,
});
const on: ComponentState = { shown: true, variant: 'v', options: {} };
const tree: RoomTree = { root: ['set', 'sofa'], groups: { set: { name: 'TV set', children: ['tv', 'tv-bench'] } } };
const poses = new Map([['tv', leaf(0)], ['tv-bench', leaf(0.5)], ['sofa', leaf(2, { top: 0.8 })]]);
const components = { tv: on, 'tv-bench': on, sofa: on, shelving: { ...on, shown: false } };

const setup = (extra = {}) => {
  const onClose = vi.fn();
  render(<RoomPlan room={room} tree={tree} poses={poses} components={components} onClose={onClose} {...extra} />);
  return onClose;
};

describe('RoomPlan', () => {
  it('draws each visible piece on its own, not a group box', () => {
    setup();
    expect(document.querySelectorAll('polygon.room-plan__piece')).toHaveLength(3);
  });

  it('selecting a group selects every member and lists their sizes and gaps', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /TV set/ }));
    expect(document.querySelectorAll('.room-plan__piece--sel')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Inspect members' }));
    expect(screen.getAllByText('50 × 40 × 75 cm')).toHaveLength(2);
    expect(screen.getAllByText(/to wall: /).length).toBeGreaterThan(0);
  });

  it('enters a group and says what is hidden', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(screen.getByRole('button', { name: 'Up to room' })).toBeInTheDocument();
    expect(document.querySelectorAll('.room-plan__piece--scope')).toHaveLength(2);
  });

  it('is honest about pieces without a position or state', async () => {
    setup({ tree: { root: ['shelving', 'tv', 'bed'], groups: {} }, components: { ...components, tv: on } });
    expect(screen.getByText('Hidden — not drawn')).toBeInTheDocument();
    expect(screen.getByText('Unknown piece')).toBeInTheDocument();
  });

  it('opens on a given selection and closes with the button or Escape', async () => {
    const onClose = setup({ initialSelection: 'tv' });
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Frame TV' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to 3D' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Escape leaves one group first, claims the event, then closes', async () => {
    const onClose = setup();
    const seen = vi.fn();
    window.addEventListener('keydown', seen);
    await userEvent.click(screen.getByRole('button', { name: 'Enter' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Up to room' })).toBeNull();
    expect(seen.mock.calls.at(-1)![0].defaultPrevented).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', seen);
  });
});
