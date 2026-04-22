import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { sendDM } from '../../discord/actions/sendDM.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
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

      const { newScheduledAt, title, formerParticipantDiscordIds } = parsed.data;

      const formattedDate = formatDate(newScheduledAt);
      const dmText = `🟠 L'animation **${title}** a été reportée au **${formattedDate}**.\n\nTa participation a été annulée — tu pourras te réinscrire une fois la nouvelle date confirmée.`;

      await Promise.allSettled(
        formerParticipantDiscordIds.map((discordId) => sendDM(discordId, dmText)),
      );

      return reply.send({ success: true, data: {} });
    },
  );
}
