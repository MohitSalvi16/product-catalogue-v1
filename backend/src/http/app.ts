import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { errorHandler } from './errorHandler.js';
import { registerRoutes, type RouteDependencies } from './routes.js';

export async function buildApp(deps: RouteDependencies, options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  await app.register(helmet);
  await app.register(rateLimit, { global: false });
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } }),
  );

  registerRoutes(app, deps);
  return app;
}
