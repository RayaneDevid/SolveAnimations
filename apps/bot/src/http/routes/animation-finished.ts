import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import client from '../../discord/client.js';
import { env } from '../../config/env.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
  publicMessageId: z.string().optional(),
  actualDurationMin: z.number().int(),
});

export async function registerAnimationFinished(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-finished',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const { publicMessageId } = parsed.data;

      if (publicMessageId) {
        try {
          const announceChannel = await client.channels.fetch(env.DISCORD_ANNOUNCE_CHANNEL_ID);
          if (announceChannel?.isTextBased()) {
            const msg = await (announceChannel as import('discord.js').TextChannel).messages.fetch(publicMessageId);

            await msg.delete();
          }
        } catch (err) {
          console.warn('[animation-finished] Could not delete public message:', err);
        }
      }

      return reply.send({ success: true, data: {} });
    },
  );
}
