import { describe, expect, it } from 'vitest';
import { mainView, viewsFor } from './catalog';

describe('views by room', () => {
  it('shows the apartment view and one view per room when no room is selected', () => {
    expect(viewsFor('all').map((v) => v.name)).toEqual(['Apartment', 'Foot of bed', 'Hall', 'Living room', 'End room']);
  });

  it("shows only the selected room's views", () => {
    expect(viewsFor('bedroom').map((v) => v.name)).toEqual(['Overview', 'Foot of bed', 'Wardrobe wall', 'Dresser wall', 'Top down']);
    expect(viewsFor('living').map((v) => v.name)).toEqual(['Living room']);
  });

  it("picks each selection's main view", () => {
    expect(mainView('end').name).toBe('End room');
    expect(mainView('bedroom').name).toBe('Foot of bed');
    expect(mainView('all').name).toBe('Apartment');
  });
});
