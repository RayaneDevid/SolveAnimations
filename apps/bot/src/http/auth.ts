import { FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';

/**
 * Fastify preHandler that validates the X-Bot-Secret header.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyBotSecret(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = (request.headers['x-bot-secret'] as string | undefined) ?? '';
  const secret = env.BOT_WEBHOOK_SECRET;

  let authorized = false;

  try {
    const headerBuf = Buffer.from(header);
    const secretBuf = Buffer.from(secret);

    // timingSafeEqual requires same-length buffers
    if (headerBuf.length === secretBuf.length) {
      authorized = timingSafeEqual(headerBuf, secretBuf);
    }
  } catch {
    authorized = false;
  }

  if (!authorized) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
}
