import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { buildAnimationEmbed, buildJoinRow } from '../../discord/embeds/animation.js';
import client from '../../discord/client.js';
import { env } from '../../config/env.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
  publicMessageId: z.string(),
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
  currentParticipants: z.number().int().default(0),
  status: z.string(),
  actualDurationMin: z.number().int().optional(),
});

export async function registerAnimationEmbedRefresh(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-embed-refresh',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const payload = parsed.data;

      try {
        const channel = await client.channels.fetch(env.DISCORD_ANNOUNCE_CHANNEL_ID);
        if (channel?.isTextBased()) {
          const msg = await (channel as import('discord.js').TextChannel).messages.fetch(payload.publicMessageId);
          if (['finished', 'cancelled'].includes(payload.status)) {
            await msg.delete();
            return reply.send({ success: true, data: {} });
          }

          const embed = buildAnimationEmbed(payload);
          const components = ['open', 'preparing', 'running'].includes(payload.status)
            ? [buildJoinRow(payload.animationId, payload.registrationsLocked)]
            : [];
          await msg.edit({ embeds: [embed], components });
        }
      } catch (err) {
        console.warn('[animation-embed-refresh] Could not edit message:', err);
      }

      return reply.send({ success: true, data: {} });
    },
  );
}
