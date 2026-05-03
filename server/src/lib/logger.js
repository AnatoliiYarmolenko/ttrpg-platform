const pino = require('pino');
const pinoHttp = require('pino-http');

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

function resolvePrettyTransport() {
  if (isProduction) {
    return undefined;
  }

  try {
    require.resolve('pino-pretty');
    return pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    });
  } catch {
    // Fallback for environments where devDependencies are not installed.
    return undefined;
  }
}

const transport = resolvePrettyTransport();

const logger = pino(
  {
    level: logLevel,
    base: isProduction ? undefined : null,
  },
  transport
);

const httpLogger = pinoHttp({
  logger,
  customProps: (req) => ({
    correlationId: req.correlationId,
  }),
  serializers: {
    req(req) {
      return {
        id: req.id,
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        query: Object.keys(req.query || {}).length ? req.query : undefined,
        params: Object.keys(req.params || {}).length ? req.params : undefined,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});

module.exports = {
  logger,
  httpLogger,
};
