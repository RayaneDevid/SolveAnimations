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
import { buildAnimationEmbed } from './embeds/animation.js';
import { sendDM } from './actions/sendDM.js';
import client from './client.js';
import { env } from '../config/env.js';

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
    village: anim.village,
    documentUrl: anim.document_url,
    creatorUsername: anim.creator?.username ?? 'Inconnu',
    requiredParticipants: anim.required_participants,
    currentParticipants: 0,
    status: 'open',
  });

  let publicMessageId = '';
  try {
    const announceChannel = await client.channels.fetch(env.DISCORD_ANNOUNCE_CHANNEL_ID);
    if (announceChannel?.isTextBased()) {
      const msg = await (announceChannel as TextChannel).send({ embeds: [embed] });
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
