import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { sendDM } from '../../discord/actions/sendDM.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
  creatorDiscordId: z.string(),
  title: z.string(),
  reason: z.string(),
});

export async function registerAnimationRejected(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-rejected',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const { creatorDiscordId, title, reason } = parsed.data;

      await sendDM(
        creatorDiscordId,
        `❌ Ton animation **${title}** a été rejetée.\n\n**Raison :** ${reason}`,
      );

      return reply.send({ success: true, data: {} });
    },
  );
}
