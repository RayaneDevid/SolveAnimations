import Fastify, { FastifyInstance } from 'fastify';
import { registerAnimationCreated } from './routes/animation-created.js';
import { registerAnimationValidated } from './routes/animation-validated.js';
import { registerAnimationRejected } from './routes/animation-rejected.js';
import { registerAnimationUpdated } from './routes/animation-updated.js';
import { registerAnimationStarted } from './routes/animation-started.js';
import { registerAnimationFinished } from './routes/animation-finished.js';
import { registerAnimationPostponed } from './routes/animation-postponed.js';
import { registerAnimationReminder } from './routes/animation-reminder.js';
import { registerAnimationEmbedRefresh } from './routes/animation-embed-refresh.js';
import { registerMemberRemoveRoles } from './routes/member-remove-roles.js';
import { registerMemberRestoreRoles } from './routes/member-restore-roles.js';
import { registerAnimationDeletionRequested } from './routes/animation-deletion-requested.js';
import { registerRequeteCreated } from './routes/requete-created.js';
import { registerReportSubmitted } from './routes/report-submitted.js';

export async function createFastifyServer(): Promise<FastifyInstance> {
  const isDev = process.env['NODE_ENV'] !== 'production';
  const app = Fastify({
    logger: isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : true,
  });

  // Health check
  app.get('/health', async (_req, reply) => {
    return reply.send({ success: true, data: { status: 'ok' } });
  });

  // Register webhook routes
  await registerAnimationCreated(app);
  await registerAnimationValidated(app);
  await registerAnimationRejected(app);
  await registerAnimationUpdated(app);
  await registerAnimationStarted(app);
  await registerAnimationFinished(app);
  await registerAnimationPostponed(app);
  await registerAnimationReminder(app);
  await registerAnimationEmbedRefresh(app);
  await registerMemberRemoveRoles(app);
  await registerMemberRestoreRoles(app);
  await registerAnimationDeletionRequested(app);
  await registerRequeteCreated(app);
  await registerReportSubmitted(app);

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    console.error('[fastify] Unhandled error:', error);
    reply.status(500).send({ success: false, error: 'Internal server error' });
  });

  return app;
}
