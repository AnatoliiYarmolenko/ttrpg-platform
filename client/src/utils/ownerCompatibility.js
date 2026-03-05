const hasOwnerCompatibilityFields = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return (
    Object.prototype.hasOwnProperty.call(value, 'owner')
    || Object.prototype.hasOwnProperty.call(value, 'ownerId')
  );
};

export const normalizeOwnerFieldsDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeOwnerFieldsDeep(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const owner = hasOwnerCompatibilityFields(value)
    ? (value.owner ?? null)
    : undefined;
  const ownerId = hasOwnerCompatibilityFields(value)
    ? (value.ownerId ?? owner?.id ?? null)
    : undefined;

  const normalized = {
    ...value,
    ...(hasOwnerCompatibilityFields(value) ? { owner, ownerId } : {}),
  };

  Object.keys(normalized).forEach((key) => {
    normalized[key] = normalizeOwnerFieldsDeep(normalized[key]);
  });

  return normalized;
};

export const normalizeApiEnvelope = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return normalizeOwnerFieldsDeep(payload);
  }

  return {
    ...payload,
    data: normalizeOwnerFieldsDeep(payload.data),
  };
};
