async function _assertNoSessionTimeConflict(
  {
    prisma,
    AppError,
    ERROR_CODES,
  },
  userId,
  targetStart,
  targetDuration,
  options = {}
) {
  const { excludeSessionId = null, conflictErrorCode = ERROR_CODES.VALIDATION_FAILED } = options;

  const userSessions = await prisma.session.findMany({
    where: {
      status: { in: ['PLANNED', 'ACTIVE'] },
      participants: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      date: true,
      duration: true,
    },
  });

  const targetStartDate = new Date(targetStart);
  const targetEndDate = _getSessionEnd(targetStartDate, targetDuration);

  const hasConflict = userSessions.some((session) => {
    if (excludeSessionId && session.id === Number(excludeSessionId)) {
      return false;
    }

    const sessionStart = new Date(session.date);
    const sessionEnd = _getSessionEnd(session.date, session.duration);

    return _isIntervalsOverlap(targetStartDate, targetEndDate, sessionStart, sessionEnd);
  });

  if (hasConflict) {
    throw new AppError(conflictErrorCode);
  }
}

function _getDateKeyInTimeZone(dateValue, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date(dateValue));
}

function _isSameDayInTimeZone(firstDate, secondDate, timeZone = 'UTC') {
  try {
    return _getDateKeyInTimeZone(firstDate, timeZone) === _getDateKeyInTimeZone(secondDate, timeZone);
  } catch {
    return _getDateKeyInTimeZone(firstDate, 'UTC') === _getDateKeyInTimeZone(secondDate, 'UTC');
  }
}

function _getSessionEnd(sessionDateValue, durationMinutes = 0) {
  const sessionStart = new Date(sessionDateValue);
  const safeDurationMinutes = Number.isFinite(Number(durationMinutes))
    ? Number(durationMinutes)
    : 0;

  return new Date(sessionStart.getTime() + safeDurationMinutes * 60 * 1000);
}

function _getSessionEndWithGrace(sessionDateValue, durationMinutes = 0, graceHours = 2) {
  const sessionStart = new Date(sessionDateValue);
  const safeDurationMinutes = Number.isFinite(Number(durationMinutes))
    ? Number(durationMinutes)
    : 0;

  return new Date(
    sessionStart.getTime()
    + safeDurationMinutes * 60 * 1000
    + graceHours * 60 * 60 * 1000
  );
}

function _isIntervalsOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

module.exports = {
  _assertNoSessionTimeConflict,
  _getDateKeyInTimeZone,
  _isSameDayInTimeZone,
  _getSessionEnd,
  _getSessionEndWithGrace,
  _isIntervalsOverlap,
};