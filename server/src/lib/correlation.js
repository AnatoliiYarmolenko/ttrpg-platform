const { AsyncLocalStorage } = require('async_hooks');
const { v4: uuidv4 } = require('uuid');

const correlationStorage = new AsyncLocalStorage();

const generateCorrelationId = () => uuidv4();

const getCorrelationId = () => correlationStorage.getStore();

const withCorrelationId = (correlationId, callback) => {
  return correlationStorage.run(correlationId, callback);
};

module.exports = {
  correlationStorage,
  generateCorrelationId,
  getCorrelationId,
  withCorrelationId,
};
