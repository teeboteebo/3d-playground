import { describe, expect, it } from 'vitest';
import { DEFAULTS, STORAGE_KEY, loadSettings, sanitizeSettings, saveSettings } from './settings';

describe('sanitizeSettings', () => {
  it('returns defaults for empty or garbage input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULTS);
    expect(sanitizeSettings('x')).toEqual(DEFAULTS);
    expect(sanitizeSettings({ rug: 'flying-carpet', time: 'noon', accent: 'red' })).toEqual(DEFAULTS);
  });

  it('keeps valid values and upper-cases the accent', () => {
    const s = sanitizeSettings({ accent: '#2f5d62', rug: 'palma', pillows: 'ink', time: 'eve', pendant: 'off', mould: 'tone' });
    expect(s).toMatchObject({ accent: '#2F5D62', rug: 'palma', pillows: 'ink', time: 'eve', pendant: 'off', mould: 'tone' });
  });

  it('clamps slider values and falls back for zero/NaN', () => {
    expect(sanitizeSettings({ mgap: 99, mcen: 1, msw: 'abc' })).toMatchObject({ mgap: 30, mcen: 150, msw: 68 });
    expect(sanitizeSettings({ mgap: 0 })).toMatchObject({ mgap: 8 });
    expect(sanitizeSettings({ mgap: '12' })).toMatchObject({ mgap: 12 });
  });

  it('migrates the legacy mould "off" value to white + hidden bed-wall moulding', () => {
    expect(sanitizeSettings({ mould: 'off', mouldB: 'on' })).toMatchObject({ mould: 'white', mouldB: 'off' });
  });

  it('ignores the legacy fixed-finish keys from the single-file app', () => {
    const s = sanitizeSettings({ wall: 'ink', trim: 'white', floor: 'herring', oak: 'dark', size: '170x240' });
    expect(s).toEqual(DEFAULTS);
  });
});

describe('load/save', () => {
  it('round-trips through storage under the original key', () => {
    const s = { ...DEFAULTS, rug: 'rista' };
    saveSettings(s);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(s);
    expect(loadSettings()).toEqual(s);
  });

  it('survives corrupt JSON and throwing storage', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    expect(loadSettings()).toEqual(DEFAULTS);
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    expect(loadSettings(throwing)).toEqual(DEFAULTS);
    expect(() => saveSettings(DEFAULTS, throwing)).not.toThrow();
  });
});
