import { env } from './config/env.js';
import client from './discord/client.js';
import { createFastifyServer } from './http/server.js';

async function bootstrap(): Promise<void> {
  console.log('🚀 Starting Solve Animations Bot...');

  // 1. Connect to Discord and wait for ready
  await new Promise<void>((resolve, reject) => {
    client.once('ready', () => resolve());
    client.once('error', (err) => reject(err));
    client.login(env.DISCORD_BOT_TOKEN).catch(reject);
  });

  console.log('✅ Discord client connected.');

  // 2. Start the Fastify HTTP server
  const app = await createFastifyServer();

  try {
    await app.listen({ port: env.BOT_PORT, host: '0.0.0.0' });
    console.log(`✅ HTTP server listening on port ${env.BOT_PORT}`);
  } catch (err) {
    console.error('❌ Failed to start HTTP server:', err);
    process.exit(1);
  }

  // 3. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down...`);
    await app.close();
    await client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('❌ Fatal bootstrap error:', err);
  process.exit(1);
});
