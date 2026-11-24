import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Menu, type MenuNav, type Topic } from './Menu';

const topic = (id: string, title: string): Topic => ({ id, title, summary: `${id} summary`, content: <p>{id} page</p> });
const walls = topic('walls', 'Room');
const cabinets = topic('cabinets', 'Cabinets');
const chair = topic('chair', 'Reading chair');
const root: Topic = {
  id: 'root',
  title: 'Office',
  summary: '',
  groups: [
    { title: 'Room', topics: [walls] },
    { title: 'Furniture', topics: [cabinets], groups: [{ title: 'Reading corner', topics: [chair] }] },
  ],
};
const exit = { text: 'All rooms', label: 'Back to all rooms', onExit: () => {} };
const at = (path: string[], go: MenuNav['go'] = () => {}) => <Menu root={root} exit={exit} nav={{ path, go }} />;

describe('Menu groups', () => {
  it('shows each group under its heading', () => {
    render(at([]));
    expect(screen.getByRole('heading', { level: 2, name: 'Room' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Furniture' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Reading corner' })).toBeInTheDocument();
    const buttons = within(screen.getByRole('list', { name: 'Reading corner' })).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].querySelector('strong')).toHaveTextContent('Reading chair');
  });

  it('opens a row inside a sub-group', () => {
    render(at(['chair']));
    expect(screen.getByText('chair page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Reading chair');
  });

  it('returns focus to the row in a sub-group', async () => {
    const go = vi.fn();
    const { rerender } = render(at(['chair'], go));
    await userEvent.click(screen.getByRole('button', { name: 'Back to Office' }));
    rerender(at(go.mock.calls.at(-1)![0], go));
    expect(screen.getByRole('button', { name: /^Reading chair/ })).toHaveFocus();
  });
});

describe('Menu group without rows', () => {
  it('renders no list for a group that only holds sub-groups', () => {
    const only: Topic = { id: 'r', title: 'Office', summary: '', groups: [{ title: 'Outer', topics: [], groups: [{ title: 'Inner', topics: [chair] }] }] };
    render(<Menu root={only} exit={exit} nav={{ path: [], go: () => {} }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Outer' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Outer' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Inner' })).toBeInTheDocument();
  });
});

describe('Menu swatch column', () => {
  const rowsOf = (topics: Topic[]): HTMLElement[] => {
    const page: Topic = { id: 'root', title: 'Living room', summary: '', groups: [{ title: 'Furniture', topics }] };
    render(<Menu root={page} exit={exit} nav={{ path: [], go: () => {} }} />);
    return within(screen.getByRole('list', { name: 'Furniture' })).getAllByRole('listitem');
  };

  it('leaves room on every row for the swatch of one', () => {
    const [sofa, plant] = rowsOf([{ ...topic('sofa', 'Sofa'), swatch: '#aa5533' }, topic('plant', 'Plant')]);
    expect(sofa.querySelector('i:not(.blank)')).not.toBeNull();
    expect(plant.querySelector('i.blank')).not.toBeNull();
  });

  it('keeps the column for a row that has no swatch showing but holds its place', () => {
    const [sofa, plant] = rowsOf([{ ...topic('sofa', 'Sofa'), swatchSpace: true }, topic('plant', 'Plant')]);
    expect(sofa.querySelector('i.blank')).not.toBeNull();
    expect(plant.querySelector('i.blank')).not.toBeNull();
  });

  it('has no column when no row has or holds a swatch', () => {
    const [sofa] = rowsOf([topic('sofa', 'Sofa')]);
    expect(sofa.querySelector('i')).toBeNull();
  });
});
