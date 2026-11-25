import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RoomDef } from '../data/components';
import { BEMZ_FABRICS } from '../data/bemzFabrics';
import { BEDROOM, bedroomDef } from '../data/bedroom';
import { RUGS } from '../data/catalog';
import { LIVING } from '../data/living';
import { componentGroups, componentTopic } from './componentTopic';

const def = (id: string, group?: string) => ({
  id, name: id, category: 'furniture' as 'furniture' | 'lighting' | 'decor', group, variants: [{ id: 'a', name: 'A' }], initial: { shown: true, variant: 'a' },
});

describe('componentGroups', () => {
  it('lists a component of an undeclared group as ungrouped', () => {
    const room: RoomDef = { id: 'office', groups: [{ id: 'g', name: 'G' }], components: [def('x', 'g'), def('y', 'missing'), def('z')] };
    const [furniture] = componentGroups(room, (c) => ({ id: c.id, title: c.name, summary: '' }));
    expect(furniture.topics.map((t) => t.id)).toEqual(['y', 'z']);
    expect(furniture.groups?.map((g) => g.topics.map((t) => t.id))).toEqual([['x']]);
  });

  it('lists the categories as Lighting, Furniture, Textiles and decor, whatever order the room defines them', () => {
    const room: RoomDef = {
      id: 'office',
      components: [{ ...def('r'), category: 'decor' }, def('f'), { ...def('l'), category: 'lighting' }],
    };
    expect(componentGroups(room, (c) => ({ id: c.id, title: c.name, summary: '' })).map((g) => g.title)).toEqual([
      'Lighting', 'Furniture', 'Textiles and decor',
    ]);
  });

  it('leaves out a category with no component', () => {
    const room: RoomDef = { id: 'office', components: [def('f'), { ...def('l'), category: 'lighting' }] };
    expect(componentGroups(room, (c) => ({ id: c.id, title: c.name, summary: '' })).map((g) => g.title)).toEqual(['Lighting', 'Furniture']);
  });
});

describe('componentTopic swatch', () => {
  const sofa = LIVING.components.find((c) => c.id === 'sofa')!;
  const f = BEMZ_FABRICS[0];
  const state = (shown: boolean, fabric: string) => ({ shown, variant: 'nockeby', options: { fabric } });

  it('shows the fabric colour while the piece is shown', () => {
    expect(componentTopic(sofa, state(true, f.code), () => {}).swatch).toBe(f.hex);
  });

  it('holds the swatch column when the piece is hidden, without showing its colour', () => {
    const t = componentTopic(sofa, state(false, f.code), () => {});
    expect(t.swatch).toBeUndefined();
    expect(t.swatchSpace).toBe(true);
  });

  it('has no column to hold for the original fabric', () => {
    expect(componentTopic(sofa, state(false, 'original'), () => {}).swatchSpace).toBe(false);
  });

  it('sets one option at a time', () => {
    const set = vi.fn();
    render(<>{componentTopic(sofa, state(true, 'original'), set).content}</>);
    fireEvent.click(screen.getByRole('button', { name: `${f.family}, ${f.colour}` }));
    expect(set).toHaveBeenCalledWith({ options: { fabric: f.code } });
  });
});

describe('componentTopic chips options', () => {
  const bed = bedroomDef('bed');
  const painting = bedroomDef('painting');
  const wardrobes = bedroomDef('wardrobes');
  const rug = bedroomDef('rug');
  const bedState = (pillows: string, shown = true) => ({ shown, variant: 'tonstad', options: { pillows } });
  const paintingState = (art = 'sun', frame = 'brass', shown = true) => ({ shown, variant: 'framed', options: { art, frame } });

  it('shows the Accent pillows in the accent colour, wherever the accent is', () => {
    const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
    for (const accent of ['#B5654A', '#2F5D62']) {
      const t = componentTopic(bed, bedState('clay'), () => {}, undefined, accent);
      expect(t.summary).toBe('Accent');
      expect(t.swatch).toBe(accent);
      render(<>{t.content}</>);
      const dot = screen.getByRole('button', { name: 'Accent' }).querySelector('.dot') as HTMLElement;
      expect(dot.style.background).toBe(rgb(accent));
      cleanup();
    }
  });

  it('gives the other pillow sets their own colour', () => {
    const t = componentTopic(bed, bedState('ink'), () => {}, undefined, '#B5654A');
    expect(t.summary).toBe('Ink and brass');
    expect(t.swatch).toBe('#2F3E36');
  });

  it('sets the pillows without touching the product or the switch', () => {
    const set = vi.fn();
    render(<>{componentTopic(bed, bedState('clay'), set).content}</>);
    fireEvent.click(screen.getByRole('button', { name: 'Calm oatmeal' }));
    expect(set).toHaveBeenCalledWith({ options: { pillows: 'calm' } });
  });

  it('summarises both the art and the frame, and sets each on its own', () => {
    const set = vi.fn();
    const t = componentTopic(painting, paintingState('hills', 'oak'), set);
    expect(t.summary).toBe('Hills · oak frame');
    render(<>{t.content}</>);
    expect(screen.getByRole('group', { name: 'Painting' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Frame' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'White frame' }));
    expect(set).toHaveBeenLastCalledWith({ options: { frame: 'white' } });
    fireEvent.click(screen.getByRole('button', { name: 'Arches' }));
    expect(set).toHaveBeenLastCalledWith({ options: { art: 'arches' } });
  });

  it('starts the painting as Clay sun with a brass frame, and says Hidden while it is hidden', () => {
    expect(componentTopic(painting, paintingState(), () => {}).summary).toBe('Clay sun · brass frame');
    expect(componentTopic(painting, paintingState('sun', 'brass', false), () => {}).summary).toBe('Hidden');
  });

  it('marks the pressed choice of each option', () => {
    render(<>{componentTopic(painting, paintingState('arches', 'white'), () => {}).content}</>);
    expect(screen.getByRole('button', { name: 'Arches' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Hills' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'White frame' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a wardrobe colour swatch only for a colour that has one', () => {
    const state = (colour: string) => ({ shown: true, variant: 'pax', options: { colour } });
    expect(componentTopic(wardrobes, state('ink'), () => {}).swatch).toBe('#2F3E36');
    expect(componentTopic(wardrobes, state('wall'), () => {}).swatch).toBeUndefined();
    expect(componentTopic(wardrobes, state('wall'), () => {}).summary).toBe('Same green as walls');
  });

  it('leaves a piece at its start without a Reset, and offers one once an option moved', () => {
    expect(componentTopic(painting, paintingState(), () => {}).reset).toBeUndefined();
    const set = vi.fn();
    const t = componentTopic(painting, paintingState('hills', 'brass'), set);
    t.reset!();
    expect(set).toHaveBeenCalledWith({ shown: true, variant: 'framed', options: { art: 'sun', frame: 'brass' } });
  });

  it('lists the rugs with their sizes and thumbnails, and picking one shows the rug', () => {
    const set = vi.fn();
    const t = componentTopic(rug, { shown: false, variant: 'naver', options: {} }, set, (v) => `thumb-${v.id}.png`);
    expect(t.summary).toBe('Hidden');
    const { container } = render(<>{t.content}</>);
    expect(container.querySelectorAll('img')).toHaveLength(RUGS.length);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('thumb-naver.png');
    expect(screen.getByText('Granit · 4 499 kr · 200×300')).toBeTruthy();
    expect(screen.queryByText('No rug')).toBeNull();
    fireEvent.click(screen.getByText('Palma, green vines'));
    expect(set).toHaveBeenCalledWith({ variant: 'palma', shown: true });
  });

  it('gives every bedroom piece a page', () => {
    for (const c of BEDROOM.components) {
      const def = bedroomDef(c.id);
      const t = componentTopic(def, { shown: true, variant: def.initial.variant, options: Object.fromEntries((def.options ?? []).map((o) => [o.id, o.initial])) }, () => {});
      expect(t.id).toBe(c.id);
      expect(t.summary).not.toBe('');
    }
  });
});
