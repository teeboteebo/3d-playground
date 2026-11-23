import { BEDX } from '../scene/bedroom/dimensions';
import { wallLayouts, type MouldWallDef } from '../scene/mouldWalls';
import type { Settings } from '../state/settings';
import type { Update } from '../state/useSettings';
import type { Topic } from './Menu';
import { MouldSectionControls } from './MouldSectionControls';
import { MouldingRoomControls, type MouldFields, type MouldRoom } from './MouldingSection';

const COLOUR_SHORT: Record<MouldFields['mouldColour'], string> = { white: 'White', tone: 'Wall tone' };

/**
 * The room's wall moulding as a menu page: colour, which walls carry it and the room's spacing and dado on the page
 * itself, and a page of its own for each wall section's columns.
 */
export function mouldingTopic(room: MouldRoom, walls: MouldWallDef<string>[], settings: Settings, update: Update): Topic {
  const b: MouldFields = settings[room];
  const set = (patch: Partial<MouldFields>) => update({ [room]: patch } as Parameters<Update>[0]);
  const layouts = walls.map((def) => wallLayouts(def, { spacing: b.mouldSpacing, dado: b.mouldDado }, b.mouldWalls, room === 'bedroom' ? BEDX : undefined));
  const onWalls = walls.filter((w) => b[w.toggle] === 'on').map((w) => w.label);
  return {
    id: 'moulding',
    title: 'Wall moulding',
    summary: onWalls.length ? `${COLOUR_SHORT[b.mouldColour]} · ${onWalls.join(', ')}` : 'Off',
    sub: 'Panel moulding split by a rail at dado height. Each wall section has its own spacing and columns.',
    content: <MouldingRoomControls room={room} walls={walls} b={b} layouts={layouts} set={set} />,
    topicsTitle: 'Walls',
    topics: walls.flatMap((def, wi) =>
      def.sections.map((sec, si): Topic => {
        const on = b[def.toggle] === 'on';
        const wall = b.mouldWalls[sec.key];
        const layout = layouts[wi][si];
        const label = def.sections.length === 1 ? def.label : `${def.label}: ${sec.label}`;
        const columns = layout.count === 1 ? '1 column' : `${layout.count} columns`;
        return {
          id: sec.key,
          title: label,
          summary: on ? `${columns} · ${wall.spacing ?? b.mouldSpacing} cm spacing` : 'Hidden',
          content: (
            <MouldSectionControls
              def={sec}
              label={label}
              wall={wall}
              layout={layout}
              roomSpacing={b.mouldSpacing}
              on={on}
              onChange={(w) => set({ mouldWalls: { ...b.mouldWalls, [sec.key]: w } })}
            />
          ),
        };
      }),
    ),
  };
}

