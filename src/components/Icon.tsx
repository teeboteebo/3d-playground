import type { IconName } from '../data/catalog';

const PATHS: Record<IconName, React.ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </>
  ),
  moon: <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.8 6.8 0 0 0 9.7 9.7z" />,
  pendant: (
    <>
      <path d="M12 2.5v6" />
      <path d="M5 17.5a7 7 0 0 1 14 0z" />
      <path d="M10 20.5h4" />
    </>
  ),
  overview: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </>
  ),
  bed: (
    <>
      <path d="M3 18V6.5M3 14h18v4M21 14v-2.2a2.8 2.8 0 0 0-2.8-2.8H11v5" />
      <circle cx="7" cy="11" r="1.6" />
    </>
  ),
  wardrobe: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.2" />
      <path d="M12 3v18M10 12v1.5M14 12v1.5" />
    </>
  ),
  dresser: (
    <>
      <rect x="4" y="4.5" width="16" height="12" rx="1.2" />
      <path d="M4 8.5h16M4 12.5h16M7 16.5V20M17 16.5V20" />
    </>
  ),
  top: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <rect x="8" y="8" width="8" height="10" rx="1" />
      <path d="M8 11h8" />
    </>
  ),
  plan: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M9 6v12M14 6v5M14 14v4" />
    </>
  ),
  hall: (
    <>
      <path d="M6 21V3h12v18" />
      <path d="M9 21l1.5-9h3L15 21" />
    </>
  ),
  sofa: (
    <>
      <path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11" />
      <path d="M3 17v-4.5a1.5 1.5 0 0 1 3 0V14h12v-1.5a1.5 1.5 0 0 1 3 0V17zM5 17v2M19 17v2" />
    </>
  ),
  room: (
    <>
      <path d="M4 20V9l3-5h10l3 5v11z" />
      <path d="M10 4v4h4V4" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
