const DEFAULT_ACTIVE_MAX_AGE_HOURS = 24;
const DEFAULT_PLANNED_TOLERANCE_MINUTES = 2;

function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function toSessionStartDate(session) {
  return toDate(session?.startAt ?? null);
}

function normalizeId(id) {
  const numeric = Number(id);
  if (Number.isFinite(numeric)) {
    return { type: 'number', value: numeric };
  }

  return { type: 'string', value: String(id ?? '') };
}

function compareByStartThenId(first, second) {
  const startDiff = first.startAtMs - second.startAtMs;
  if (startDiff !== 0) {
    return startDiff;
  }

  if (first.id.type === 'number' && second.id.type === 'number') {
    return first.id.value - second.id.value;
  }

  if (first.id.type === 'number') {
    return -1;
  }

  if (second.id.type === 'number') {
    return 1;
  }

  return first.id.value.localeCompare(second.id.value, 'en', { sensitivity: 'base' });
}

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function selectNextRelevantSession(sessions, options = {}) {
  const list = Array.isArray(sessions) ? sessions : [];

  const nowDate = toDate(options.now ?? new Date());
  if (!nowDate) {
    throw new TypeError('Invalid "now" value for next relevant session selector');
  }

  const activeMaxAgeHours = toPositiveNumber(
    options.activeMaxAgeHours,
    DEFAULT_ACTIVE_MAX_AGE_HOURS
  );
  const plannedToleranceMinutes = toPositiveNumber(
    options.plannedToleranceMinutes,
    DEFAULT_PLANNED_TOLERANCE_MINUTES
  );

  const nowMs = nowDate.getTime();
  const activeMaxAgeMs = activeMaxAgeHours * 60 * 60 * 1000;
  const plannedToleranceMs = plannedToleranceMinutes * 60 * 1000;

  const eligibleSessions = list
    .filter((session) => session?.myStatus === 'CONFIRMED')
    .filter((session) => session?.status !== 'CANCELED' && session?.status !== 'FINISHED')
    .map((session) => {
      const startAt = toSessionStartDate(session);

      return {
        raw: session,
        status: session?.status,
        startAt,
        startAtMs: startAt ? startAt.getTime() : Number.NaN,
        id: normalizeId(session?.id),
      };
    });

  const activeCandidates = eligibleSessions
    .filter((session) => session.status === 'ACTIVE')
    .filter((session) => Number.isFinite(session.startAtMs))
    .filter((session) => nowMs - session.startAtMs <= activeMaxAgeMs)
    .sort(compareByStartThenId);

  if (activeCandidates.length > 0) {
    return activeCandidates[0].raw;
  }

  const plannedCandidates = eligibleSessions
    .filter((session) => session.status === 'PLANNED')
    .filter((session) => Number.isFinite(session.startAtMs))
    .filter((session) => session.startAtMs >= nowMs - plannedToleranceMs)
    .sort(compareByStartThenId);

  if (plannedCandidates.length > 0) {
    return plannedCandidates[0].raw;
  }

  return null;
}

module.exports = {
  selectNextRelevantSession,
  compareByStartThenId,
  toSessionStartDate,
  DEFAULT_ACTIVE_MAX_AGE_HOURS,
  DEFAULT_PLANNED_TOLERANCE_MINUTES,
};
