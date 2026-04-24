import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EmbedBuilder } from 'discord.js';
import { verifyBotSecret } from '../auth.js';
import { STATUS_LABELS, STATUS_EMOJI } from '../../discord/embeds/animation.js';
import client from '../../discord/client.js';
import { env, STAFF_ROLE_IDS } from '../../config/env.js';

const bodySchema = z.object({
  requestId: z.string().uuid(),
  animationId: z.string().uuid(),
  animationTitle: z.string(),
  animationStatus: z.string(),
  requestedByUsername: z.string(),
  requestedByDiscordId: z.string(),
});

export async function registerAnimationDeletionRequested(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-deletion-requested',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const { animationId, animationTitle, animationStatus, requestedByUsername } = parsed.data;

      const panelUrl = `${env.APP_PUBLIC_URL}/panel/validation`;
      const animUrl = `${env.APP_PUBLIC_URL}/panel/animations/${animationId}`;
      const statusLabel = STATUS_LABELS[animationStatus] ?? animationStatus;
      const statusEmoji = STATUS_EMOJI[animationStatus] ?? '❓';

      const embed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('🗑️  Demande de suppression')
        .setDescription(
          [
            '────────────────────────────────',
            `**Animation :** [${animationTitle}](${animUrl})`,
            `**Statut :** ${statusEmoji} ${statusLabel}`,
            `**Demandé par :** @${requestedByUsername}`,
            '',
            `Un animateur demande la suppression définitive de cette animation.`,
          ].join('\n'),
        )
        .addFields({
          name: '​',
          value: `[🔗 Gérer dans le panel](${panelUrl})`,
          inline: false,
        })
        .setTimestamp();

      try {
        const validationChannel = await client.channels.fetch(env.DISCORD_VALIDATION_CHANNEL_ID);
        if (!validationChannel?.isTextBased()) {
          return reply.status(500).send({ success: false, error: 'Validation channel not found' });
        }

        // Mention responsable roles if configured
        const mentions = [env.ROLE_RESPONSABLE, env.ROLE_RESPONSABLE_MJ]
          .filter((id): id is string => Boolean(id))
          .map((id) => `<@&${id}>`)
          .join(' ');

        const textChannel = validationChannel as import('discord.js').TextChannel;
        await textChannel.send({
          content: mentions || undefined,
          embeds: [embed],
        });
      } catch (err) {
        console.error('[animation-deletion-requested] Error posting to validation channel:', err);
        return reply.status(500).send({ success: false, error: 'Failed to post message' });
      }

      return reply.send({ success: true, data: {} });
    },
  );
}
