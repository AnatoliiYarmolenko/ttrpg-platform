import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SessionTimeBadge from '@/components/shared/SessionTimeBadge';

describe('SessionTimeBadge', () => {
  const FIXED_NOW = new Date('2026-04-18T10:00:00Z');
  const fixedNowMs = FIXED_NOW.getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createSession = (overrides = {}) => ({
    id: 1,
    title: 'Test Session',
    ...overrides,
  });

  const createPlannedSession = (offsetMs, overrides = {}) =>
    createSession({
      status: 'PLANNED',
      startAt: new Date(fixedNowMs + offsetMs).toISOString(),
      ...overrides,
    });

  const createActiveSession = (offsetMs, overrides = {}) =>
    createSession({
      status: 'ACTIVE',
      startAt: new Date(fixedNowMs + offsetMs).toISOString(),
      ...overrides,
    });

  const renderBadge = (session) => render(<SessionTimeBadge session={session} />);

  const expectNoBadge = (session) => {
    const { container } = renderBadge(session);
    expect(container.firstChild).toBeNull();
  };

  it.each([
    ['missing session', null],
    ['finished session', createSession({ status: 'FINISHED', startAt: new Date(fixedNowMs).toISOString() })],
    ['canceled session', createSession({ status: 'CANCELED', startAt: new Date(fixedNowMs).toISOString() })],
    ['invalid status', createSession({ status: 'UNKNOWN', startAt: new Date(fixedNowMs).toISOString() })],
    ['invalid date', createPlannedSession(60 * 60 * 1000, { startAt: 'invalid-date' })],
  ])('returns nothing for %s', (_, session) => {
    expectNoBadge(session);
  });

  it('shows the live badge for an active session that is still within the threshold', () => {
    renderBadge(createActiveSession(-60 * 60 * 1000));

    expect(screen.getByText('Сесія вже йде!')).toBeInTheDocument();
  });

  it('marks a long-running active session as forgotten', () => {
    renderBadge(createActiveSession(-(12 * 60 * 60 * 1000) - 1));

    expect(screen.getByText('Забута сесія')).toBeInTheDocument();
  });

  it('shows a relative start time for a future planned session', () => {
    renderBadge(createPlannedSession(60 * 60 * 1000));

    expect(screen.getByText(/Почнеться/)).toBeInTheDocument();
  });

  it('shows a soon-starting badge for a planned session inside 30 seconds', () => {
    renderBadge(createPlannedSession(10 * 1000));

    expect(screen.getByText('Почнеться зовсім скоро')).toBeInTheDocument();
  });

  it('shows a delayed badge while the planned session is still inside tolerance', () => {
    renderBadge(createPlannedSession(-90 * 1000, { plannedToleranceMinutes: 2 }));

    expect(screen.getByText(/Сесія запізнюється на:/)).toBeInTheDocument();
  });

  it('marks a planned session as forgotten after tolerance plus duration', () => {
    renderBadge(
      createPlannedSession(-(63 * 60 * 1000), {
        plannedToleranceMinutes: 2,
        duration: 60,
      })
    );

    expect(screen.getByText('Забута сесія')).toBeInTheDocument();
  });

  it('uses the default planned tolerance when none is provided', () => {
    renderBadge(createPlannedSession(-(3 * 60 * 1000) - 1000, { duration: 1 }));

    expect(screen.getByText('Забута сесія')).toBeInTheDocument();
  });
});

