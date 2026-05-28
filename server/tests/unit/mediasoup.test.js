const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const mediasoup = require('mediasoup');

mock.method(os, 'cpus', () => [1, 2, 3, 4]);

mock.method(mediasoup, 'createWorker', async () => {
  return {
    pid: Math.floor(Math.random() * 10000),
    on: mock.fn(),
    close: mock.fn()
  };
});

const mediasoupLib = require('../../src/lib/mediasoup');

describe('Mediasoup Worker Manager', () => {
  beforeEach(() => {
    mediasoup.createWorker.mock.resetCalls();
    mediasoupLib.closeWorkers();
  });

  afterEach(() => {
    mediasoupLib.closeWorkers();
  });

  test('initWorkers creates workers based on CPU cores', async () => {
    await mediasoupLib.initWorkers();
    
    assert.strictEqual(mediasoup.createWorker.mock.calls.length, 4);
  });

  test('getWorker returns worker round-robin', async () => {
    await mediasoupLib.initWorkers();

    const w1 = mediasoupLib.getWorker();
    const w2 = mediasoupLib.getWorker();
    const w3 = mediasoupLib.getWorker();
    const w4 = mediasoupLib.getWorker();
    const w5 = mediasoupLib.getWorker();

    assert.ok(w1);
    assert.ok(w2);
    assert.strictEqual(w1, w5);
    assert.notStrictEqual(w1, w2);
  });

  test('getWorker throws if workers not initialized', () => {
    assert.throws(() => mediasoupLib.getWorker(), /Mediasoup workers не ініціалізовані/);
  });

  test('closeWorkers closes all workers and clears the array', async () => {
    await mediasoupLib.initWorkers();
    
    const w1 = mediasoupLib.getWorker();
    
    mediasoupLib.closeWorkers();
    
    assert.strictEqual(w1.close.mock.calls.length, 1);
    assert.throws(() => mediasoupLib.getWorker(), /Mediasoup workers не ініціалізовані/);
  });
});
