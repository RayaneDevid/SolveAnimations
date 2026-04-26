import { supabase } from '../lib/supabase.js';
import { env } from '../config/env.js';
import { sendDM } from './actions/sendDM.js';

const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const REMINDER_INTERVAL_MS = 60 * 1000;

interface ReminderAnimation {
  id: string;
  title: string;
  scheduled_at: string;
  server: string;
  village: string;
  participants?: Array<{
    status?: string;
    user?: { discord_id?: string | null } | null;
  }>;
}

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

function buildReminderMessage(animation: ReminderAnimation): string {
  const panelUrl = `${env.APP_PUBLIC_URL}/panel/animations/${animation.id}`;
  return [
    `⏰ Rappel : l'animation **${animation.title}** commence dans environ 15 minutes.`,
    '',
    `🗓️ ${formatDate(animation.scheduled_at)}`,
    `🌐 Serveur : ${animation.server}`,
    `🏯 Village : ${animation.village}`,
    '',
    `🔗 ${panelUrl}`,
  ].join('\n');
}

let running = false;

export async function runAnimationReminders(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

    const { data, error } = await supabase
      .from('animations')
      .select(`
        id, title, scheduled_at, server, village,
        participants:animation_participants!animation_participants_animation_id_fkey(
          status,
          user:profiles!animation_participants_user_id_fkey(discord_id)
        )
      `)
      .in('status', ['open', 'preparing'])
      .is('reminder_15min_sent_at', null)
      .gt('scheduled_at', now.toISOString())
      .lte('scheduled_at', windowEnd.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(25);

    if (error) {
      console.warn('[animation-reminders] Fetch failed:', error.message);
      return;
    }

    for (const animation of (data ?? []) as ReminderAnimation[]) {
      const { data: claimed, error: claimError } = await supabase
        .from('animations')
        .update({ reminder_15min_sent_at: new Date().toISOString() })
        .eq('id', animation.id)
        .is('reminder_15min_sent_at', null)
        .select('id')
        .maybeSingle();

      if (claimError || !claimed) continue;

      const participantDiscordIds = [...new Set(
        (animation.participants ?? [])
          .filter((participant) => participant.status === 'validated')
          .map((participant) => participant.user?.discord_id)
          .filter((discordId): discordId is string => typeof discordId === 'string' && discordId.length > 0),
      )];

      if (participantDiscordIds.length === 0) continue;

      const dmText = buildReminderMessage(animation);
      await Promise.allSettled(
        participantDiscordIds.map((discordId) => sendDM(discordId, dmText)),
      );
    }
  } finally {
    running = false;
  }
}

export function startAnimationReminderScheduler(): NodeJS.Timeout {
  void runAnimationReminders();
  return setInterval(() => void runAnimationReminders(), REMINDER_INTERVAL_MS);
}
