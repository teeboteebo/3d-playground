import { describe, expect, it } from 'vitest';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { MERGE_MS, change, patchKey, redo, startHistory, undo } from './history';
import { DEFAULTS } from './settings';

const paint = (paint: string) => ({ rooms: { bedroom: { paint } } });

describe('history', () => {
  it('names the fields a patch changes, room fields by room', () => {
    expect(patchKey({ rooms: { hall: { paint: 'chalk' } } })).toBe('rooms.hall.paint');
    expect(patchKey({ rooms: { living: { moulding: { mouldSpacing: 9, mouldDado: 80 } } } })).toBe('rooms.living.moulding.mouldDado,rooms.living.moulding.mouldSpacing');
    expect(patchKey({ rooms: { office: { components: { desk: { shown: false } } } } })).toBe('rooms.office.components.desk.shown');
    expect(patchKey({ time: 'eve', mouldShop: DEFAULTS.mouldShop })).toBe('mouldShop,time');
  });

  it('names each option of a component on its own', () => {
    expect(patchKey({ rooms: { living: { components: { sofa: { shown: true, options: { fabric: 'x', cushions: 'y' } } } } } })).toBe(
      'rooms.living.components.sofa.options.cushions,rooms.living.components.sofa.options.fabric,rooms.living.components.sofa.shown',
    );
  });

  it('keeps quick changes to two options of one piece as two steps', () => {
    let h = startHistory(DEFAULTS);
    h = change(h, { rooms: { living: { components: { sofa: { options: { fabric: BEMZ_FABRICS[0].code } } } } } }, 0);
    h = change(h, { rooms: { living: { components: { sofa: { shown: false } } } } }, 10);
    expect(h.past).toHaveLength(2);
    h = undo(h);
    expect(h.present.rooms.living.components.sofa).toEqual({ shown: true, variant: 'nockeby', options: { fabric: BEMZ_FABRICS[0].code } });
  });

  it('keeps quick changes to two different office pieces as two steps', () => {
    let h = startHistory(DEFAULTS);
    h = change(h, { rooms: { office: { components: { desk: { shown: false } } } } }, 0);
    h = change(h, { rooms: { office: { components: { dresser: { shown: false } } } } }, 10);
    expect(h.past).toHaveLength(2);
    h = undo(h);
    expect(h.present.rooms.office.components.desk.shown).toBe(false);
    expect(h.present.rooms.office.components.dresser.shown).toBe(true);
  });

  it('undoes and redoes a design change', () => {
    let h = startHistory(DEFAULTS);
    h = change(h, paint('a'), 0);
    h = change(h, { rooms: { bedroom: { components: { rug: { shown: false } } } } }, 10_000);
    expect(h.past).toHaveLength(2);
    h = undo(h);
    expect(h.present.rooms.bedroom.components.rug.shown).toBe(true);
    expect(h.present.rooms.bedroom.paint).toBe('a');
    h = undo(h);
    expect(h.present.rooms).toEqual(DEFAULTS.rooms);
    expect(undo(h)).toBe(h);
    h = redo(redo(h));
    expect(h.present.rooms.bedroom.components.rug.shown).toBe(false);
    expect(redo(h)).toBe(h);
  });

  it('makes one step of quick changes to the same fields, as a slider drag makes', () => {
    let h = startHistory(DEFAULTS);
    for (let i = 0; i < 5; i++) h = change(h, { rooms: { living: { moulding: { mouldSpacing: 9 + i } } } }, i * 50);
    expect(h.past).toHaveLength(1);
    h = change(h, { rooms: { living: { moulding: { mouldSpacing: 20 } } } }, 200 + MERGE_MS);
    expect(h.past).toHaveLength(2);
    expect(undo(undo(h)).present.rooms.living.moulding.mouldSpacing).toBe(DEFAULTS.rooms.living.moulding.mouldSpacing);
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
    expect(h.present.rooms).toEqual(DEFAULTS.rooms);
  });

  it('forgets what was undone once something new is changed', () => {
    let h = change(startHistory(DEFAULTS), paint('a'), 0);
    h = undo(h);
    h = change(h, paint('b'), 5000);
    expect(h.future).toHaveLength(0);
  });

  it('undoes the art and the frame as separate steps', () => {
    let h = startHistory(DEFAULTS);
    h = change(h, { rooms: { bedroom: { components: { painting: { options: { art: 'hills' } } } } } }, 0);
    h = change(h, { rooms: { bedroom: { components: { painting: { options: { frame: 'oak' } } } } } }, 10);
    expect(h.past).toHaveLength(2);
    h = undo(h);
    expect(h.present.rooms.bedroom.components.painting.options).toMatchObject({ art: 'hills', frame: DEFAULTS.rooms.bedroom.components.painting.options.frame });
    h = undo(h);
    expect(h.present.rooms.bedroom.components.painting.options).toEqual(DEFAULTS.rooms.bedroom.components.painting.options);
  });

  it('undoes hiding every piece at once as one step', () => {
    const ids = Object.keys(DEFAULTS.rooms.bedroom.components);
    const hide = Object.fromEntries(ids.map((id) => [id, { shown: false }]));
    const h = change(startHistory(DEFAULTS), { rooms: { bedroom: { components: hide } } }, 0);
    expect(h.past).toHaveLength(1);
    expect(Object.values(h.present.rooms.bedroom.components).some((c) => c.shown)).toBe(false);
    expect(undo(h).present.rooms).toEqual(DEFAULTS.rooms);
  });
});
