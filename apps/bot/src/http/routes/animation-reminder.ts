import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { sendDM } from '../../discord/actions/sendDM.js';
import { env } from '../../config/env.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
  title: z.string(),
  scheduledAt: z.string(),
  server: z.string(),
  village: z.string(),
  participantDiscordIds: z.array(z.string()),
});

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(':', 'h');
}

export async function registerAnimationReminder(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-reminder',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const {
        animationId,
        title,
        scheduledAt,
        server,
        village,
        participantDiscordIds,
      } = parsed.data;

      const panelUrl = `${env.APP_PUBLIC_URL}/panel/animations/${animationId}`;
      const dmText = [
        `⏰ Rappel : l'animation **${title}** commence dans environ 15 minutes.`,
        '',
        `🗓️ ${formatDate(scheduledAt)}`,
        `🌐 Serveur : ${server}`,
        `🏯 Village : ${village}`,
        '',
        `🔗 ${panelUrl}`,
      ].join('\n');

      await Promise.allSettled(
        participantDiscordIds.map((discordId) => sendDM(discordId, dmText)),
      );

      return reply.send({
        success: true,
        data: { sent: participantDiscordIds.length },
      });
    },
  );
}
