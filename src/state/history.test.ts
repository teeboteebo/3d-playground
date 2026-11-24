import { describe, expect, it } from 'vitest';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { MERGE_MS, change, patchKey, redo, startHistory, undo } from './history';
import { DEFAULTS } from './settings';

const paint = (walls: string) => ({ walls: { ...DEFAULTS.walls, bedroom: walls } });

describe('history', () => {
  it('names the fields a patch changes, room fields by room', () => {
    expect(patchKey({ walls: DEFAULTS.walls })).toBe('walls');
    expect(patchKey({ living: { mouldSpacing: 9, mouldDado: 80 } })).toBe('living.mouldDado,living.mouldSpacing');
    expect(patchKey({ office: { components: { desk: { shown: false } } } })).toBe('office.components.desk.shown');
  });

  it('names each option of a component on its own', () => {
    expect(patchKey({ living: { components: { sofa: { shown: true, options: { fabric: 'x', cushions: 'y' } } } } })).toBe(
      'living.components.sofa.options.cushions,living.components.sofa.options.fabric,living.components.sofa.shown',
    );
  });

  it('keeps quick changes to two options of one piece as two steps', () => {
    let h = startHistory(DEFAULTS);
    h = change(h, { living: { components: { sofa: { options: { fabric: BEMZ_FABRICS[0].code } } } } }, 0);
    h = change(h, { living: { components: { sofa: { shown: false } } } }, 10);
    expect(h.past).toHaveLength(2);
    h = undo(h);
    expect(h.present.living.components.sofa).toEqual({ shown: true, variant: 'nockeby', options: { fabric: BEMZ_FABRICS[0].code } });
  });

  it('keeps quick changes to two different office pieces as two steps', () => {
    let h = startHistory(DEFAULTS);
    h = change(h, { office: { components: { desk: { shown: false } } } }, 0);
    h = change(h, { office: { components: { dresser: { shown: false } } } }, 10);
    expect(h.past).toHaveLength(2);
    h = undo(h);
    expect(h.present.office.components.desk.shown).toBe(false);
    expect(h.present.office.components.dresser.shown).toBe(true);
  });

  it('undoes and redoes a design change', () => {
    let h = startHistory(DEFAULTS);
    h = change(h, paint('a'), 0);
    h = change(h, { bedroom: { rug: 'none' } }, 10_000);
    expect(h.past).toHaveLength(2);
    h = undo(h);
    expect(h.present.bedroom.rug).toBe(DEFAULTS.bedroom.rug);
    expect(h.present.walls.bedroom).toBe('a');
    h = undo(h);
    expect(h.present.walls).toEqual(DEFAULTS.walls);
    expect(undo(h)).toBe(h);
    h = redo(redo(h));
    expect(h.present.bedroom.rug).toBe('none');
    expect(redo(h)).toBe(h);
  });

  it('makes one step of quick changes to the same fields, as a slider drag makes', () => {
    let h = startHistory(DEFAULTS);
    for (let i = 0; i < 5; i++) h = change(h, { living: { mouldSpacing: 9 + i } }, i * 50);
    expect(h.past).toHaveLength(1);
    h = change(h, { living: { mouldSpacing: 20 } }, 200 + MERGE_MS);
    expect(h.past).toHaveLength(2);
    expect(undo(undo(h)).present.living.mouldSpacing).toBe(DEFAULTS.living.mouldSpacing);
  });

  it('does not step on a change of room or light, and undo keeps the room and light the user is in', () => {
    let h = startHistory(DEFAULTS);
    h = change(h, { room: 'living' }, 0);
    h = change(h, { time: 'eve' }, 1);
    expect(h.past).toHaveLength(0);
    h = change(h, paint('a'), 2);
    h = change(h, { room: 'office' }, 3);
    h = undo(h);
    expect(h.present.room).toBe('office');
    expect(h.present.time).toBe('eve');
    expect(h.present.walls).toEqual(DEFAULTS.walls);
  });

  it('forgets what was undone once something new is changed', () => {
    let h = change(startHistory(DEFAULTS), paint('a'), 0);
    h = undo(h);
    h = change(h, paint('b'), 5000);
    expect(h.future).toHaveLength(0);
  });
});
