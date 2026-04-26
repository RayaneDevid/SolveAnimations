import { EmbedBuilder } from 'discord.js';
import { env } from '../../config/env.js';

export const SUBJECT_LABELS: Record<string, string> = {
  grade_superieur_tkj: 'Autorisation grade supérieur à TKJ (perso Animation)',
  demande_give: 'Demande de give pour un perso Animation',
  setmodel_tenue: 'Autorisation setmodel / port de tenue "sous autorisation"',
  reservation_secteur: "Demande de réservation d'un secteur event",
  situation_problematique: 'Situation problématique avec un joueur',
};

export const DESTINATION_LABELS: Record<string, string> = {
  ra: 'Responsables Animation',
  rmj: 'Responsables MJ',
};

// Amber pour en attente, vert/rouge pour décidé
export const REQUETE_COLORS = {
  pending:  0xf59e0b,
  accepted: 0x22c55e,
  refused:  0xef4444,
};

export interface RequeteEmbedData {
  requeteId: string;
  subject: string;
  destination: string;
  description: string;
  creatorUsername: string;
  status?: 'pending' | 'accepted' | 'refused';
  deciderUsername?: string;
  decisionReason?: string;
}

export function buildRequeteEmbed(data: RequeteEmbedData): EmbedBuilder {
  const {
    requeteId,
    subject,
    destination,
    description,
    creatorUsername,
    status = 'pending',
    deciderUsername,
    decisionReason,
  } = data;

  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const destLabel    = DESTINATION_LABELS[destination] ?? destination;
  const color        = REQUETE_COLORS[status];
  const panelUrl     = `${env.APP_PUBLIC_URL}/panel/requetes`;

  // Tronquer la description si trop longue pour l'embed
  const truncatedDesc = description.length > 900
    ? description.slice(0, 900) + '…'
    : description;

  const lines = [
    '────────────────────────────────',
    `📋  **Sujet :** ${subjectLabel}`,
    `🎯  **Pour :** ${destLabel}`,
    `👤  **De :** @${creatorUsername}`,
    '',
    '📝  **Détail de la demande :**',
    truncatedDesc,
  ];

  if (status === 'accepted' && deciderUsername) {
    lines.push('', `✅  Acceptée par **${deciderUsername}**`);
  } else if (status === 'refused' && deciderUsername) {
    lines.push('', `❌  Refusée par **${deciderUsername}**`);
    if (decisionReason) lines.push(`> ${decisionReason}`);
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`🎫  Nouvelle requête`)
    .setDescription(lines.join('\n'))
    .addFields({ name: '​', value: `[🔗 Ouvrir dans le panel](${panelUrl})`, inline: false })
    .setFooter({ text: `ID : ${requeteId}` })
    .setTimestamp();
}
