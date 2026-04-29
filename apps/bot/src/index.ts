import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { env } from './config/env.js';
import client from './discord/client.js';
import { startDiscordProfileSyncScheduler } from './discord/profile-sync.js';
import { startAnimationReminderScheduler } from './discord/reminders.js';
import { createFastifyServer } from './http/server.js';

const SLASH_COMMANDS = [
  new SlashCommandBuilder()
    .setName('animation-create')
    .setDescription('Créer une nouvelle animation via un formulaire'),
].map((cmd) => cmd.toJSON());

async function bootstrap(): Promise<void> {
  console.log('🚀 Starting Solve Animations Bot...');

  // 1. Connect to Discord and wait for ready
  await new Promise<void>((resolve, reject) => {
    client.once('ready', () => resolve());
    client.once('error', (err) => reject(err));
    client.login(env.DISCORD_BOT_TOKEN).catch(reject);
  });

  console.log('✅ Discord client connected.');

  // Register slash commands on the guild
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user!.id, env.DISCORD_GUILD_ID), {
    body: SLASH_COMMANDS,
  });
  console.log('✅ Slash commands registered.');

  // 2. Start the Fastify HTTP server
  const app = await createFastifyServer();

  try {
    await app.listen({ port: env.BOT_PORT, host: '0.0.0.0' });
    console.log(`✅ HTTP server listening on port ${env.BOT_PORT}`);
  } catch (err) {
    console.error('❌ Failed to start HTTP server:', err);
    process.exit(1);
  }

  const reminderTimer = startAnimationReminderScheduler();
  console.log('✅ Animation reminder scheduler started.');
  const profileSyncTimer = startDiscordProfileSyncScheduler();
  console.log('✅ Discord profile sync scheduler started.');

  // 3. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down...`);
    clearInterval(reminderTimer);
    clearInterval(profileSyncTimer);
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
