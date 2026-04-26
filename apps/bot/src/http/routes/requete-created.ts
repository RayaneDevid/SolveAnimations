import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { verifyBotSecret } from '../auth.js';
import { buildRequeteEmbed } from '../../discord/embeds/requete.js';
import client from '../../discord/client.js';
import { env } from '../../config/env.js';

const bodySchema = z.object({
  requeteId:       z.string().uuid(),
  subject:         z.string(),
  destination:     z.enum(['ra', 'rmj']),
  description:     z.string(),
  creatorUsername: z.string(),
  creatorDiscordId: z.string().nullable().optional(),
});

export async function registerRequeteCreated(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/requete-created',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const { requeteId, subject, destination, description, creatorUsername } = parsed.data;

      try {
        const channel = await client.channels.fetch(env.DISCORD_VALIDATION_CHANNEL_ID);
        if (!channel?.isTextBased()) {
          return reply.status(500).send({ success: false, error: 'Validation channel introuvable' });
        }

        const embed = buildRequeteEmbed({
          requeteId,
          subject,
          destination,
          description,
          creatorUsername,
          status: 'pending',
        });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`requete-accept:${requeteId}`)
            .setLabel('Accepter')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`requete-refuse:${requeteId}`)
            .setLabel('Refuser')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌'),
        );

        // Ping le rôle concerné selon la destination
        const pingRoleId = destination === 'ra' ? env.ROLE_RESPONSABLE : env.ROLE_RESPONSABLE_MJ;
        const pingContent = pingRoleId ? `<@&${pingRoleId}>` : undefined;
        const allowedRoles = pingRoleId ? [pingRoleId] : [];

        const message = await (channel as TextChannel).send({
          content: pingContent,
          embeds: [embed],
          components: [row],
          allowedMentions: { roles: allowedRoles },
        });

        return reply.send({ success: true, data: { messageId: message.id } });
      } catch (err) {
        console.error('[requete-created] Error posting embed:', err);
        return reply.status(500).send({ success: false, error: 'Failed to post requete embed' });
      }
    },
  );
}
