import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { removeStaffRoles } from '../../discord/actions/removeStaffRoles.js';

const bodySchema = z.object({
  discordUserId: z.string(),
});

export async function registerMemberRemoveRoles(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/member-remove-roles',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const { discordUserId } = parsed.data;
      const result = await removeStaffRoles(discordUserId);

      if (result.failedRoles.length > 0) {
        return reply.status(500).send({
          success: false,
          error: `Failed to remove roles: ${result.failedRoles.join(', ')}. Check bot role hierarchy in Discord server settings.`,
          data: result,
        });
      }

      return reply.send({ success: true, data: result });
    },
  );
}
