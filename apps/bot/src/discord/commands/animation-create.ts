import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  MessageFlags,
} from 'discord.js';
import { supabase } from '../../lib/supabase.js';
import { buildAnimationEmbed, buildJoinRow } from '../embeds/animation.js';
import { env } from '../../config/env.js';
import client from '../client.js';

const SERVERS = ['S1', 'S2', 'S3', 'S4', 'S5', 'SE1', 'SE2', 'SE3'] as const;
const TYPES = ['petite', 'moyenne', 'grande'] as const;
const VILLAGES = ['konoha', 'suna', 'oto', 'kiri', 'temple_camelias', 'autre', 'tout_le_monde'] as const;
const POLES = ['animation', 'mj', 'les_deux'] as const;

// ─── State intermédiaire ──────────────────────────────────────────────────────

interface PendingData {
  // Step 1
  title: string;
  scheduledAt: Date;
  server: string;
  village: string;
  type: string;
  // Step 2 (filled after modal 2)
  plannedDurationMin?: number;
  requiredParticipants?: number;
  prepTimeMin?: number;
  description?: string | null;
  requestValidation?: boolean;
  storedAt: number;
}

const pendingCreations = new Map<string, PendingData>();

// Nettoyer les entrées > 15 min (session expirée)
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [key, data] of pendingCreations) {
    if (data.storedAt < cutoff) pendingCreations.delete(key);
  }
}, 5 * 60 * 1000);

// ─── Parsing date Europe/Paris ────────────────────────────────────────────────

function parseParisDate(input: string): Date | null {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, d, m, y, h, min] = match;
  const day = parseInt(d), month = parseInt(m), year = parseInt(y);
  const hours = parseInt(h), minutes = parseInt(min);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  if (year < 2024) return null;

  const naiveUTC = Date.UTC(year, month - 1, day, hours, minutes, 0);
  const naiveDate = new Date(naiveUTC);
  const parisAsLocal = new Date(naiveDate.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  return new Date(naiveUTC + (naiveDate.getTime() - parisAsLocal.getTime()));
}

function buildParticipantPingContent(pole: string, pingRoles: boolean): { content: string; allowedMentions: { roles: string[] } } | null {
  if (!pingRoles) return null;

  const roleIds: string[] = [];
  if (pole === 'animation' || pole === 'les_deux') {
    if (env.ROLE_ANIMATEUR) roleIds.push(env.ROLE_ANIMATEUR);
    if (env.ROLE_SENIOR) roleIds.push(env.ROLE_SENIOR);
  }
  if (pole === 'mj' || pole === 'les_deux') {
    if (env.ROLE_MJ) roleIds.push(env.ROLE_MJ);
    if (env.ROLE_MJ_SENIOR) roleIds.push(env.ROLE_MJ_SENIOR);
  }

  if (roleIds.length === 0) return null;
  return {
    content: roleIds.map((id) => `<@&${id}>`).join(' '),
    allowedMentions: { roles: roleIds },
  };
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function currentParisDateTime(): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date()).replace(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2})/, '$1/$2/$3 $4:$5');
}

function buildModal1(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('anim-create-1')
    .setTitle('Créer une animation (1/3)')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Titre')
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(120)
          .setPlaceholder('Ex: Tournoi des ninjas de Konoha')
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('scheduled_at')
          .setLabel('Date et heure (JJ/MM/AAAA HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setValue(currentParisDateTime())
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('server')
          .setLabel('Serveur')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('S1 · S2 · S3 · S4 · S5 · SE1 · SE2 · SE3')
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('village')
          .setLabel('Village')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('konoha · suna · oto · kiri · temple_camelias · autre · tout_le_monde')
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('type')
          .setLabel('Type')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('petite · moyenne · grande')
          .setRequired(true),
      ),
    );
}

function buildModal2(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('anim-create-2')
    .setTitle('Créer une animation (2/3)')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Durée de l\'animation (en minutes)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 60')
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('participants')
          .setLabel('Participants requis (0 = sans limite)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 4')
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('debrief')
          .setLabel('Durée du débrief (min, 0 = pas de débrief)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 0')
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description (optionnel)')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(2000)
          .setRequired(false),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('validation')
          .setLabel('Validation responsable ? (oui / non)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('oui')
          .setRequired(true),
      ),
    );
}

function buildModal3(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('anim-create-3')
    .setTitle('Créer une animation (3/3)')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('pole')
          .setLabel('Pôle')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('animation · mj · les_deux')
          .setValue('animation')
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ping_roles')
          .setLabel('Notifier les rôles Discord ? (oui / non)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('oui')
          .setValue('oui')
          .setRequired(true),
      ),
    );
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleCreateCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('discord_id', interaction.user.id)
    .eq('is_active', true)
    .single();

  if (!profile) {
    await interaction.reply({
      content: '❌ Tu dois être membre du staff (et t\'être connecté au panel au moins une fois) pour créer une animation.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.showModal(buildModal1());
}

export async function handleModal1Submit(interaction: ModalSubmitInteraction): Promise<void> {
  const title = interaction.fields.getTextInputValue('title').trim();
  const scheduledAtRaw = interaction.fields.getTextInputValue('scheduled_at').trim();
  const serverRaw = interaction.fields.getTextInputValue('server').trim().toUpperCase();
  const villageRaw = interaction.fields.getTextInputValue('village').trim().toLowerCase();
  const typeRaw = interaction.fields.getTextInputValue('type').trim().toLowerCase();

  if (title.length < 3 || title.length > 120) {
    await interaction.reply({ content: '❌ Le titre doit faire entre 3 et 120 caractères.', ephemeral: true });
    return;
  }

  const scheduledAt = parseParisDate(scheduledAtRaw);
  if (!scheduledAt) {
    await interaction.reply({
      content: '❌ Format de date invalide. Utilise : `JJ/MM/AAAA HH:MM`\nExemple : `25/04/2026 21:00`',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (scheduledAt.getTime() <= Date.now()) {
    await interaction.reply({ content: '❌ La date doit être dans le futur.', ephemeral: true });
    return;
  }

  if (!SERVERS.includes(serverRaw as (typeof SERVERS)[number])) {
    await interaction.reply({
      content: `❌ Serveur invalide. Valeurs acceptées : \`${SERVERS.join('`, `')}\``,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!VILLAGES.includes(villageRaw as (typeof VILLAGES)[number])) {
    await interaction.reply({
      content: `❌ Village invalide. Valeurs acceptées : \`${VILLAGES.join('`, `')}\``,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!TYPES.includes(typeRaw as (typeof TYPES)[number])) {
    await interaction.reply({
      content: `❌ Type invalide. Valeurs acceptées : \`${TYPES.join('`, `')}\``,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  pendingCreations.set(interaction.user.id, {
    title,
    scheduledAt,
    server: serverRaw,
    village: villageRaw,
    type: typeRaw,
    storedAt: Date.now(),
  });

  await interaction.reply({
    content: [
      '✅ **Étape 1/3 enregistrée.** Clique sur le bouton ci-dessous pour renseigner les paramètres.',
      `> **Titre :** ${title}`,
      `> **Date :** ${scheduledAtRaw} (Europe/Paris)`,
      `> **Serveur :** ${serverRaw} · **Village :** ${villageRaw} · **Type :** ${typeRaw}`,
    ].join('\n'),
    flags: MessageFlags.Ephemeral,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`anim-create-step2:${interaction.user.id}`)
          .setLabel('Paramètres →')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`anim-create-cancel:${interaction.user.id}`)
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

export async function handleStep2Button(interaction: ButtonInteraction, userId: string): Promise<void> {
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    return;
  }

  if (!pendingCreations.has(userId)) {
    await interaction.reply({
      content: '❌ Session expirée. Relance `/animation creer`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.showModal(buildModal2());
}

export async function handleModal2Submit(interaction: ModalSubmitInteraction): Promise<void> {
  const step = pendingCreations.get(interaction.user.id);
  if (!step) {
    await interaction.reply({ content: '❌ Session expirée. Relance `/animation creer`.', ephemeral: true });
    return;
  }

  const durationRaw = interaction.fields.getTextInputValue('duration').trim();
  const participantsRaw = interaction.fields.getTextInputValue('participants').trim();
  const debriefRaw = interaction.fields.getTextInputValue('debrief').trim();
  const description = interaction.fields.getTextInputValue('description').trim() || null;
  const validationRaw = interaction.fields.getTextInputValue('validation').trim().toLowerCase();

  const plannedDurationMin = parseInt(durationRaw);
  if (isNaN(plannedDurationMin) || plannedDurationMin < 15 || plannedDurationMin > 720) {
    await interaction.reply({ content: '❌ Durée invalide (15–720 min).', ephemeral: true });
    return;
  }

  const requiredParticipants = parseInt(participantsRaw);
  if (isNaN(requiredParticipants) || requiredParticipants < 0 || requiredParticipants > 100) {
    await interaction.reply({ content: '❌ Participants invalide (0–100).', ephemeral: true });
    return;
  }

  const prepTimeMin = parseInt(debriefRaw);
  if (isNaN(prepTimeMin) || prepTimeMin < 0 || prepTimeMin > 600) {
    await interaction.reply({ content: '❌ Durée débrief invalide (0–600 min).', ephemeral: true });
    return;
  }

  if (!['oui', 'non'].includes(validationRaw)) {
    await interaction.reply({ content: '❌ Validation invalide. Réponds `oui` ou `non`.', ephemeral: true });
    return;
  }

  // Store step 2 data into pending
  pendingCreations.set(interaction.user.id, {
    ...step,
    plannedDurationMin,
    requiredParticipants,
    prepTimeMin,
    description,
    requestValidation: validationRaw === 'oui',
    storedAt: Date.now(),
  });

  await interaction.reply({
    content: [
      '✅ **Étape 2/3 enregistrée.** Clique sur le bouton ci-dessous pour finir.',
      `> **Durée :** ${plannedDurationMin} min · **Débrief :** ${prepTimeMin} min`,
      `> **Participants :** ${requiredParticipants} · **Validation :** ${validationRaw}`,
    ].join('\n'),
    flags: MessageFlags.Ephemeral,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`anim-create-step3:${interaction.user.id}`)
          .setLabel('Options Discord →')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`anim-create-cancel:${interaction.user.id}`)
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

export async function handleStep3Button(interaction: ButtonInteraction, userId: string): Promise<void> {
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    return;
  }

  if (!pendingCreations.has(userId)) {
    await interaction.reply({
      content: '❌ Session expirée. Relance `/animation creer`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.showModal(buildModal3());
}

export async function handleModal3Submit(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const step = pendingCreations.get(interaction.user.id);
  if (!step || step.plannedDurationMin == null) {
    await interaction.editReply({ content: '❌ Session expirée. Relance `/animation creer`.' });
    return;
  }

  const poleRaw = interaction.fields.getTextInputValue('pole').trim().toLowerCase();
  const pingRaw = interaction.fields.getTextInputValue('ping_roles').trim().toLowerCase();

  if (!POLES.includes(poleRaw as (typeof POLES)[number])) {
    await interaction.editReply({ content: `❌ Pôle invalide. Valeurs acceptées : \`${POLES.join('`, `')}\`` });
    return;
  }

  if (!['oui', 'non'].includes(pingRaw)) {
    await interaction.editReply({ content: '❌ Notification invalide. Réponds `oui` ou `non`.' });
    return;
  }

  const pole = poleRaw;
  const pingRoles = pingRaw === 'oui';
  const requestValidation = step.requestValidation ?? true;
  const autoValidate = !requestValidation;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, discord_id')
    .eq('discord_id', interaction.user.id)
    .eq('is_active', true)
    .single();

  if (!profile) {
    await interaction.editReply({ content: '❌ Profil introuvable.' });
    return;
  }

  const now = new Date().toISOString();

  const { data: animation, error } = await supabase
    .from('animations')
    .insert({
      title: step.title,
      scheduled_at: step.scheduledAt.toISOString(),
      planned_duration_min: step.plannedDurationMin,
      required_participants: step.requiredParticipants ?? 0,
      server: step.server,
      type: step.type,
      pole,
      prep_time_min: step.prepTimeMin ?? 0,
      village: step.village,
      description: step.description ?? null,
      creator_id: profile.id,
      status: autoValidate ? 'open' : 'pending_validation',
      ...(autoValidate ? { validated_by: profile.id, validated_at: now } : {}),
    })
    .select('*')
    .single();

  if (error || !animation) {
    console.error('[anim-create-3] DB error:', error);
    await interaction.editReply({ content: '❌ Erreur lors de la création.' });
    return;
  }

  pendingCreations.delete(interaction.user.id);

  await supabase.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.create',
    target_type: 'animation',
    target_id: animation.id,
    metadata: { via: 'discord_command', auto_validated: autoValidate },
  });

  const embed = buildAnimationEmbed({
    animationId: animation.id,
    title: animation.title,
    scheduledAt: animation.scheduled_at,
    plannedDurationMin: animation.planned_duration_min,
    prepTimeMin: animation.prep_time_min,
    server: animation.server,
    type: animation.type,
    pole: animation.pole,
    village: animation.village,
    creatorUsername: profile.username,
    requiredParticipants: animation.required_participants,
    currentParticipants: 0,
    status: animation.status,
  });

  let discordMessageId = '';

  if (autoValidate) {
    try {
      const ch = await client.channels.fetch(env.DISCORD_ANNOUNCE_CHANNEL_ID);
      if (ch?.isTextBased()) {
        const ping = buildParticipantPingContent(pole, pingRoles);
        const msg = await (ch as TextChannel).send({
          ...(ping ?? {}),
          embeds: [embed],
          components: [buildJoinRow(animation.id)],
        });
        discordMessageId = msg.id;
      }
    } catch (err) {
      console.error('[anim-create-3] Failed to post announce embed:', err);
    }
  } else {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`validate:${animation.id}`)
        .setLabel('✅ Valider')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject:${animation.id}`)
        .setLabel('❌ Refuser')
        .setStyle(ButtonStyle.Danger),
    );
    try {
      const ch = await client.channels.fetch(env.DISCORD_VALIDATION_CHANNEL_ID);
      if (ch?.isTextBased()) {
        const msg = await (ch as TextChannel).send({ embeds: [embed], components: [row] });
        discordMessageId = msg.id;
      }
    } catch (err) {
      console.error('[anim-create-3] Failed to post validation embed:', err);
    }
  }

  if (discordMessageId) {
    await supabase.from('animations').update({ discord_message_id: discordMessageId }).eq('id', animation.id);
  }

  const statusMsg = autoValidate
    ? '✅ Animation créée et **directement ouverte** aux inscriptions.'
    : '✅ Animation créée et **en attente de validation**.';

  await interaction.editReply({
    content: [
      statusMsg,
      `🔗 [Voir dans le panel](${env.APP_PUBLIC_URL}/panel/animations/${animation.id})`,
    ].join('\n'),
  });
}

export async function handleCancelButton(interaction: ButtonInteraction, userId: string): Promise<void> {
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    return;
  }

  pendingCreations.delete(userId);
  await interaction.update({ content: '❌ Création annulée.', components: [] });
}
