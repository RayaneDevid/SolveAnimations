import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { buildAnimationEmbed } from '../../discord/embeds/animation.js';
import client from '../../discord/client.js';
import { env } from '../../config/env.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
  title: z.string(),
  scheduledAt: z.string(),
  plannedDurationMin: z.number().int(),
  prepTimeMin: z.number().int(),
  server: z.string(),
  type: z.string(),
  village: z.string(),
  documentUrl: z.string(),
  creatorUsername: z.string(),
  creatorDiscordId: z.string(),
  requiredParticipants: z.number().int(),
});

export async function registerAnimationCreated(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-created',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const payload = parsed.data;

      try {
        const channel = await client.channels.fetch(env.DISCORD_VALIDATION_CHANNEL_ID);
        if (!channel || !channel.isTextBased()) {
          return reply.status(500).send({ success: false, error: 'Validation channel not found or not text-based' });
        }

        const embed = buildAnimationEmbed({
          ...payload,
          status: 'pending_validation',
        });

        const message = await (channel as import('discord.js').TextChannel).send({ embeds: [embed] });

        return reply.send({ success: true, data: { adminMessageId: message.id } });
      } catch (err) {
        console.error('[animation-created] Error posting embed:', err);
        return reply.status(500).send({ success: false, error: 'Failed to post validation embed' });
      }
    },
  );
}
