import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { SECTIONS, type MenuSection } from './menuStructure';
import { PanelHead, type Crumb } from './PanelHead';

/** One page of the side panel: its own controls, and deeper pages listed as rows under them. */
export interface Topic {
  id: string;
  title: string;
  /** one line on the current choice, shown on this topic's row in its parent page */
  summary: string;
  /** a colour shown on the row */
  swatch?: string;
  /** shown under the page heading */
  sub?: ReactNode;
  /** the page's own controls */
  content?: ReactNode;
  /** deeper pages, listed as rows below the content */
  topics?: Topic[];
  /** rows under headings, shown after `topics` */
  groups?: TopicGroup[];
  /** the heading over the rows, when the page has controls of its own above them */
  topicsTitle?: string;
  /** shown at the bottom of the page */
  footer?: ReactNode;
  /** puts this page's choices back to how the room started; left out while they are as they started */
  reset?: () => void;
  /** the section of a room's first page this row sits in (null: after every section); see menuStructure */
  section?: MenuSection | null;
}

/** the rows of a page under their headings: the room sections in their order, then rows with none */
function sectioned(page: Topic): { title?: string; topics: Topic[] }[] {
  const topics = page.topics ?? [];
  if (!topics.some((t) => t.section !== undefined)) return [{ title: page.topicsTitle, topics }];
  return [
    ...SECTIONS.map((s) => ({ title: s.title, topics: topics.filter((t) => t.section === s.id) })),
    { title: undefined, topics: topics.filter((t) => !t.section) },
  ].filter((g) => g.topics.length > 0);
}

/** a heading over rows on a page; one level of sub-groups inside it */
export interface TopicGroup {
  title: string;
  topics: Topic[];
  groups?: TopicGroup[];
}

const groupTopics = (g: TopicGroup): Topic[] => [...g.topics, ...(g.groups ?? []).flatMap(groupTopics)];
/** every page opened from a page: its own rows and those under its headings, to any depth */
const childTopics = (page: Topic): Topic[] => [...(page.topics ?? []), ...(page.groups ?? []).flatMap(groupTopics)];

/** where a menu is: the ids of the topics opened from the first page, and the way to open another page */
export interface MenuNav {
  path: readonly string[];
  go(path: readonly string[]): void;
}

interface Props {
  /** the first page: a summary of every topic */
  root: Topic;
  /** the open page, kept by the app so a click in 3D can open one */
  nav: MenuNav;
  /** the way out of the first page */
  exit: { text: string; label: string; onExit: () => void };
}

/**
 * A drill-down menu: the first page lists its topics with a summary of each, and choosing one opens its page with a way
 * back. A path that names no page (any more) stops at the last page it finds.
 */
export function Menu({ root, exit, nav }: Props) {
  const { path, go: setPath } = nav;
  const trail: Topic[] = [root];
  for (const id of path) {
    const next = childTopics(trail.at(-1)!).find((t) => t.id === id);
    if (!next) break;
    trail.push(next);
  }
  const page = trail.at(-1)!;
  /* a page's sectioned rows line up across their sections: any swatch leaves room for one on every row */
  const swatches = !!page.topics?.some((t) => t.swatch);
  const parent = trail.at(-2);
  /** where the menu is, as a key that changes with every move */
  const at = trail.map((t) => t.id).join('/');

  const heading = useRef<HTMLHeadingElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  /* where focus goes after a move: the new page's heading, or the row of the page just left */
  const focusAfter = useRef<string | null>(null);
  const open = (id: string) => {
    focusAfter.current = null;
    setPath(trail.slice(1).map((t) => t.id).concat(id));
  };
  /* up to the page at `i` in the trail, focusing the row of the page left on the way */
  function upTo(i: number) {
    focusAfter.current = trail[i + 1].id;
    setPath(trail.slice(1, i + 1).map((t) => t.id));
  }
  /* the way out of the room, then every page above this one; the last is the way back */
  const crumbs: Crumb[] = [
    { title: exit.text, label: parent ? undefined : exit.label },
    ...trail.slice(0, -1).map((t, i, above): Crumb => ({ title: t.title, label: i === above.length - 1 ? `Back to ${t.title}` : undefined })),
  ];
  /* crumb 0 is the way out of the room; crumb k is the page at k - 1 in the trail */
  const onCrumb = (k: number) => {
    if (k === 0) exit.onExit();
    else upTo(k - 1);
  };
  /* each page starts at its top: the panel scrolls on its own beside the stage, or with the page under a sticky stage */
  useLayoutEffect(() => {
    const panel = heading.current?.closest<HTMLElement>('.panel-body');
    if (!panel) return;
    if (getComputedStyle(panel).overflowY !== 'visible') {
      panel.scrollTo?.({ top: 0 });
      return;
    }
    const below = document.querySelector('.stage-wrap')?.getBoundingClientRect().bottom ?? 0;
    const top = panel.getBoundingClientRect().top;
    if (top < below) window.scrollBy?.({ top: top - below });
  }, [at]);
  const shown = useRef(at);
  useEffect(() => {
    if (shown.current === at) return;
    shown.current = at;
    const left = focusAfter.current;
    const row = left && [...(rows.current?.querySelectorAll<HTMLElement>('[data-topic]') ?? [])].find((r) => r.dataset.topic === left);
    (row || heading.current)?.focus({ preventScroll: true });
  }, [at]);

  return (
    <>
      <PanelHead crumbs={crumbs} onCrumb={onCrumb} />
      <h1 ref={heading} tabIndex={-1}>
        {page.title}
      </h1>
      {page.sub && <p className="sub">{page.sub}</p>}
      {page.content}
      <div ref={rows}>
        {page.groups?.map((g) => (
          <GroupSection key={g.title} group={g} level={2} open={open} />
        ))}
        {sectioned(page).map((group, gi) => (
          <section key={group.title ?? `rest-${gi}`}>
            {group.title && <h2>{group.title}</h2>}
            <RowList title={group.title ?? `${page.title} options`} topics={group.topics} open={open} swatches={swatches} />
          </section>
        ))}
      </div>
      {page.footer}
      {page.reset && (
        <p className="reset">
          <button type="button" className="linkish" onClick={page.reset}>
            Reset {page.title.toLowerCase()}
          </button>
        </p>
      )}
    </>
  );
}

/** a list of rows; they keep their titles in line: a list with any swatch (or `swatches`, for lists that line up with each other) leaves room for one on every row */
function RowList({ title, topics, open, swatches = topics.some((t) => t.swatch) }: { title: string; topics: Topic[]; open: (id: string) => void; swatches?: boolean }) {
  return (
    <ul className="topics" aria-label={title}>
      {topics.map((t) => (
        <li key={t.id}>
          <button type="button" className="topic" data-topic={t.id} onClick={() => open(t.id)}>
            {swatches && <i className={t.swatch ? undefined : 'blank'} style={{ background: t.swatch }} aria-hidden="true" />}
            <span>
              <strong>{t.title}</strong> <small>{t.summary}</small>
            </span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** a heading over its rows, then its sub-groups under smaller headings */
function GroupSection({ group, level, open }: { group: TopicGroup; level: 2 | 3; open: (id: string) => void }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section>
      <Heading>{group.title}</Heading>
      {group.topics.length > 0 && <RowList title={group.title} topics={group.topics} open={open} />}
      {group.groups?.map((g) => (
        <GroupSection key={g.title} group={g} level={3} open={open} />
      ))}
    </section>
  );
}
