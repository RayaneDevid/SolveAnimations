import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { buildAnimationEmbed, buildJoinRow } from '../../discord/embeds/animation.js';
import client from '../../discord/client.js';
import { env } from '../../config/env.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
  publicMessageId: z.string().optional(),
  title: z.string(),
  scheduledAt: z.string(),
  plannedDurationMin: z.number().int(),
  prepTimeMin: z.number().int(),
  server: z.string(),
  type: z.string(),
  village: z.string(),
  documentUrl: z.string().optional(),
  creatorUsername: z.string(),
  requiredParticipants: z.number().int(),
  registrationsLocked: z.boolean().optional().default(false),
});

export async function registerAnimationUpdated(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-updated',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const payload = parsed.data;

      if (payload.publicMessageId) {
        try {
          const announceChannel = await client.channels.fetch(env.DISCORD_ANNOUNCE_CHANNEL_ID);
          if (announceChannel?.isTextBased()) {
            const msg = await (announceChannel as import('discord.js').TextChannel).messages.fetch(payload.publicMessageId);
            const embed = buildAnimationEmbed({ ...payload, status: 'open' });
            await msg.edit({ embeds: [embed], components: [buildJoinRow(payload.animationId, payload.registrationsLocked)] });
          }
        } catch (err) {
          console.warn('[animation-updated] Could not edit public message:', err);
        }
      }

      return reply.send({ success: true, data: {} });
    },
  );
}
