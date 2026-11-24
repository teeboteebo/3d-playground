import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RoomDef } from '../data/components';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { LIVING } from '../data/living';
import { componentGroups, componentTopic } from './componentTopic';

const def = (id: string, group?: string) => ({
  id, name: id, category: 'furniture' as 'furniture' | 'lighting' | 'decor', group, variants: [{ id: 'a', name: 'A' }], initial: { shown: true, variant: 'a' },
});

describe('componentGroups', () => {
  it('lists a component of an undeclared group as ungrouped', () => {
    const room: RoomDef = { id: 'office', groups: [{ id: 'g', name: 'G' }], components: [def('x', 'g'), def('y', 'missing'), def('z')] };
    const [furniture] = componentGroups(room, (c) => ({ id: c.id, title: c.name, summary: '' }));
    expect(furniture.topics.map((t) => t.id)).toEqual(['y', 'z']);
    expect(furniture.groups?.map((g) => g.topics.map((t) => t.id))).toEqual([['x']]);
  });

  it('lists the categories as Lighting, Furniture, Textiles and decor, whatever order the room defines them', () => {
    const room: RoomDef = {
      id: 'office',
      components: [{ ...def('r'), category: 'decor' }, def('f'), { ...def('l'), category: 'lighting' }],
    };
    expect(componentGroups(room, (c) => ({ id: c.id, title: c.name, summary: '' })).map((g) => g.title)).toEqual([
      'Lighting', 'Furniture', 'Textiles and decor',
    ]);
  });

  it('leaves out a category with no component', () => {
    const room: RoomDef = { id: 'office', components: [def('f'), { ...def('l'), category: 'lighting' }] };
    expect(componentGroups(room, (c) => ({ id: c.id, title: c.name, summary: '' })).map((g) => g.title)).toEqual(['Lighting', 'Furniture']);
  });
});

describe('componentTopic swatch', () => {
  const sofa = LIVING.components.find((c) => c.id === 'sofa')!;
  const f = BEMZ_FABRICS[0];
  const state = (shown: boolean, fabric: string) => ({ shown, variant: 'nockeby', options: { fabric } });

  it('shows the fabric colour while the piece is shown', () => {
    expect(componentTopic(sofa, state(true, f.code), () => {}).swatch).toBe(f.hex);
  });

  it('holds the swatch column when the piece is hidden, without showing its colour', () => {
    const t = componentTopic(sofa, state(false, f.code), () => {});
    expect(t.swatch).toBeUndefined();
    expect(t.swatchSpace).toBe(true);
  });

  it('has no column to hold for the original fabric', () => {
    expect(componentTopic(sofa, state(false, 'original'), () => {}).swatchSpace).toBe(false);
  });

  it('sets one option at a time', () => {
    const set = vi.fn();
    render(<>{componentTopic(sofa, state(true, 'original'), set).content}</>);
    fireEvent.click(screen.getByRole('button', { name: `${f.family}, ${f.colour}` }));
    expect(set).toHaveBeenCalledWith({ options: { fabric: f.code } });
  });
});
