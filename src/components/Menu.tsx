import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

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
  /** the heading over the rows, when the page has controls of its own above them */
  topicsTitle?: string;
  /** shown at the bottom of the page */
  footer?: ReactNode;
}

interface Props {
  /** the first page: a summary of every topic */
  root: Topic;
  /** the way out of the first page */
  exit: { text: string; label: string; onExit: () => void };
}

/**
 * A drill-down menu: the first page lists its topics with a summary of each, and choosing one opens its page with a way
 * back. The open page is kept only while the menu is mounted, so it starts over at the first page for each room.
 */
export function Menu({ root, exit }: Props) {
  const [path, setPath] = useState<string[]>([]);
  const trail: Topic[] = [root];
  for (const id of path) {
    const next = trail.at(-1)!.topics?.find((t) => t.id === id);
    if (!next) break;
    trail.push(next);
  }
  const page = trail.at(-1)!;
  /* rows keep their titles in line: a page with any swatch leaves room for one on every row */
  const swatches = !!page.topics?.some((t) => t.swatch);
  const parent = trail.at(-2);
  /** where the menu is, as a key that changes with every move */
  const at = trail.map((t) => t.id).join('/');

  const heading = useRef<HTMLHeadingElement>(null);
  const rows = useRef<HTMLUListElement>(null);
  /* where focus goes after a move: the new page's heading, or the row of the page just left */
  const focusAfter = useRef<string | null>(null);
  const open = (id: string) => {
    focusAfter.current = null;
    setPath(trail.slice(1).map((t) => t.id).concat(id));
  };
  const up = () => {
    focusAfter.current = page.id;
    setPath(trail.slice(1, -1).map((t) => t.id));
  };
  /* each page starts at its top: the panel scrolls on its own beside the stage, or with the page under a sticky stage */
  useLayoutEffect(() => {
    const panel = heading.current?.closest<HTMLElement>('.panel');
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
      {parent ? (
        <button type="button" className="back" aria-label={`Back to ${parent.title}`} onClick={up}>
          <span aria-hidden="true">←</span> {parent.title}
        </button>
      ) : (
        <button type="button" className="back" aria-label={exit.label} onClick={exit.onExit}>
          <span aria-hidden="true">←</span> {exit.text}
        </button>
      )}
      <h1 ref={heading} tabIndex={-1}>
        {page.title}
      </h1>
      {page.sub && <p className="sub">{page.sub}</p>}
      {page.content}
      {page.topics && page.topics.length > 0 && (
        <section>
          {page.topicsTitle && <h2>{page.topicsTitle}</h2>}
          <ul ref={rows} className="topics" aria-label={page.topicsTitle ?? `${page.title} options`}>
            {page.topics.map((t) => (
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
        </section>
      )}
      {page.footer}
    </>
  );
}
