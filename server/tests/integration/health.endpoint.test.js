const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../../src/app');

test('GET /health returns ok payload', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.timestamp);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

