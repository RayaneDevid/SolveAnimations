import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyBotSecret } from '../auth.js';
import { buildAnimationEmbed, buildJoinRow } from '../../discord/embeds/animation.js';
import { sendDM } from '../../discord/actions/sendDM.js';
import client from '../../discord/client.js';
import { env } from '../../config/env.js';

const bodySchema = z.object({
  animationId: z.string().uuid(),
  title: z.string(),
  scheduledAt: z.string(),
  plannedDurationMin: z.number().int(),
  prepTimeMin: z.number().int(),
  server: z.string(),
  type: z.string(),
  pole: z.string().optional(),
  village: z.string(),
  documentUrl: z.string().optional(),
  creatorUsername: z.string(),
  creatorDiscordId: z.string(),
  requiredParticipants: z.number().int(),
  adminMessageId: z.string().optional(),
});

function buildParticipantPing(pole: string | undefined, requiredParticipants: number): { content: string; allowedMentions: import('discord.js').MessageCreateOptions['allowedMentions'] } | null {
  if (requiredParticipants <= 0) return null;

  const roleIds: string[] = [];
  if (pole === 'animation' || pole === 'les_deux') {
    if (env.ROLE_ANIMATEUR) roleIds.push(env.ROLE_ANIMATEUR);
    if (env.ROLE_SENIOR) roleIds.push(env.ROLE_SENIOR);
  }
  if (pole === 'mj' || pole === 'les_deux') {
    if (env.ROLE_MJ) roleIds.push(env.ROLE_MJ);
    if (env.ROLE_MJ_SENIOR) roleIds.push(env.ROLE_MJ_SENIOR);
  }
  // Default (no pole): ping all staff
  if (!pole) {
    if (env.ROLE_ANIMATEUR) roleIds.push(env.ROLE_ANIMATEUR);
    if (env.ROLE_SENIOR) roleIds.push(env.ROLE_SENIOR);
    if (env.ROLE_MJ) roleIds.push(env.ROLE_MJ);
    if (env.ROLE_MJ_SENIOR) roleIds.push(env.ROLE_MJ_SENIOR);
  }

  if (roleIds.length === 0) return null;
  return {
    content: roleIds.map((id) => `<@&${id}>`).join(' '),
    allowedMentions: { roles: roleIds },
  };
}

export async function registerAnimationValidated(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook/animation-validated',
    { preHandler: verifyBotSecret },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }

      const payload = parsed.data;

      // 1. Delete or edit the admin validation message
      if (payload.adminMessageId) {
        try {
          const validationChannel = await client.channels.fetch(env.DISCORD_VALIDATION_CHANNEL_ID);
          if (validationChannel?.isTextBased()) {
            const msg = await (validationChannel as import('discord.js').TextChannel).messages.fetch(payload.adminMessageId);
            await msg.delete();
          }
        } catch (err) {
          console.warn('[animation-validated] Could not delete admin message:', err);
        }
      }

      // 2. Post public embed in announce channel
      let publicMessageId = '';
      try {
        const announceChannel = await client.channels.fetch(env.DISCORD_ANNOUNCE_CHANNEL_ID);
        if (!announceChannel || !announceChannel.isTextBased()) {
          return reply.status(500).send({ success: false, error: 'Announce channel not found or not text-based' });
        }

        const embed = buildAnimationEmbed({
          ...payload,
          status: 'open',
        });

        const ping = buildParticipantPing(payload.pole, payload.requiredParticipants);
        const message = await (announceChannel as import('discord.js').TextChannel).send({
          ...(ping ?? {}),
          embeds: [embed],
          components: [buildJoinRow(payload.animationId)],
        });
        publicMessageId = message.id;
      } catch (err) {
        console.error('[animation-validated] Error posting public embed:', err);
        return reply.status(500).send({ success: false, error: 'Failed to post public embed' });
      }

      // 3. DM the creator
      await sendDM(
        payload.creatorDiscordId,
        `✅ Ton animation **${payload.title}** a été validée ! Elle est maintenant ouverte aux inscriptions.`,
      );

      return reply.send({ success: true, data: { publicMessageId } });
    },
  );
}
