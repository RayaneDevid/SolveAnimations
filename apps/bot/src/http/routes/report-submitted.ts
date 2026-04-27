import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EmbedBuilder } from 'discord.js';
import { verifyBotSecret } from '../auth.js';
import client from '../../discord/client.js';
import { env } from '../../config/env.js';

const bodySchema = z.object({
  reportId: z.string().uuid(),
  animationId: z.string().uuid(),
  animationTitle: z.string(),
  username: z.string(),
  characterName: z.string(),
  comments: z.string().nullable().optional(),
  pole: z.string(),
  submittedAt: z.string(),
});

export async function registerReportSubmitted(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/report-submitted',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const payload = parsed.data;

      try {
        const channel = await client.channels.fetch(env.DISCORD_REPORTS_CHANNEL_ID);
        if (channel?.isTextBased()) {
          const panelUrl = `${env.APP_PUBLIC_URL}/panel/animations/${payload.animationId}`;
          const embed = new EmbedBuilder()
            .setColor(0x22c55e)
            .setTitle('Rapport soumis')
            .setDescription(
              [
                `**Animation :** [${payload.animationTitle}](${panelUrl})`,
                `**Membre :** ${payload.username}`,
                `**Personnage :** ${payload.characterName}`,
                `**Pôle :** ${payload.pole === 'mj' ? 'MJ' : 'Animation'}`,
                payload.comments ? `\n**Commentaires :**\n${payload.comments.slice(0, 1500)}` : null,
              ].filter(Boolean).join('\n'),
            )
            .setTimestamp(new Date(payload.submittedAt));

          await (channel as import('discord.js').TextChannel).send({ embeds: [embed] });
        }
      } catch (err) {
        console.warn('[report-submitted] Could not post report notification:', err);
      }

      return reply.send({ success: true, data: {} });
    },
  );
}
