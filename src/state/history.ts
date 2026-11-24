import { applyPatch, type Settings, type SettingsPatch } from './settings';

/**
 * The settings with the steps that led to them, for undo and redo. Only the design is remembered: which room is open
 * and the time of day are where the user is looking, so undo leaves them as they are and changing them is no step.
 */
export interface History {
  past: Settings[];
  present: Settings;
  future: Settings[];
  /** what the last step changed, and when: changes to the same fields close together (a slider drag) are one step */
  last: { key: string; at: number } | null;
}

/** how close together changes to the same fields must come to be one step, ms */
export const MERGE_MS = 800;
/** steps kept */
export const LIMIT = 100;

/** the part of the settings undo looks at */
const design = (s: Settings) => JSON.stringify({ ...s, room: null, time: null });

/**
 * the fields a patch changes, as a key: "walls", "living.mouldWalls,living.mouldSpacing", and for a room's components each
 * component's own fields, and each option on its own: "office.components.desk.shown", "living.components.sofa.options.fabric"
 */
export function patchKey(p: SettingsPatch): string {
  return Object.entries(p)
    .flatMap(([k, v]) => {
      if (!v || (k !== 'bedroom' && k !== 'living' && k !== 'office')) return [k];
      return Object.entries(v).flatMap(([f, sub]) =>
        f === 'components' && sub && typeof sub === 'object'
          ? Object.entries(sub).flatMap(([id, fields]) =>
              Object.entries(fields ?? {}).flatMap(([x, value]) =>
                x === 'options' && value && typeof value === 'object'
                  ? Object.keys(value).map((o) => `${k}.components.${id}.options.${o}`)
                  : [`${k}.components.${id}.${x}`],
              ),
            )
          : [`${k}.${f}`],
      );
    })
    .sort()
    .join(',');
}

export const startHistory = (present: Settings): History => ({ past: [], present, future: [], last: null });

/** apply a change; one that changes the design is a step that can be undone */
export function change(h: History, patch: SettingsPatch, at: number): History {
  const next = applyPatch(h.present, patch);
  if (design(next) === design(h.present)) return { ...h, present: next };
  const key = patchKey(patch);
  const merge = h.last !== null && h.last.key === key && at - h.last.at < MERGE_MS && h.past.length > 0;
  return {
    past: merge ? h.past : [...h.past, h.present].slice(-LIMIT),
    present: next,
    future: [],
    last: { key, at },
  };
}

/** the design as it was before the last step, seen from the room and light the user is in now */
export function undo(h: History): History {
  const prev = h.past.at(-1);
  if (!prev) return h;
  return { past: h.past.slice(0, -1), present: { ...prev, room: h.present.room, time: h.present.time }, future: [h.present, ...h.future], last: null };
}

export function redo(h: History): History {
  const next = h.future[0];
  if (!next) return h;
  return { past: [...h.past, h.present], present: { ...next, room: h.present.room, time: h.present.time }, future: h.future.slice(1), last: null };
}
