import React, { useEffect, useState, useMemo } from 'react';
import Timer from '@/components/ui/icons/Timer';

const UI_LOCALE = 'uk-UA';
const DEFAULT_PLANNED_TOLERANCE_MINUTES = 2;

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

export default function SessionTimeBadge({ session, nowMs: externalNowMs, className = '' }) {
  const [internalNow, setInternalNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof externalNowMs === 'number') return;
    const intervalId = setInterval(() => setInternalNow(Date.now()), 30 * 1000);
    return () => clearInterval(intervalId);
  }, [externalNowMs]);

  const nowMs = typeof externalNowMs === 'number' ? externalNowMs : internalNow;

  const badgeProps = useMemo(() => {
    if (!session) return null;

    if (session.status === 'FINISHED') return { text: 'Сесія завершена', variant: 'finished' };
    if (session.status === 'CANCELED') return { text: 'Сесія скасована', variant: 'canceled' };
    if (session.status === 'ACTIVE') {
      const activeDateStr = session.startAt || session.date;
      if (activeDateStr) {
        const activeStartMs = new Date(activeDateStr).getTime();
        if (!Number.isNaN(activeStartMs) && nowMs - activeStartMs > 12 * 60 * 60 * 1000) {
          return { text: 'Забута сесія (не завершена)', variant: 'forgotten' };
        }
      }
      return { text: 'Сесія вже йде!', variant: 'active' };
    }

    const dateStr = session.startAt || session.date;
    if (!dateStr) return null;

    const startDate = new Date(dateStr);
    if (Number.isNaN(startDate.getTime())) return null;

    if (session.status === 'PLANNED') {
      const diffMs = startDate.getTime() - nowMs;
      
      if (diffMs < 0) {
        const toleranceMinutes = Number(session.plannedToleranceMinutes);
        const plannedToleranceMs = (Number.isFinite(toleranceMinutes) && toleranceMinutes > 0 
          ? toleranceMinutes 
          : DEFAULT_PLANNED_TOLERANCE_MINUTES) * 60 * 1000;

        if (diffMs < -plannedToleranceMs) {
          return { text: 'Забута сесія', variant: 'forgotten' };
        }
        return { text: `Сесія запізнюється на: ${formatDelayedDuration(Math.abs(diffMs))}`, variant: 'timer' };
      }

      if (diffMs <= 30 * 1000) return { text: 'Почнеться зовсім скоро', variant: 'timer' };

      const relativeTime = new Intl.RelativeTimeFormat(UI_LOCALE, { numeric: 'auto' });
      const { unit, value } = selectRelativeUnit(diffMs);
      return { text: `Почнеться ${relativeTime.format(value, unit)}`, variant: 'timer' };
    }

    return null;
  }, [session, nowMs]);

  if (!badgeProps) return null;

  let badgeStyles = 'bg-brand-light/20 text-brand-dark';
  let showTimer = true;

  if (badgeProps.variant === 'finished') {
    badgeStyles = 'bg-brand-light/20 text-brand-medium';
    showTimer = false;
  } else if (badgeProps.variant === 'canceled') {
    badgeStyles = 'bg-red-50 text-red-600';
    showTimer = false;
  } else if (badgeProps.variant === 'forgotten') {
    badgeStyles = 'bg-orange-50 text-orange-600';
    showTimer = false;
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap shrink-0 ${badgeStyles} ${className}`}>
      {showTimer && <Timer className="w-4 h-4 shrink-0" />}
      <span>{badgeProps.text}</span>
    </div>
  );
}
