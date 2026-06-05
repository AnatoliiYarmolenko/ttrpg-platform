const test = require('node:test');
const assert = require('node:assert/strict');

const authRoutes = require('../../src/routes/auth.routes');
const profileRoutes = require('../../src/routes/profile.routes');
const securityRoutes = require('../../src/routes/security.routes');
const adminRoutes = require('../../src/routes/admin.routes');
const campaignRoutes = require('../../src/routes/campaign.routes');
const sessionRoutes = require('../../src/routes/session.routes');
const chatRoutes = require('../../src/routes/chat.routes');
const searchRoutes = require('../../src/routes/search.routes');
const clientLogsRoutes = require('../../src/routes/client-logs.routes');
const notificationRoutes = require('../../src/routes/notification.routes');

function collectRouteMiddleware(router) {
  const routes = [];
  
  if (!router?.stack) return routes;

  router.stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter((method) => layer.route.methods[method]);
      routes.push({
        path: layer.route.path,
        methods,
        middlewareNames: layer.route.stack.map((routeLayer) => routeLayer.handle.name),
      });
    }
  });
  
  return routes;
}

const routersToTest = [
  { name: 'Auth', router: authRoutes },
  { name: 'Profile', router: profileRoutes },
  { name: 'Security', router: securityRoutes },
  { name: 'Admin', router: adminRoutes },
  { name: 'Campaign', router: campaignRoutes },
  { name: 'Session', router: sessionRoutes },
  { name: 'Chat', router: chatRoutes },
  { name: 'Search', router: searchRoutes },
  { name: 'Client Logs', router: clientLogsRoutes },
  { name: 'Notifications', router: notificationRoutes }
];

test('All write routes must enforce CSRF verification', () => {
  const unsafeMethods = new Set(['post', 'put', 'patch', 'delete']);
  
  for (const { name, router } of routersToTest) {
    const routes = collectRouteMiddleware(router);
    const routerLevelMiddleware = new Set(
      router.stack
        .filter((layer) => layer.name === 'setCSRFToken' || layer.name === 'verifyCSRFToken')
        .map((layer) => layer.name)
    );
      
    for (const route of routes) {
      const isUnsafe = route.methods.some((m) => unsafeMethods.has(m));
      
      if (isUnsafe) {
        const hasCsrf = route.middlewareNames.includes('verifyCSRFToken') || routerLevelMiddleware.has('verifyCSRFToken') || routerLevelMiddleware.has('setCSRFToken');
        
        assert.ok(
          hasCsrf,
          `${name} route ${route.methods.join(',').toUpperCase()} ${route.path} should include verifyCSRFToken`
        );
      }
    }
  }
});

test('Dashboard calendar routes require auth instead of silently falling back to anonymous mode', () => {
  const routes = collectRouteMiddleware(sessionRoutes);
  const protectedRoutes = [
    { method: 'get', path: '/calendar-stats' },
    { method: 'get', path: '/day-filtered/:date' },
  ];

  for (const expectedRoute of protectedRoutes) {
    const route = routes.find(({ path, methods }) => path === expectedRoute.path && methods.includes(expectedRoute.method));

    assert.ok(route, `Route ${expectedRoute.method.toUpperCase()} ${expectedRoute.path} should exist`);
    assert.ok(
      route.middlewareNames.includes('authenticateToken'),
      `Route ${expectedRoute.method.toUpperCase()} ${expectedRoute.path} should include authenticateToken`
    );
    assert.ok(
      !route.middlewareNames.includes('optionalAuthenticateToken'),
      `Route ${expectedRoute.method.toUpperCase()} ${expectedRoute.path} should not include optionalAuthenticateToken`
    );
  }
});