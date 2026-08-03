import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './storage';
import type { Settings } from './storage';
import {
  hostMatches,
  normalizeHost,
  siteConverts,
  setSiteConverts,
  siteTarget,
  setSiteTarget,
} from './sites';

function withSettings(patch: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe('normalizeHost', () => {
  it('lowercases, trims trailing dots, and strips a leading www.', () => {
    expect(normalizeHost('WWW.Example.com')).toBe('example.com');
    expect(normalizeHost('example.com.')).toBe('example.com');
    expect(normalizeHost('shop.example.com')).toBe('shop.example.com'); // only leading www. dropped
    expect(normalizeHost('')).toBe('');
  });
});

describe('hostMatches', () => {
  it('matches the entry and its subdomains, not lookalikes', () => {
    expect(hostMatches('example.com', 'example.com')).toBe(true);
    expect(hostMatches('www.example.com', 'example.com')).toBe(true);
    expect(hostMatches('shop.example.com', 'example.com')).toBe(true);
    expect(hostMatches('notexample.com', 'example.com')).toBe(false);
    expect(hostMatches('example.com', '')).toBe(false);
  });
});

describe('siteConverts', () => {
  it('blacklist mode converts everywhere except listed hosts (and subdomains)', () => {
    const s = withSettings({ siteListMode: 'blacklist', blacklist: ['youtube.com'] });
    expect(siteConverts('example.com', s)).toBe(true);
    expect(siteConverts('youtube.com', s)).toBe(false);
    expect(siteConverts('m.youtube.com', s)).toBe(false);
  });

  it('whitelist mode converts only on listed hosts', () => {
    const s = withSettings({ siteListMode: 'whitelist', whitelist: ['amazon.com'] });
    expect(siteConverts('amazon.com', s)).toBe(true);
    expect(siteConverts('smile.amazon.com', s)).toBe(true);
    expect(siteConverts('example.com', s)).toBe(false);
  });
});

describe('setSiteConverts', () => {
  it('blacklist mode: turning conversion OFF adds the host, ON removes it', () => {
    const s = withSettings({ siteListMode: 'blacklist', blacklist: [] });
    const off = setSiteConverts(s, 'www.youtube.com', false);
    expect(off).toEqual({ blacklist: ['youtube.com'] });

    const listed = withSettings({ siteListMode: 'blacklist', blacklist: ['youtube.com'] });
    expect(setSiteConverts(listed, 'youtube.com', true)).toEqual({ blacklist: [] });
  });

  it('whitelist mode: turning conversion ON adds the host, OFF removes it', () => {
    const s = withSettings({ siteListMode: 'whitelist', whitelist: [] });
    expect(setSiteConverts(s, 'amazon.com', true)).toEqual({ whitelist: ['amazon.com'] });

    const listed = withSettings({ siteListMode: 'whitelist', whitelist: ['amazon.com'] });
    expect(setSiteConverts(listed, 'amazon.com', false)).toEqual({ whitelist: [] });
  });

  it('editing one list never touches the other (mode switch preserves both)', () => {
    const s = withSettings({
      siteListMode: 'blacklist',
      blacklist: ['youtube.com'],
      whitelist: ['amazon.com'],
    });
    const patch = setSiteConverts(s, 'reddit.com', false);
    expect(patch).toEqual({ blacklist: ['youtube.com', 'reddit.com'] });
    expect(patch).not.toHaveProperty('whitelist'); // whitelist left intact
  });

  it('is a no-op when the host is already in the desired state', () => {
    const s = withSettings({ siteListMode: 'blacklist', blacklist: ['youtube.com'] });
    expect(setSiteConverts(s, 'youtube.com', false)).toEqual({}); // already blacklisted
    expect(setSiteConverts(s, 'example.com', true)).toEqual({}); // already converts
  });
});

describe('siteTarget / setSiteTarget', () => {
  it('returns the override for a matching host (subdomains included), else null', () => {
    const s = withSettings({ siteTargets: { 'amazon.com': 'JPY' } });
    expect(siteTarget('amazon.com', s)).toBe('JPY');
    expect(siteTarget('smile.amazon.com', s)).toBe('JPY');
    expect(siteTarget('example.com', s)).toBeNull();
  });

  it('prefers the most specific matching key', () => {
    const s = withSettings({ siteTargets: { 'amazon.com': 'JPY', 'shop.amazon.com': 'GBP' } });
    expect(siteTarget('shop.amazon.com', s)).toBe('GBP');
    expect(siteTarget('www.amazon.com', s)).toBe('JPY');
  });

  it('sets an override under the normalized host, and clears it with an empty target', () => {
    const s = withSettings({ siteTargets: {} });
    expect(setSiteTarget(s, 'www.amazon.com', 'JPY')).toEqual({ siteTargets: { 'amazon.com': 'JPY' } });

    const listed = withSettings({ siteTargets: { 'amazon.com': 'JPY' } });
    expect(setSiteTarget(listed, 'amazon.com', '')).toEqual({ siteTargets: {} });
  });
});
