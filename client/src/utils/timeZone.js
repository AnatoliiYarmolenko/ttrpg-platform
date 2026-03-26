const TIMEZONE_ALIASES = {
  'Europe/Kiev': 'Europe/Kyiv',
};

export function normalizeTimeZoneValue(timeZone) {
  if (!timeZone) return timeZone;

  return TIMEZONE_ALIASES[timeZone] || timeZone;
}

export function formatTimeZoneLabel(timeZone) {
  return normalizeTimeZoneValue(timeZone);
}
