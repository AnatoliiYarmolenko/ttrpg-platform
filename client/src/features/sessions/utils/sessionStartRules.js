export function isSameLocalDay(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
}

export function getSessionStartState(sessionDateValue, durationMinutes, now = new Date()) {
  if (!sessionDateValue) {
    return {
      canShowStartButton: false,
      warningType: null,
      warningMessage: '',
    };
  }

  const sessionDate = new Date(sessionDateValue);
  if (Number.isNaN(sessionDate.getTime())) {
    return {
      canShowStartButton: false,
      warningType: null,
      warningMessage: '',
    };
  }

  const canShowStartButton = isSameLocalDay(sessionDate, now);

  const diffMinutes = (now.getTime() - sessionDate.getTime()) / (1000 * 60);
  const normalizedDuration = Number(durationMinutes);
  const lateThreshold = Number.isFinite(normalizedDuration) && normalizedDuration > 0
    ? normalizedDuration / 2
    : Infinity;

  let warningType = null;
  let warningMessage = '';

  if (diffMinutes < -60) {
    warningType = 'early';
    warningMessage = 'Сесія починається раніше запланованого часу.';
  } else if (diffMinutes > lateThreshold) {
    warningType = 'very_late';
    warningMessage = 'Сесія сильно запізнюється (минуло більше половини її тривалості).';
  }

  return {
    canShowStartButton,
    warningType,
    warningMessage,
  };
}
