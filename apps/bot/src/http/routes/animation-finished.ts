import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { STATUS_COLORS, STATUS_EMOJI, STATUS_LABELS } from '../../discord/embeds/animation.js';
import client from '../../discord/client.js';
import { env } from '../../config/env.js';
import { EmbedBuilder } from 'discord.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
  publicMessageId: z.string().optional(),
  actualDurationMin: z.number().int(),
});

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export async function registerAnimationFinished(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-finished',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const { publicMessageId, actualDurationMin } = parsed.data;

      if (publicMessageId) {
        try {
          const announceChannel = await client.channels.fetch(env.DISCORD_ANNOUNCE_CHANNEL_ID);
          if (announceChannel?.isTextBased()) {
            const msg = await (announceChannel as import('discord.js').TextChannel).messages.fetch(publicMessageId);

            const existingEmbed = msg.embeds[0];
            if (existingEmbed) {
              // Replace duration line and status
              let description = existingEmbed.description ?? '';
              description = description.replace(
                /⏱️.+/,
                `⏱️  Durée réelle : ${formatDuration(actualDurationMin)}`,
              );
              description = description.replace(
                /Statut : .+/,
                `Statut : ${STATUS_EMOJI['finished']} ${STATUS_LABELS['finished']}`,
              );

              const updatedEmbed = EmbedBuilder.from(existingEmbed)
                .setColor(STATUS_COLORS['finished'])
                .setDescription(description);
              await msg.edit({ embeds: [updatedEmbed] });
            }
          }
        } catch (err) {
          console.warn('[animation-finished] Could not edit public message:', err);
        }
      }

      return reply.send({ success: true, data: {} });
    },
  );
}
