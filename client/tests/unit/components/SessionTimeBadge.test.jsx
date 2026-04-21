import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SessionTimeBadge from '@/components/shared/SessionTimeBadge';

/**
 * Тести для SessionTimeBadge компонента.
 * Перевіряє:
 * - Видалення гілок для FINISHED і CANCELED
 * - Ранній return null для непотрібних статусів
 * - Правильне форматування часу для PLANNED
 * - Правильне визначення забутих сесій
 */
describe('SessionTimeBadge', () => {
  const baseDate = new Date('2026-04-18T10:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('повертає null для FINISHED статусу', () => {
    const session = {
      id: 1,
      status: 'FINISHED',
      title: 'Finished Session',
      date: new Date(baseDate - 86400000).toISOString(), // 1 день назад
    };

    const { container } = render(<SessionTimeBadge session={session} />);
    expect(container.firstChild).toBeNull();
  });

  it('повертає null для CANCELED статусу', () => {
    const session = {
      id: 1,
      status: 'CANCELED',
      title: 'Canceled Session',
      date: new Date(baseDate - 86400000).toISOString(),
    };

    const { container } = render(<SessionTimeBadge session={session} />);
    expect(container.firstChild).toBeNull();
  });

  it('повертає null для невідомого статусу', () => {
    const session = {
      id: 1,
      status: 'UNKNOWN',
      title: 'Unknown Session',
      date: new Date(baseDate + 3600000).toISOString(),
    };

    const { container } = render(<SessionTimeBadge session={session} />);
    expect(container.firstChild).toBeNull();
  });

  it('показує "Сесія вже йде!" для ACTIVE статусу без забути', () => {
    const session = {
      id: 1,
      status: 'ACTIVE',
      title: 'Active Session',
      startAt: new Date(baseDate - 3600000).toISOString(), // 1 година назад
    };

    render(<SessionTimeBadge session={session} />);
    expect(screen.getByText('Сесія вже йде!')).toBeInTheDocument();
  });

  it('показує "Забута сесія" для ACTIVE статусу після 12 годин', () => {
    const session = {
      id: 1,
      status: 'ACTIVE',
      title: 'Forgotten Active Session',
      startAt: new Date(baseDate - 12 * 60 * 60 * 1000 - 1).toISOString(), // 12 годин + 1мс назад
    };

    render(<SessionTimeBadge session={session} />);
    expect(screen.getByText('Забута сесія')).toBeInTheDocument();
  });

  it('показує правильний час до сесії для PLANNED', () => {
    const session = {
      id: 1,
      status: 'PLANNED',
      title: 'Planned Session',
      date: new Date(baseDate + 60 * 60 * 1000).toISOString(), // 1 година пізніше
    };

    render(<SessionTimeBadge session={session} />);
    expect(screen.getByText(/Почнеться/)).toBeInTheDocument();
  });

  it('показує "Почнеться зовсім скоро" коли залишилось <30 секунд', () => {
    const session = {
      id: 1,
      status: 'PLANNED',
      title: 'Soon Session',
      date: new Date(baseDate + 10 * 1000).toISOString(), // 10 секунд пізніше
    };

    render(<SessionTimeBadge session={session} />);
    expect(screen.getByText('Почнеться зовсім скоро')).toBeInTheDocument();
  });

  it('показує "Сесія запізнюється" поки не минули толеранс + duration', () => {
    const session = {
      id: 1,
      status: 'PLANNED',
      title: 'Delayed Planned Session',
      date: new Date(baseDate - 30 * 60 * 1000).toISOString(), // 30 хвилин назад
      plannedToleranceMinutes: 2,
      duration: 60,
    };

    render(<SessionTimeBadge session={session} />);
    expect(screen.getByText(/Сесія запізнюється/)).toBeInTheDocument();
  });

  it('показує "Забута сесія" для PLANNED після толерансу + duration', () => {
    const session = {
      id: 1,
      status: 'PLANNED',
      title: 'Forgotten Planned Session',
      date: new Date(baseDate - 63 * 60 * 1000).toISOString(), // 63 хвилини назад
      plannedToleranceMinutes: 2,
      duration: 60,
    };

    render(<SessionTimeBadge session={session} />);
    expect(screen.getByText('Забута сесія')).toBeInTheDocument();
  });

  it('показує час затримки для PLANNED в межах толерансу', () => {
    const session = {
      id: 1,
      status: 'PLANNED',
      title: 'Delayed Session',
      date: new Date(baseDate - 90 * 1000).toISOString(), // 1.5 хвилини назад
      plannedToleranceMinutes: 2,
    };

    render(<SessionTimeBadge session={session} />);
    expect(screen.getByText(/Сесія запізнюється/)).toBeInTheDocument();
  });

  it('видаляє Timer іконку для "забутої" сесії', () => {
    const session = {
      id: 1,
      status: 'PLANNED',
      title: 'Forgotten Session',
      date: new Date(baseDate - 63 * 60 * 1000).toISOString(), // 63 хвилини назад
      plannedToleranceMinutes: 2,
      duration: 60,
    };

    const { container } = render(<SessionTimeBadge session={session} />);
    const timerIcon = container.querySelector('svg');
    expect(timerIcon).not.toBeInTheDocument();
  });

  it('показує Timer іконку для PLANNED статусу', () => {
    const session = {
      id: 1,
      status: 'PLANNED',
      title: 'Planned Session',
      date: new Date(baseDate + 3600000).toISOString(),
    };

    const { container } = render(<SessionTimeBadge session={session} />);
    const timerIcon = container.querySelector('svg');
    expect(timerIcon).toBeInTheDocument();
  });

  it('застосовує правильні стилі для "активної" сесії', () => {
    const session = {
      id: 1,
      status: 'ACTIVE',
      title: 'Active Session',
      startAt: new Date(baseDate - 3600000).toISOString(),
    };

    const { container } = render(<SessionTimeBadge session={session} />);
    const badge = container.querySelector('div');
    expect(badge.className).toMatch(/bg-green-100/);
    expect(badge.className).toMatch(/text-green-700/);
  });

  it('застосовує правильні стилі для "забутої" сесії', () => {
    const session = {
      id: 1,
      status: 'PLANNED',
      title: 'Forgotten Session',
      date: new Date(baseDate - 63 * 60 * 1000).toISOString(),
      plannedToleranceMinutes: 2,
      duration: 60,
    };

    const { container } = render(<SessionTimeBadge session={session} />);
    const badge = container.querySelector('div');
    expect(badge.className).toMatch(/bg-orange-100/);
    expect(badge.className).toMatch(/text-orange-700/);
  });

  it('повертає null якщо session не передана', () => {
    const { container } = render(<SessionTimeBadge session={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('обробляє невалідну дату', () => {
    const session = {
      id: 1,
      status: 'PLANNED',
      title: 'Invalid Date Session',
      date: 'invalid-date',
    };

    const { container } = render(<SessionTimeBadge session={session} />);
    expect(container.firstChild).toBeNull();
  });

  it('використовує DEFAULT_PLANNED_TOLERANCE_MINUTES коли plannedToleranceMinutes не встановлено', () => {
    const session = {
      id: 1,
      status: 'PLANNED',
      title: 'Default Tolerance Session',
      date: new Date(baseDate - 3 * 60 * 1000 - 1000).toISOString(), // 3 хв 1 сек назад — суворо більше порогу
      duration: 1, // tolerance(2) + duration(1) = 3 хвилини — поріг забуття
      // plannedToleranceMinutes не встановлено, default = 2 хвилини
    };

    render(<SessionTimeBadge session={session} />);
    // 3 хв 1 сек > tolerance(2) + duration(1) = 3 хв → "Забута сесія"
    expect(screen.getByText('Забута сесія')).toBeInTheDocument();
  });


  it('застосовує className проп', () => {
    const session = {
      id: 1,
      status: 'ACTIVE',
      title: 'Active Session',
      startAt: new Date(baseDate - 3600000).toISOString(),
    };

    const { container } = render(
      <SessionTimeBadge session={session} className="my-custom-class" />
    );
    const badge = container.querySelector('div');
    expect(badge.className).toMatch(/my-custom-class/);
  });
});

