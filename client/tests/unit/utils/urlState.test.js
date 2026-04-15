import { describe, expect, it } from 'vitest';
import {
  normalizeEnumValue,
  parseEnumSearchParam,
  parsePositiveIntSearchParam,
  setOrDeleteParam,
} from '@/utils/urlState';

describe('urlState utilities', () => {
  it('normalizes enum values with fallback', () => {
    expect(normalizeEnumValue('profile', ['home', 'profile'], 'home')).toBe('profile');
    expect(normalizeEnumValue('unknown', ['home', 'profile'], 'home')).toBe('home');
    expect(normalizeEnumValue(null, ['home', 'profile'], 'home')).toBe('home');
  });

  it('parses enum search param and falls back for invalid input', () => {
    const params = new URLSearchParams('tab=calendar');
    const invalidParams = new URLSearchParams('tab=broken');

    expect(parseEnumSearchParam(params, 'tab', ['home', 'calendar'], 'home')).toBe('calendar');
    expect(parseEnumSearchParam(invalidParams, 'tab', ['home', 'calendar'], 'home')).toBe('home');
  });

  it('parses positive integer search params safely', () => {
    expect(parsePositiveIntSearchParam(new URLSearchParams('viewing=12'), 'viewing')).toBe(12);
    expect(parsePositiveIntSearchParam(new URLSearchParams('viewing=-1'), 'viewing')).toBeNull();
    expect(parsePositiveIntSearchParam(new URLSearchParams('viewing=abc'), 'viewing')).toBeNull();
  });

  it('sets or deletes params depending on defaults', () => {
    const params = new URLSearchParams();
    setOrDeleteParam(params, 'tab', 'profile', 'home');
    expect(params.get('tab')).toBe('profile');

    setOrDeleteParam(params, 'tab', 'home', 'home');
    expect(params.get('tab')).toBeNull();
  });
});
