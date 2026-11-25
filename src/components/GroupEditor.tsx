import { useState } from 'react';
import { isGroup, leavesOf, type RoomTree } from '../data/tree';
import { selectedLeaves, type Editor } from '../state/useEditor';

interface Props {
  roomName: string;
  editor: Editor & { tree: RoomTree };
  /** the name of a piece */
  pieceName: (id: string) => string;
  shown: (piece: string) => boolean;
  /** opens a piece's own page */
  open: (piece: string) => void;
}

/**
 * The room's pieces as a tree the user edits: a checklist of what is in the group they are inside (the room to begin
 * with), to select, enter, group, ungroup, rename and show or hide, all without the 3D view or a pointer.
 */
export function GroupEditor({ roomName, editor, pieceName, shown, open }: Props) {
  const { tree, parent, selected } = editor;
  const nameOf = (id: string) => (isGroup(tree, id) ? tree.groups[id].name : pieceName(id));
  const path: string[] = [];
  for (let p = parent; p !== null; p = Object.keys(tree.groups).find((g) => tree.groups[g].children.includes(p!)) ?? null) path.unshift(p);
  const here = parent === null ? tree.root : tree.groups[parent].children;
  const leaves = selectedLeaves(tree, selected);
  const single = selected.length === 1 && isGroup(tree, selected[0]) ? selected[0] : null;
  const anyGroup = selected.some((id) => isGroup(tree, id));
  const state = (id: string) => {
    const l = leavesOf(tree, id);
    const on = l.filter(shown).length;
    return on === l.length ? 'Shown' : on === 0 ? 'Hidden' : 'Partly hidden';
  };

  return (
    <section className="group-editor">
      <nav aria-label="Where you are" className="crumbs-line">
        <span>{[roomName, ...path.map((g) => tree.groups[g].name)].join(' › ')}</span>
        {parent !== null && (
          <button type="button" className="chip" onClick={editor.leave}>
            Leave group
          </button>
        )}
      </nav>
      <ul className="node-list" aria-label={`Pieces and groups in ${parent === null ? roomName : tree.groups[parent].name}`}>
        {here.map((id) => {
          const group = isGroup(tree, id);
          return (
            <li key={id} className="node-row">
              <label>
                <input type="checkbox" checked={selected.includes(id)} onChange={() => editor.toggle(id)} />
                <span>
                  <strong>{nameOf(id)}</strong>
                  <small>{group ? `Group of ${leavesOf(tree, id).length} · ${state(id)}` : state(id)}</small>
                </span>
              </label>
              {group ? (
                <button type="button" className="chip" aria-label={`Enter ${nameOf(id)}`} onClick={() => editor.enter(id)}>
                  Enter
                </button>
              ) : (
                <button type="button" className="chip" aria-label={`Options for ${nameOf(id)}`} onClick={() => open(id)}>
                  Options
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="show-all">
        <button type="button" className="chip" disabled={selected.length < 2} onClick={() => editor.group()}>
          Group selected
        </button>
        <button type="button" className="chip" disabled={!anyGroup} onClick={editor.ungroup}>
          Ungroup
        </button>
      </div>
      <div className="show-all">
        <button type="button" className="chip" disabled={leaves.every(shown)} onClick={() => editor.setShown(leaves.filter((l) => !shown(l)), true)}>
          Show selection
        </button>
        <button type="button" className="chip" disabled={!leaves.some(shown)} onClick={() => editor.setShown(leaves.filter(shown), false)}>
          Hide selection
        </button>
      </div>
      {single && <RenameForm key={single + tree.groups[single].name} name={tree.groups[single].name} onRename={(n) => editor.rename(single, n)} />}
    </section>
  );
}

function RenameForm({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  return (
    <form
      className="rename"
      onSubmit={(e) => {
        e.preventDefault();
        onRename(draft);
      }}
    >
      <label>
        <span>Group name</span>
        <input type="text" value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} />
      </label>
      <button type="submit" className="chip" disabled={!draft.trim() || draft.trim() === name}>
        Rename
      </button>
    </form>
  );
}
