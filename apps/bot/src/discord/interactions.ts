import {
  ButtonInteraction,
  ModalSubmitInteraction,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { supabase } from '../lib/supabase.js';
import { buildAnimationEmbed, buildJoinRow } from './embeds/animation.js';
import { sendDM } from './actions/sendDM.js';
import client from './client.js';
import { env } from '../config/env.js';
import { SUBJECT_LABELS, DESTINATION_LABELS } from './embeds/requete.js';

async function getRequeteResponsableProfile(discordId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, role, username, discord_id')
    .eq('discord_id', discordId)
    .single();
  if (!data) return null;
  const deciderRoles = ['responsable', 'responsable_mj', 'direction', 'gerance'];
  if (!deciderRoles.includes(data.role)) return null;
  return data;
}

async function fetchRequete(requeteId: string) {
  const { data } = await supabase
    .from('requetes')
    .select('*, creator:profiles!creator_id(id, discord_id, username)')
    .eq('id', requeteId)
    .single();
  return data;
}

async function getResponsableProfile(discordId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, role, username')
    .eq('discord_id', discordId)
    .single();
  if (!data || (data.role !== 'responsable' && data.role !== 'responsable_mj')) return null;
  return data;
}

async function fetchAnimation(animationId: string) {
  const { data } = await supabase
    .from('animations')
    .select('*, creator:profiles!animations_creator_id_fkey(id, discord_id, username)')
    .eq('id', animationId)
    .single();
  return data;
}

function buildParticipantPingContent(pole: string | undefined, requiredParticipants: number): { content: string; allowedMentions: { roles: string[] } } | null {
  if (requiredParticipants <= 0) return null;

  const roleIds: string[] = [];
  if (!pole || pole === 'animation' || pole === 'les_deux') {
    if (env.ROLE_ANIMATEUR) roleIds.push(env.ROLE_ANIMATEUR);
    if (env.ROLE_SENIOR) roleIds.push(env.ROLE_SENIOR);
  }
  if (!pole || pole === 'mj' || pole === 'les_deux') {
    if (env.ROLE_MJ) roleIds.push(env.ROLE_MJ);
    if (env.ROLE_MJ_SENIOR) roleIds.push(env.ROLE_MJ_SENIOR);
  }

  if (roleIds.length === 0) return null;
  return {
    content: roleIds.map((id) => `<@&${id}>`).join(' '),
    allowedMentions: { roles: roleIds },
  };
}

export async function handleValidateButton(interaction: ButtonInteraction, animationId: string) {
  await interaction.deferReply({ ephemeral: true });

  const profile = await getResponsableProfile(interaction.user.id);
  if (!profile) {
    await interaction.editReply({ content: '❌ Tu n\'as pas les droits pour valider une animation.' });
    return;
  }

  const anim = await fetchAnimation(animationId);
  if (!anim || anim.status !== 'pending_validation') {
    await interaction.editReply({ content: '❌ Cette animation ne peut plus être validée (statut incorrect).' });
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('animations')
    .update({ status: 'open', validated_by: profile.id, validated_at: now })
    .eq('id', animationId);

  if (error) {
    await interaction.editReply({ content: '❌ Erreur lors de la validation.' });
    return;
  }

  await supabase.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.validate',
    target_type: 'animation',
    target_id: animationId,
    metadata: { via: 'discord_button' },
  });

  // Delete the admin validation message
  try {
    await interaction.message.delete();
  } catch {}

  // Post public embed in announce channel
  const embed = buildAnimationEmbed({
    animationId,
    title: anim.title,
    scheduledAt: anim.scheduled_at,
    plannedDurationMin: anim.planned_duration_min,
    prepTimeMin: anim.prep_time_min,
    server: anim.server,
    type: anim.type,
    pole: anim.pole ?? undefined,
    village: anim.village,
    documentUrl: anim.document_url,
    creatorUsername: anim.creator?.username ?? 'Inconnu',
    requiredParticipants: anim.required_participants,
    currentParticipants: 0,
    status: 'open',
  });

  const ping = buildParticipantPingContent(anim.pole ?? undefined, anim.required_participants);

  let publicMessageId = '';
  try {
    const announceChannel = await client.channels.fetch(env.DISCORD_ANNOUNCE_CHANNEL_ID);
    if (announceChannel?.isTextBased()) {
      const msg = await (announceChannel as TextChannel).send({ ...(ping ?? {}), embeds: [embed], components: [buildJoinRow(animationId)] });
      publicMessageId = msg.id;
    }
  } catch (err) {
    console.error('[validate-button] Failed to post public embed:', err);
  }

  if (publicMessageId) {
    await supabase
      .from('animations')
      .update({ discord_message_id: publicMessageId })
      .eq('id', animationId);
  }

  if (anim.creator?.discord_id) {
    await sendDM(
      anim.creator.discord_id,
      `✅ Ton animation **${anim.title}** a été validée par ${profile.username} ! Elle est maintenant ouverte aux inscriptions.`,
    );
  }

  await interaction.editReply({ content: `✅ Animation **${anim.title}** validée avec succès.` });
}

export async function handleRejectButton(interaction: ButtonInteraction, animationId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`reject-modal:${animationId}`)
    .setTitle('Refuser l\'animation');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Raison du refus')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(5)
    .setMaxLength(500)
    .setPlaceholder('Explique pourquoi cette animation est refusée…')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  await interaction.showModal(modal);
}

export async function handleRejectModal(interaction: ModalSubmitInteraction, animationId: string) {
  await interaction.deferReply({ ephemeral: true });

  const reason = interaction.fields.getTextInputValue('reason');

  const profile = await getResponsableProfile(interaction.user.id);
  if (!profile) {
    await interaction.editReply({ content: '❌ Tu n\'as pas les droits pour refuser une animation.' });
    return;
  }

  const anim = await fetchAnimation(animationId);
  if (!anim || anim.status !== 'pending_validation') {
    await interaction.editReply({ content: '❌ Cette animation ne peut plus être refusée (statut incorrect).' });
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('animations')
    .update({
      status: 'rejected',
      rejected_by: profile.id,
      rejected_at: now,
      rejection_reason: reason,
    })
    .eq('id', animationId);

  if (error) {
    await interaction.editReply({ content: '❌ Erreur lors du refus.' });
    return;
  }

  await supabase.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.reject',
    target_type: 'animation',
    target_id: animationId,
    metadata: { reason, via: 'discord_button' },
  });

  // Delete the admin validation message
  try {
    const validationChannel = await client.channels.fetch(env.DISCORD_VALIDATION_CHANNEL_ID);
    if (validationChannel?.isTextBased() && anim.discord_message_id) {
      const msg = await (validationChannel as TextChannel).messages.fetch(anim.discord_message_id);
      await msg.delete();
    }
  } catch {}

  if (anim.creator?.discord_id) {
    await sendDM(
      anim.creator.discord_id,
      `❌ Ton animation **${anim.title}** a été refusée.\n\n**Raison :** ${reason}`,
    );
  }

  await interaction.editReply({ content: `❌ Animation **${anim.title}** refusée.` });
}

export async function handleRequeteAcceptButton(interaction: ButtonInteraction, requeteId: string) {
  await interaction.deferReply({ ephemeral: true });

  const profile = await getRequeteResponsableProfile(interaction.user.id);
  if (!profile) {
    await interaction.editReply({ content: '❌ Tu n\'as pas les droits pour traiter cette requête.' });
    return;
  }

  const requete = await fetchRequete(requeteId);
  if (!requete || requete.status !== 'pending') {
    await interaction.editReply({ content: '❌ Cette requête a déjà été traitée.' });
    return;
  }

  // Validate destination matches role
  if (requete.destination === 'ra' && profile.role !== 'responsable' && profile.role !== 'direction' && profile.role !== 'gerance') {
    await interaction.editReply({ content: '❌ Cette requête est destinée aux Responsables Animation.' });
    return;
  }
  if (requete.destination === 'rmj' && profile.role !== 'responsable_mj' && profile.role !== 'direction' && profile.role !== 'gerance') {
    await interaction.editReply({ content: '❌ Cette requête est destinée aux Responsables MJ.' });
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('requetes')
    .update({ status: 'accepted', decided_by: profile.id, decided_at: now })
    .eq('id', requeteId);

  if (error) {
    await interaction.editReply({ content: '❌ Erreur lors de l\'acceptation.' });
    return;
  }

  // Delete the Discord message
  try {
    await interaction.message.delete();
  } catch {}

  const subjectLabel = SUBJECT_LABELS[requete.subject] ?? requete.subject;
  const destLabel = DESTINATION_LABELS[requete.destination] ?? requete.destination;

  if (requete.creator?.discord_id) {
    await sendDM(
      requete.creator.discord_id,
      `✅ Ta requête **${subjectLabel}** (${destLabel}) a été acceptée par ${profile.username}.`,
    );
  }

  await interaction.editReply({ content: `✅ Requête acceptée.` });
}

export async function handleRequeteRefuseButton(interaction: ButtonInteraction, requeteId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`requete-refuse-modal:${requeteId}`)
    .setTitle('Refuser la requête');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Raison du refus')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(5)
    .setMaxLength(500)
    .setPlaceholder('Explique pourquoi cette requête est refusée…')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  await interaction.showModal(modal);
}

export async function handleRequeteRefuseModal(interaction: ModalSubmitInteraction, requeteId: string) {
  await interaction.deferReply({ ephemeral: true });

  const reason = interaction.fields.getTextInputValue('reason');

  const profile = await getRequeteResponsableProfile(interaction.user.id);
  if (!profile) {
    await interaction.editReply({ content: '❌ Tu n\'as pas les droits pour traiter cette requête.' });
    return;
  }

  const requete = await fetchRequete(requeteId);
  if (!requete || requete.status !== 'pending') {
    await interaction.editReply({ content: '❌ Cette requête a déjà été traitée.' });
    return;
  }

  // Validate destination matches role
  if (requete.destination === 'ra' && profile.role !== 'responsable' && profile.role !== 'direction' && profile.role !== 'gerance') {
    await interaction.editReply({ content: '❌ Cette requête est destinée aux Responsables Animation.' });
    return;
  }
  if (requete.destination === 'rmj' && profile.role !== 'responsable_mj' && profile.role !== 'direction' && profile.role !== 'gerance') {
    await interaction.editReply({ content: '❌ Cette requête est destinée aux Responsables MJ.' });
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('requetes')
    .update({ status: 'refused', decided_by: profile.id, decided_at: now, decision_reason: reason })
    .eq('id', requeteId);

  if (error) {
    await interaction.editReply({ content: '❌ Erreur lors du refus.' });
    return;
  }

  // Delete the Discord message
  try {
    const validationChannel = await client.channels.fetch(env.DISCORD_VALIDATION_CHANNEL_ID);
    if (validationChannel?.isTextBased()) {
      const msg = await (validationChannel as TextChannel).messages.fetch(interaction.message?.id ?? '');
      await msg.delete();
    }
  } catch {}

  const subjectLabel = SUBJECT_LABELS[requete.subject] ?? requete.subject;
  const destLabel = DESTINATION_LABELS[requete.destination] ?? requete.destination;

  if (requete.creator?.discord_id) {
    await sendDM(
      requete.creator.discord_id,
      `❌ Ta requête **${subjectLabel}** (${destLabel}) a été refusée par ${profile.username}.\n\n**Raison :** ${reason}`,
    );
  }

  await interaction.editReply({ content: `❌ Requête refusée.` });
}

export async function handleAnimJoinButton(interaction: ButtonInteraction, animationId: string) {
  await interaction.deferReply({ ephemeral: true });

  // Check profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, username')
    .eq('discord_id', interaction.user.id)
    .single();

  if (!profile) {
    await interaction.editReply({ content: '❌ Tu n\'as pas de compte sur le panel. Connecte-toi d\'abord sur le site.' });
    return;
  }

  const staffRoles = ['animateur', 'mj', 'senior', 'mj_senior', 'responsable', 'responsable_mj', 'direction', 'gerance'];
  if (!staffRoles.includes(profile.role)) {
    await interaction.editReply({ content: '❌ Tu n\'as pas accès au panel.' });
    return;
  }

  // Fetch animation
  const { data: anim } = await supabase
    .from('animations')
    .select('id, title, status, scheduled_at, creator_id, required_participants, discord_message_id')
    .eq('id', animationId)
    .single();

  if (!anim || anim.status !== 'open') {
    await interaction.editReply({ content: '❌ Cette animation n\'accepte plus d\'inscriptions.' });
    return;
  }

  if (anim.creator_id === profile.id) {
    await interaction.editReply({ content: '❌ Tu ne peux pas t\'inscrire à ta propre animation.' });
    return;
  }

  // Check existing participant row
  const { data: existing } = await supabase
    .from('animation_participants')
    .select('id, status')
    .eq('animation_id', animationId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (existing) {
    const msg = existing.status === 'removed'
      ? '❌ Tu as été retiré de cette animation et ne peux plus y participer.'
      : existing.status === 'rejected'
      ? '❌ Ta candidature a été refusée pour cette animation.'
      : existing.status === 'validated'
      ? '✅ Tu es déjà inscrit à cette animation.'
      : '⏳ Tu as déjà une candidature en attente pour cette animation.';
    await interaction.editReply({ content: msg });
    return;
  }

  // Check absence covering scheduled_at
  const scheduledDate = anim.scheduled_at.slice(0, 10);
  const { data: absence } = await supabase
    .from('user_absences')
    .select('id')
    .eq('user_id', profile.id)
    .lte('from_date', scheduledDate)
    .gte('to_date', scheduledDate)
    .maybeSingle();

  if (absence) {
    await interaction.editReply({ content: '❌ Tu as déclaré une absence couvrant la date de cette animation.' });
    return;
  }

  // Insert participant (character name to be filled later from the panel)
  const { error } = await supabase.from('animation_participants').insert({
    animation_id: animationId,
    user_id: profile.id,
    character_name: '—',
    status: 'pending',
  });

  if (error) {
    await interaction.editReply({ content: '❌ Erreur lors de l\'inscription. Réessaie depuis le panel.' });
    return;
  }

  // Update embed participant count (validated only)
  if (anim.discord_message_id) {
    try {
      const { count } = await supabase
        .from('animation_participants')
        .select('id', { count: 'exact', head: true })
        .eq('animation_id', animationId)
        .eq('status', 'validated');

      const announceChannel = await client.channels.fetch(env.DISCORD_ANNOUNCE_CHANNEL_ID);
      if (announceChannel?.isTextBased()) {
        const msg = await (announceChannel as TextChannel).messages.fetch(anim.discord_message_id);
        const existingEmbed = msg.embeds[0];
        if (existingEmbed) {
          const updatedDesc = (existingEmbed.description ?? '').replace(
            /👥  Participants : \d+ \/ \d+/,
            `👥  Participants : ${count ?? 0} / ${anim.required_participants}`,
          );
          const { EmbedBuilder } = await import('discord.js');
          const updatedEmbed = EmbedBuilder.from(existingEmbed).setDescription(updatedDesc);
          await msg.edit({ embeds: [updatedEmbed], components: [buildJoinRow(animationId)] });
        }
      }
    } catch {
      // Non-blocking — the embed update failing doesn't affect the inscription
    }
  }

  await interaction.editReply({
    content: `✋ Ta candidature pour **${anim.title}** a été soumise ! Le créateur devra l'accepter. Pense à renseigner ton personnage depuis le panel.`,
  });
}
