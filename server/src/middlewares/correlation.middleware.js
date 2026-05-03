const { generateCorrelationId, withCorrelationId } = require('../lib/correlation');

const addCorrelationId = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  withCorrelationId(correlationId, () => next());
};

module.exports = { addCorrelationId };
