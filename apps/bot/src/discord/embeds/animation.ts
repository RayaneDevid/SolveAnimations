import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { env } from '../../config/env.js';

export function buildJoinRow(animationId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`anim-join:${animationId}`)
      .setLabel("S'inscrire")
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✋'),
  );
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const TYPE_LABELS: Record<string, string> = {
  petite: 'Petite',
  moyenne: 'Moyenne',
  grande: 'Grande',
};

export const VILLAGE_LABELS: Record<string, string> = {
  konoha: 'Konoha',
  suna: 'Suna',
  oto: 'Oto',
  kiri: 'Kiri',
  temple_camelias: 'Temple des Camélias',
  autre: 'Autre',
  tout_le_monde: 'Tout le monde',
};

export const STATUS_LABELS: Record<string, string> = {
  pending_validation: 'En attente',
  open: 'Ouverte',
  preparing: 'En Préparation',
  running: 'En cours',
  finished: 'Terminée',
  rejected: 'Rejetée',
  postponed: 'Reportée',
  cancelled: 'Annulée',
};

export const STATUS_EMOJI: Record<string, string> = {
  pending_validation: '⏳',
  open: '🟢',
  preparing: '🟡',
  running: '🔵',
  finished: '🟣',
  rejected: '🔴',
  postponed: '🟠',
  cancelled: '⚫',
};

// ─── Colors ───────────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<string, number> = {
  pending_validation: 0x6b7280,
  open: 0x22d3ee,
  preparing: 0xf59e0b,
  running: 0x22c55e,
  finished: 0xa855f7,
  rejected: 0xef4444,
  postponed: 0xf97316,
  cancelled: 0x374151,
};

export const VILLAGE_COLORS: Record<string, number> = {
  konoha: 0x22c55e,
  suna: 0xca8a04,
  oto: 0x7c3aed,
  kiri: 0x0d9488,
  temple_camelias: 0xec4899,
  autre: 0x6b7280,
  tout_le_monde: 0x22d3ee,
};

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(':', 'h');
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

// ─── Embed builder types ──────────────────────────────────────────────────────

export interface AnimationEmbedData {
  animationId: string;
  title: string;
  scheduledAt: string;
  plannedDurationMin: number;
  prepTimeMin: number;
  server: string;
  type: string;
  village: string;
  documentUrl?: string;
  creatorUsername: string;
  requiredParticipants: number;
  currentParticipants?: number;
  status: string;
  actualDurationMin?: number;
}

export function buildAnimationEmbed(data: AnimationEmbedData): EmbedBuilder {
  const {
    animationId,
    title,
    scheduledAt,
    plannedDurationMin,
    prepTimeMin,
    server,
    type,
    village,
    documentUrl,
    creatorUsername,
    requiredParticipants,
    currentParticipants = 0,
    status,
    actualDurationMin,
  } = data;

  const color = STATUS_COLORS[status] ?? STATUS_COLORS['pending_validation'];
  const statusLabel = STATUS_LABELS[status] ?? status;
  const statusEmoji = STATUS_EMOJI[status] ?? '❓';
  const typeLabel = TYPE_LABELS[type] ?? type;
  const villageLabel = VILLAGE_LABELS[village] ?? village;

  const panelUrl = `${env.APP_PUBLIC_URL}/panel/animations/${animationId}`;

  const durationLine =
    status === 'finished' && actualDurationMin != null
      ? `⏱️  Durée réelle : ${formatDuration(actualDurationMin)}`
      : `⏱️  Durée prévue : ${formatDuration(plannedDurationMin)}${prepTimeMin > 0 ? ` · Prépa : ${formatDuration(prepTimeMin)}` : ''}`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🎭  ${title}`)
    .setDescription(
      [
        '────────────────────────────────',
        `🗓️  ${formatDate(scheduledAt)}`,
        durationLine,
        `🌐  Serveur : ${server}`,
        `🏯  Village : ${villageLabel}`,
        `🎯  Type : ${typeLabel}`,
        `👥  Participants : ${currentParticipants} / ${requiredParticipants}`,
        ...(documentUrl ? [`📄  [Voir le document](${documentUrl})`] : []),
        '',
        `Organisé par @${creatorUsername}`,
        `Statut : ${statusEmoji} ${statusLabel}`,
      ].join('\n'),
    )
    .addFields({
      name: '​',
      value: `[🔗 Ouvrir dans le panel](${panelUrl})`,
      inline: false,
    })
    .setTimestamp();

  return embed;
}
