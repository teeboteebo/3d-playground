import { describe, expect, it } from 'vitest';
import { FLOOR_LAMPS, PENDANTS } from './catalog';
import type { RoomDef } from './components';
import { CATALOG_LAMPS, ROOM_DEFS, catalogLamps } from './roomDefs';

describe('catalog lamps', () => {
  it('are the marked ceiling lights and floor lamps of the living room and office', () => {
    expect(CATALOG_LAMPS).toEqual([
      { room: 'living', id: 'ceiling-light', kind: 'pendant' },
      { room: 'living', id: 'floor-lamp', kind: 'floor' },
      { room: 'office', id: 'ceiling-light', kind: 'pendant' },
      { room: 'office', id: 'floor-lamp', kind: 'floor' },
    ]);
  });

  it('draw only products from the lamp catalogs', () => {
    const lists = { pendant: PENDANTS, floor: FLOOR_LAMPS };
    for (const { room, id, kind } of CATALOG_LAMPS) {
      const c = ROOM_DEFS[room].components.find((x) => x.id === id)!;
      expect(c.variants).toBe(lists[kind]);
    }
  });

  it('leave out a room light that is not marked, whatever it is called', () => {
    const bedroom: RoomDef = {
      id: 'bedroom',
      components: [
        { id: 'ceiling-light', name: 'Pendant', category: 'lighting', variants: [{ id: 'own', name: 'Own' }], initial: { shown: true, variant: 'own' } },
      ],
    };
    expect(catalogLamps([bedroom])).toEqual([]);
    expect(catalogLamps([bedroom, ROOM_DEFS.office]).map((l) => l.room)).toEqual(['office', 'office']);
  });
});
