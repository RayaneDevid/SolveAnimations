import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { STATUS_COLORS, STATUS_EMOJI, STATUS_LABELS } from '../../discord/embeds/animation.js';
import { sendDM } from '../../discord/actions/sendDM.js';
import client from '../../discord/client.js';
import { env } from '../../config/env.js';
import { EmbedBuilder } from 'discord.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
  publicMessageId: z.string().optional(),
  newScheduledAt: z.string(),
  title: z.string(),
  formerParticipantDiscordIds: z.array(z.string()),
});

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(':', 'h');
}

export async function registerAnimationPostponed(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-postponed',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const { publicMessageId, newScheduledAt, title, formerParticipantDiscordIds } = parsed.data;

      // 1. Edit the public message with new date and postponed status
      if (publicMessageId) {
        try {
          const announceChannel = await client.channels.fetch(env.DISCORD_ANNOUNCE_CHANNEL_ID);
          if (announceChannel?.isTextBased()) {
            const msg = await (announceChannel as import('discord.js').TextChannel).messages.fetch(publicMessageId);

            const existingEmbed = msg.embeds[0];
            if (existingEmbed) {
              let description = existingEmbed.description ?? '';
              // Update the date line
              description = description.replace(
                /🗓️.+/,
                `🗓️  ${formatDate(newScheduledAt)}`,
              );
              // Update the status line
              description = description.replace(
                /Statut : .+/,
                `Statut : ${STATUS_EMOJI['postponed']} ${STATUS_LABELS['postponed']}`,
              );

              const updatedEmbed = EmbedBuilder.from(existingEmbed)
                .setColor(STATUS_COLORS['postponed'])
                .setDescription(description);
              await msg.edit({ embeds: [updatedEmbed] });
            }
          }
        } catch (err) {
          console.warn('[animation-postponed] Could not edit public message:', err);
        }
      }

      // 2. Send DMs to all former participants
      const formattedDate = formatDate(newScheduledAt);
      const dmText = `🟠 L'animation **${title}** a été reportée au **${formattedDate}**.\n\nTa participation a été annulée — tu pourras te réinscrire une fois la nouvelle date confirmée.`;

      await Promise.allSettled(
        formerParticipantDiscordIds.map((discordId) => sendDM(discordId, dmText)),
      );

      return reply.send({ success: true, data: {} });
    },
  );
}
