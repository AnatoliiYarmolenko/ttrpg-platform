// Просте зберігання останнього correlation ID
let latestCorrelationId = null;

export const setCorrelationId = (id) => { latestCorrelationId = id; };
export const getLatestCorrelationId = () => latestCorrelationId;
