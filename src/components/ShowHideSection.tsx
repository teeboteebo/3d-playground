import type { TopicGroup } from './Menu';
import { ToggleRow } from './ToggleRow';

interface Props {
  /** the room's pieces under its headings, as the room's first page lists them (only their ids and titles are used) */
  groups: TopicGroup[];
  shown: (id: string) => boolean;
  /** shows or hides several pieces at once, as one change */
  set: (ids: string[], shown: boolean) => void;
  /** the piece under the mouse or focus, so the 3D view can show it (null when it leaves) */
  point?: (id: string | null) => void;
}

const idsOf = (g: TopicGroup): string[] => [...g.topics.map((t) => t.id), ...(g.groups ?? []).flatMap(idsOf)];

/** Every piece of a room with a switch of its own, under the room's headings, and a way to show or hide them all. */
export function ShowHideSection({ groups, shown, set, point }: Props) {
  const all = groups.flatMap(idsOf);
  const hidden = all.filter((id) => !shown(id));
  return (
    <section>
      <div className="show-all">
        <button type="button" className="chip" disabled={hidden.length === 0} onClick={() => set(hidden, true)}>
          Show all
        </button>
        <button type="button" className="chip" disabled={hidden.length === all.length} onClick={() => set(all.filter(shown), false)}>
          Hide all
        </button>
      </div>
      {groups.map((g) => (
        <Group key={g.title} group={g} level={2} shown={shown} set={set} point={point} />
      ))}
    </section>
  );
}

function Group({ group, level, shown, set, point }: { group: TopicGroup; level: 2 | 3 } & Omit<Props, 'groups'>) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section className="group">
      <Heading>{group.title}</Heading>
      {group.topics.length > 0 && (
        <div className="toggle-list" role="group" aria-label={group.title}>
          {group.topics.map((t) => (
            <ToggleRow
              key={t.id}
              label={t.title}
              hint={shown(t.id) ? 'Shown' : 'Hidden'}
              checked={shown(t.id)}
              onChange={(on) => set([t.id], on)}
              onPoint={point && ((on) => point(on ? t.id : null))}
            />
          ))}
        </div>
      )}
      {group.groups?.map((g) => (
        <Group key={g.title} group={g} level={3} shown={shown} set={set} point={point} />
      ))}
    </section>
  );
}
