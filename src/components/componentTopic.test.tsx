import { describe, expect, it } from 'vitest';
import type { RoomDef } from '../data/components';
import { componentGroups } from './componentTopic';

const def = (id: string, group?: string) => ({
  id, name: id, category: 'furniture' as const, group, variants: [{ id: 'a', name: 'A' }], initial: { shown: true, variant: 'a' },
});

describe('componentGroups', () => {
  it('lists a component of an undeclared group as ungrouped', () => {
    const room: RoomDef = { id: 'office', groups: [{ id: 'g', name: 'G' }], components: [def('x', 'g'), def('y', 'missing'), def('z')] };
    const [furniture] = componentGroups(room, (c) => ({ id: c.id, title: c.name, summary: '' }));
    expect(furniture.topics.map((t) => t.id)).toEqual(['y', 'z']);
    expect(furniture.groups?.map((g) => g.topics.map((t) => t.id))).toEqual([['x']]);
  });
});
