const { generateCorrelationId, withCorrelationId } = require('../lib/correlation');

const addCorrelationId = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  const sessionId = req.headers['x-session-id'] || req.headers['session-id'] || undefined;
  req.correlationId = correlationId;
  req.sessionId = sessionId;
  res.setHeader('X-Correlation-Id', correlationId);
  if (sessionId) {
    res.setHeader('X-Session-Id', sessionId);
  }

  withCorrelationId(correlationId, () => next());
};

module.exports = { addCorrelationId };
