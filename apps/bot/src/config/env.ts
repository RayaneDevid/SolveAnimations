import { z } from 'zod';

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_ANNOUNCE_CHANNEL_ID: z.string().min(1),
  DISCORD_VALIDATION_CHANNEL_ID: z.string().min(1),
  BOT_WEBHOOK_SECRET: z.string().min(1),
  BOT_PORT: z.coerce.number().int().positive().default(4001),
  APP_PUBLIC_URL: z.string().url(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  ROLE_RESPONSABLE: z.string().optional(),
  ROLE_ANIMATEUR: z.string().optional(),
  ROLE_SENIOR: z.string().optional(),
  ROLE_MJ: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const STAFF_ROLE_IDS: string[] = [
  env.ROLE_RESPONSABLE,
  env.ROLE_SENIOR,
  env.ROLE_ANIMATEUR,
  env.ROLE_MJ,
].filter((id): id is string => Boolean(id));
