import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { env } from '../../config/env.js';
import client from '../../discord/client.js';

type StaffRole =
  | 'direction'
  | 'gerance'
  | 'responsable'
  | 'responsable_mj'
  | 'responsable_bdm'
  | 'senior'
  | 'mj_senior'
  | 'animateur'
  | 'mj'
  | 'bdm';

const ROLE_IDS: Record<StaffRole, string | undefined> = {
  direction: env.ROLE_DIRECTION,
  gerance: env.ROLE_GERANCE,
  responsable: env.ROLE_RESPONSABLE,
  responsable_mj: env.ROLE_RESPONSABLE_MJ,
  responsable_bdm: env.ROLE_RESPONSABLE_BDM,
  senior: env.ROLE_SENIOR,
  mj_senior: env.ROLE_MJ_SENIOR,
  animateur: env.ROLE_ANIMATEUR,
  mj: env.ROLE_MJ,
  bdm: env.ROLE_BDM,
};

const ROLE_HIERARCHY: Record<StaffRole, number> = {
  direction: 6,
  gerance: 5,
  responsable: 4,
  responsable_mj: 4,
  senior: 3,
  mj_senior: 3,
  mj: 2,
  animateur: 1,
  responsable_bdm: 0.2,
  bdm: 0.1,
};

const bodySchema = z.object({
  discordUserId: z.string().min(1),
});

function getDiscordUsername(user: { username: string; discriminator: string | null }): string {
  return user.discriminator && user.discriminator !== '0'
    ? `${user.username}#${user.discriminator}`
    : user.username;
}

export async function registerDiscordMemberLookup(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/discord-member-lookup',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      try {
        const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
        const member = await guild.members.fetch({ user: parsed.data.discordUserId, force: true });
        const memberRoleIds = new Set(member.roles.cache.keys());
        const availableRoles = Object.entries(ROLE_IDS)
          .filter((entry): entry is [StaffRole, string] => Boolean(entry[1]))
          .filter(([, roleId]) => memberRoleIds.has(roleId))
          .map(([role]) => role)
          .sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]);

        const role = availableRoles[0] ?? null;
        if (!role) {
          return reply.send({
            success: true,
            data: { ok: false, reason: 'NO_STAFF_ROLE', discordRoleIds: Array.from(memberRoleIds) },
          });
        }

        return reply.send({
          success: true,
          data: {
            ok: true,
            role,
            availableRoles,
            discordId: member.user.id,
            username: member.nickname ?? member.user.globalName ?? member.user.username,
            discordUsername: getDiscordUsername(member.user),
            avatarUrl: member.user.avatar
              ? member.user.displayAvatarURL({ extension: 'webp', size: 128 })
              : null,
          },
        });
      } catch (err) {
        console.warn('[discord-member-lookup] Failed:', err);
        return reply.send({ success: true, data: { ok: false, reason: 'FETCH_FAILED' } });
      }
    },
  );
}
