import React, { useEffect, useState, useMemo } from 'react';
import Timer from '@/components/ui/icons/Timer';

const UI_LOCALE = 'uk-UA';
const DEFAULT_PLANNED_TOLERANCE_MINUTES = 2;
const FORGOTTEN_SESSION_THRESHOLD_MS = 12 * 60 * 60 * 1000;

const selectRelativeUnit = (diffMs) => {
  const absMs = Math.abs(diffMs);
  if (absMs < 60 * 1000) return { unit: 'second', value: Math.round(diffMs / 1000) };
  if (absMs < 60 * 60 * 1000) return { unit: 'minute', value: Math.round(diffMs / (60 * 1000)) };
  if (absMs < 24 * 60 * 60 * 1000) return { unit: 'hour', value: Math.round(diffMs / (60 * 60 * 1000)) };
  return { unit: 'day', value: Math.round(diffMs / (24 * 60 * 60 * 1000)) };
};

const formatDelayedDuration = (lateMs) => {
  const totalMinutes = Math.max(1, Math.ceil(lateMs / (60 * 1000)));
  if (totalMinutes < 60) return `${totalMinutes} хв`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} год`;
  return `${hours} год ${minutes} хв`;
};

const getSessionStartMs = (session) => {
  const dateStr = session?.startAt;
  if (!dateStr) return null;

  const parsedMs = new Date(dateStr).getTime();
  return Number.isNaN(parsedMs) ? null : parsedMs;
};

const getPlannedToleranceMs = (session) => {
  const toleranceMinutes = Number(session?.plannedToleranceMinutes);
  const safeMinutes = Number.isFinite(toleranceMinutes) && toleranceMinutes > 0
    ? toleranceMinutes
    : DEFAULT_PLANNED_TOLERANCE_MINUTES;
  return safeMinutes * 60 * 1000;
};

const getSessionDurationMs = (session) => {
  const durationMinutes = Number(session?.duration);
  const safeMinutes = Number.isFinite(durationMinutes) && durationMinutes > 0
    ? durationMinutes
    : 60;
  return safeMinutes * 60 * 1000;
};

const isForgottenActiveSession = (session, nowMs) => {
  const activeStartMs = getSessionStartMs(session);
  if (activeStartMs === null) return false;
  return nowMs - activeStartMs > FORGOTTEN_SESSION_THRESHOLD_MS;
};

const isForgottenPlannedSession = (session, nowMs) => {
  const plannedStartMs = getSessionStartMs(session);
  if (plannedStartMs === null) return false;

  const diffMs = plannedStartMs - nowMs;
  if (diffMs >= 0) return false;

  const thresholdMs = getPlannedToleranceMs(session) + getSessionDurationMs(session);
  return diffMs < -thresholdMs;
};

/**
 * Перевіряє чи сесія забута (не завершена після тривалої активності).
 * Для ACTIVE: перевіряє чи минуло більше 12 годин з моменту старту.
 * Для PLANNED: перевіряє чи минув допуск затримки + тривалість сесії.
 */
const isForgottenSession = (session, nowMs) => {
  if (!session) return false;
  if (session.status === 'ACTIVE') return isForgottenActiveSession(session, nowMs);
  if (session.status === 'PLANNED') return isForgottenPlannedSession(session, nowMs);
  return false;
};

export default function SessionTimeBadge({ session, className = '' }) {
  const [internalNow, setInternalNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => setInternalNow(Date.now()), 30 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  const nowMs = internalNow;

  const badgeProps = useMemo(() => {
    // SessionTimeBadge показується тільки для PLANNED і ACTIVE статусів
    if (!session || !['PLANNED', 'ACTIVE'].includes(session.status)) {
      return null;
    }

    if (session.status === 'ACTIVE') {
      if (isForgottenSession(session, nowMs)) {
        return { text: 'Забута сесія', variant: 'forgotten' };
      }
      return { text: 'Сесія вже йде!', variant: 'active' };
    }

    // PLANNED status
    const dateStr = session.startAt;
    if (!dateStr) return null;

    const startDate = new Date(dateStr);
    if (Number.isNaN(startDate.getTime())) return null;

    const diffMs = startDate.getTime() - nowMs;

    if (diffMs < 0) {
      if (isForgottenSession(session, nowMs)) {
        return { text: 'Забута сесія', variant: 'forgotten' };
      }
      return { text: `Сесія запізнюється на: ${formatDelayedDuration(Math.abs(diffMs))}`, variant: 'timer' };
    }

    if (diffMs <= 30 * 1000) return { text: 'Почнеться зовсім скоро', variant: 'timer' };

    const relativeTime = new Intl.RelativeTimeFormat(UI_LOCALE, { numeric: 'auto' });
    const { unit, value } = selectRelativeUnit(diffMs);
    return { text: `Почнеться ${relativeTime.format(value, unit)}`, variant: 'timer' };
  }, [session, nowMs]);

  if (!badgeProps) return null;

  let badgeStyles = 'bg-brand-light/10 text-brand-dark';
  let showTimer = true;

  if (badgeProps.variant === 'forgotten') {
    badgeStyles = 'bg-orange-100 text-orange-700';
    showTimer = false;
  } else if (badgeProps.variant === 'active') {
    badgeStyles = 'bg-green-100 text-green-700';
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap shrink-0 ${badgeStyles} ${className}`}>
      {showTimer && <Timer className="w-4 h-4 shrink-0" />}
      <span>{badgeProps.text}</span>
    </div>
  );
}
