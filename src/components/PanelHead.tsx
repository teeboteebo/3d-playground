/** a page above the open one */
export interface Crumb {
  title: string;
  /** the accessible name, for the page just above ("Back to Wall moulding") */
  label?: string;
}

interface Props {
  /** the pages above the open one, outermost first */
  crumbs: readonly Crumb[];
  /** goes to the crumb at `i` */
  onCrumb: (i: number) => void;
}

/** The panel's header, kept in view while a page scrolls: every page above the open one, each a way back up. */
export function PanelHead({ crumbs, onCrumb }: Props) {
  return (
    <div className="panel-head">
      <nav aria-label="Breadcrumb" className="crumbs">
        <span className="crumb-arrow" aria-hidden="true">
          ←
        </span>
        <ol>
          {crumbs.map((c, i) => (
            <li key={i}>
              <button type="button" className="crumb" aria-label={c.label} onClick={() => onCrumb(i)}>
                {c.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
