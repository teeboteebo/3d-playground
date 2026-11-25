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
    await userEvent.keyboard('{Escape}{Escape}');
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

  it('draws rugs beneath furniture whatever the tree order, and numbers every piece', () => {
    const rugTree: RoomTree = { root: ['chair', 'rug'], groups: {} };
    const rugPoses = new Map([
      ['chair', leaf(0.1, { top: 0.9 })],
      ['rug', leaf(0, { top: 0.02, obstructs: false })],
    ]);
    setup({ tree: rugTree, poses: rugPoses, components: { chair: on, rug: on } });
    const labels = [...document.querySelectorAll('polygon.room-plan__piece')].map((p) => p.getAttribute('aria-label'));
    expect(labels).toEqual(['2. Rug', '1. chair']);
    expect(screen.getByRole('button', { name: /^1 chair/ })).toBeInTheDocument();
  });

  it('picking a piece outside the open group leaves the group, like the 3D editor', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Enter' }));
    await userEvent.click(screen.getByRole('button', { name: /^3\. / }));
    expect(screen.queryByRole('button', { name: 'Up to room' })).toBeNull();
    expect(screen.getByRole('heading', { name: /^Sofa/ })).toBeInTheDocument();
  });

  it('falls back to the room when undo removes the open group or selection', async () => {
    const { rerender } = render(<RoomPlan room={room} tree={tree} poses={poses} components={components} onClose={() => {}} initialSelection="tv" />);
    expect(screen.getByRole('button', { name: 'Up to room' })).toBeInTheDocument();
    rerender(<RoomPlan room={room} tree={{ root: ['tv', 'tv-bench', 'sofa'], groups: {} }} poses={poses} components={components} onClose={() => {}} initialSelection="tv" />);
    expect(screen.queryByRole('button', { name: 'Up to room' })).toBeNull();
    rerender(<RoomPlan room={room} tree={{ root: ['sofa'], groups: {} }} poses={poses} components={components} onClose={() => {}} initialSelection="tv" />);
    expect(screen.queryByRole('heading', { name: 'Frame TV' })).toBeNull();
    expect(document.querySelectorAll('.room-plan__piece--sel')).toHaveLength(0);
  });

  it('numbers the walls and keys doors, windows and doorways present in the room', () => {
    setup();
    expect(screen.getAllByText(/^Wall \d/).length).toBe(room.poly.length);
    const key = screen.getByText('Map key').nextElementSibling as HTMLElement;
    expect(within(key).getByText('Doorway')).toBeInTheDocument();
    expect(within(key).getByText('Window')).toBeInTheDocument();
    for (const t of document.querySelectorAll('svg text')) expect((t as SVGElement).style.strokeWidth).not.toBe('3px');
  });
});
