import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import { env, isProd } from './lib/env.js';
import { sendError } from './lib/errors.js';
import { getRedis } from './lib/redis.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerHealthRoutes } from './modules/health/routes.js';
import { registerUserRoutes } from './modules/users/routes.js';
import { registerConfigRoutes } from './modules/configs/routes.js';
import { registerNodeRoutes } from './modules/nodes/routes.js';
import { registerAgentRoutes } from './modules/agent/routes.js';
import { registerSubscriptionRoutes } from './modules/subscriptions/routes.js';
import { registerPublicSubRoutes } from './modules/publicsub/routes.js';
import { registerPlanRoutes } from './modules/plans/routes.js';
import { registerGroupRoutes } from './modules/groups/routes.js';
import { registerResellerRoutes } from './modules/resellers/routes.js';
import { registerApiKeyRoutes } from './modules/apikeys/routes.js';
import { registerAuditRoutes } from './modules/audit/routes.js';
import { registerNotificationRoutes } from './modules/notifications/routes.js';
import { registerDashboardRoutes } from './modules/dashboard/routes.js';
import { registerSearchRoutes } from './modules/search/routes.js';
import { registerSettingsRoutes } from './modules/settings/routes.js';
import { registerAdminRoutes } from './modules/admins/routes.js';
import { registerReportRoutes } from './modules/reports/routes.js';
import { registerRealtimeRoutes } from './modules/realtime/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
    bodyLimit: 1_000_000,
  });

  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'no-referrer');
  });

  app.setErrorHandler((err, request, reply) => sendError(reply, err, request.id));

  await app.register(cors, {
    origin: isProd ? [env.CORS_ORIGIN, env.PUBLIC_URL] : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
  });

  await app.register(cookie);
  if (env.NODE_ENV !== 'test') {
    await app.register(rateLimit, {
      max: 600,
      timeWindow: 60_000,
      redis: getRedis() ?? undefined,
      allowList: () => false,
    });
  }

  await app.register(async (api) => {
    await registerHealthRoutes(api);
    await registerAuthRoutes(api);
    await registerPublicSubRoutes(api);
    await registerUserRoutes(api);
    await registerConfigRoutes(api);
    await registerNodeRoutes(api);
    await registerAgentRoutes(api);
    await registerSubscriptionRoutes(api);
    await registerPlanRoutes(api);
    await registerGroupRoutes(api);
    await registerResellerRoutes(api);
    await registerApiKeyRoutes(api);
    await registerAuditRoutes(api);
    await registerNotificationRoutes(api);
    await registerDashboardRoutes(api);
    await registerSearchRoutes(api);
    await registerSettingsRoutes(api);
    await registerAdminRoutes(api);
    await registerReportRoutes(api);
    await registerRealtimeRoutes(api);
  }, { prefix: '/api/v1' });

  if (process.env.VITEST !== 'true') {
    await registerSwagger(app);
  }

  // Serve the built web app (single-service deployment on Railway)
  const webDist = resolve(process.cwd(), 'apps/web/dist');
  const webDistAlt = resolve(process.cwd(), '../web/dist');
  const dist = existsSync(webDist) ? webDist : existsSync(webDistAlt) ? webDistAlt : null;
  if (dist) {
    await app.register(fastifyStatic, { root: dist, index: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        reply.status(404).send({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Not found' }, requestId: req.id });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  return app;
}

async function registerSwagger(app: FastifyInstance): Promise<void> {
  if (isProd) return;
  const swagger = (await import('@fastify/swagger')).default;
  const swaggerUi = (await import('@fastify/swagger-ui')).default;
  await app.register(swagger, {
    openapi: {
      info: { title: 'ViraPanel API', version: '1.0.0' },
      components: { securitySchemes: { cookie: { type: 'apiKey', in: 'cookie', name: 'vira_sid' }, bearer: { type: 'http', scheme: 'bearer' } } },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
}
