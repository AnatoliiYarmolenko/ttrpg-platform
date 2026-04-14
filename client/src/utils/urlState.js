export function normalizeEnumValue(value, allowedValues, defaultValue) {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  return allowedValues.includes(value) ? value : defaultValue;
}

export function parseEnumSearchParam(searchParams, key, allowedValues, defaultValue) {
  return normalizeEnumValue(searchParams.get(key), allowedValues, defaultValue);
}

export function parsePositiveIntSearchParam(searchParams, key) {
  const raw = searchParams.get(key);
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function setOrDeleteParam(searchParams, key, value, defaultValue = null) {
  if (!value || value === defaultValue) {
    searchParams.delete(key);
    return;
  }

  searchParams.set(key, value);
}

export function updateSearchParams(setSearchParams, updater, options) {
  const navigationOptions = options ?? { replace: false };

  setSearchParams(
    (prev) => {
      const next = new URLSearchParams(prev);
      updater(next);
      return next;
    },
    navigationOptions
  );
}
