const test = require('node:test');
const assert = require('node:assert/strict');

const adminRoutes = require('../src/routes/admin.routes');
const campaignRoutes = require('../src/routes/campaign.routes');
const sessionRoutes = require('../src/routes/session.routes');

function collectRouteMiddleware(router) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => {
      const methods = Object.keys(layer.route.methods).filter((method) => layer.route.methods[method]);

      return {
        path: layer.route.path,
        methods,
        middlewareNames: layer.route.stack.map((routeLayer) => routeLayer.handle.name),
      };
    });
}

function assertRouteUsesCsrf(router, expectedUnsafeRoutes) {
  const routes = collectRouteMiddleware(router);

  for (const expectedRoute of expectedUnsafeRoutes) {
    const route = routes.find(({ path, methods }) => path === expectedRoute.path && methods.includes(expectedRoute.method));

    assert.ok(route, `Route ${expectedRoute.method.toUpperCase()} ${expectedRoute.path} should exist`);
    assert.ok(
      route.middlewareNames.includes('verifyCSRFToken'),
      `Route ${expectedRoute.method.toUpperCase()} ${expectedRoute.path} should include verifyCSRFToken`
    );
  }
}

test('Campaign write routes enforce CSRF verification', () => {
  assertRouteUsesCsrf(campaignRoutes, [
    { method: 'post', path: '/' },
    { method: 'put', path: '/:campaignId' },
    { method: 'post', path: '/:campaignId/transfer-ownership' },
    { method: 'post', path: '/:campaignId/members' },
    { method: 'delete', path: '/:campaignId/members/:memberId' },
    { method: 'patch', path: '/:campaignId/members/:memberId' },
    { method: 'post', path: '/:campaignId/share/regenerate' },
    { method: 'post', path: '/:campaignId/requests' },
    { method: 'post', path: '/requests/:requestId/approve' },
    { method: 'post', path: '/requests/:requestId/reject' },
  ]);
});

test('Session write routes enforce CSRF verification', () => {
  assertRouteUsesCsrf(sessionRoutes, [
    { method: 'post', path: '/' },
    { method: 'patch', path: '/:id' },
    { method: 'delete', path: '/:id' },
    { method: 'post', path: '/:id/cancel' },
    { method: 'post', path: '/:id/mark-finished' },
    { method: 'post', path: '/:id/join' },
    { method: 'post', path: '/:id/leave' },
    { method: 'post', path: '/:id/kick-gm' },
    { method: 'patch', path: '/:id/participants/:participantId' },
    { method: 'delete', path: '/:id/participants/:participantId' },
  ]);
});

test('Admin write routes enforce CSRF verification', () => {
  assertRouteUsesCsrf(adminRoutes, [
    { method: 'post', path: '/cleanup-tokens' },
    { method: 'delete', path: '/campaigns/:id' },
    { method: 'delete', path: '/sessions/:id' },
  ]);
});