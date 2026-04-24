import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { addStaffRoles } from '../../discord/actions/addStaffRoles.js';

const bodySchema = z.object({
  discordUserId: z.string(),
  role: z.enum(['direction', 'gerance', 'responsable', 'responsable_mj', 'senior', 'mj_senior', 'animateur', 'mj']),
});

export async function registerMemberRestoreRoles(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/member-restore-roles',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const { discordUserId, role } = parsed.data;
      const result = await addStaffRoles(discordUserId, role);

      return reply.send({ success: true, data: { addedRoles: result.addedRoles } });
    },
  );
}
