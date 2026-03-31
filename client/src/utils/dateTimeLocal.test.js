import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  formatDateTimeLocalValue,
  getDateTimeLocalIssue,
  isAmbiguousDateTimeLocalValue,
  toIsoDateTimeLocalValue,
} from './dateTimeLocal';

const ORIGINAL_TZ = process.env.TZ;

describe('dateTimeLocal utilities', () => {
  beforeEach(() => {
    process.env.TZ = 'Europe/Kyiv';
  });

  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it('formats UTC timestamps into local datetime-local values', () => {
    expect(formatDateTimeLocalValue('2026-03-29T01:30:00.000Z')).toBe('2026-03-29T04:30');
  });

  it('rejects nonexistent local times during spring-forward', () => {
    const now = new Date('2026-03-28T12:00:00+02:00');

    expect(getDateTimeLocalIssue('2026-03-29T03:30', now)).toBe('nonexistent');
    expect(toIsoDateTimeLocalValue('2026-03-29T03:30')).toBeNull();
  });

  it('keeps valid local times stable across DST boundaries', () => {
    expect(toIsoDateTimeLocalValue('2026-03-29T04:30')).toBe('2026-03-29T01:30:00.000Z');
  });

  it('flags repeated local times during fall-back as ambiguous', () => {
    const now = new Date('2026-10-24T12:00:00+03:00');

    expect(isAmbiguousDateTimeLocalValue('2026-10-25T03:30')).toBe(true);
    expect(getDateTimeLocalIssue('2026-10-25T03:30', now)).toBe('ambiguous');
  });
});
