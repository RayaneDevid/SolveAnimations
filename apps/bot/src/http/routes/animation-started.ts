import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { buildJoinRow, STATUS_COLORS, STATUS_EMOJI, STATUS_LABELS } from '../../discord/embeds/animation.js';
import client from '../../discord/client.js';
import { env } from '../../config/env.js';
import { EmbedBuilder } from 'discord.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
  publicMessageId: z.string().optional(),
});

export async function registerAnimationStarted(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-started',
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

            // Clone the existing embed and update status-related fields
            const existingEmbed = msg.embeds[0];
            if (existingEmbed) {
              const updatedEmbed = EmbedBuilder.from(existingEmbed)
                .setColor(STATUS_COLORS['running'])
                .setDescription(
                  (existingEmbed.description ?? '').replace(
                    /Statut : .+/,
                    `Statut : ${STATUS_EMOJI['running']} ${STATUS_LABELS['running']}`,
                  ),
                );
              await msg.edit({ embeds: [updatedEmbed], components: [buildJoinRow(parsed.data.animationId)] });
            }
          }
        } catch (err) {
          console.warn('[animation-started] Could not edit public message:', err);
        }
      }

      return reply.send({ success: true, data: {} });
    },
  );
}
