import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const { user_id, reason } = await req.json()
  if (!user_id) return errorResponse('VALIDATION_ERROR', 'user_id requis')
  if (!reason || String(reason).trim().length < 3)
    return errorResponse('VALIDATION_ERROR', 'Une raison est requise (min. 3 caractères)')
  if (user_id === profile.id)
    return errorResponse('VALIDATION_ERROR', 'Tu ne peux pas te retirer toi-même')

  const db = getServiceClient()

  const { data: target } = await db
    .from('profiles')
    .select('id, discord_id, username, is_active')
    .eq('id', user_id)
    .single()

  if (!target) return errorResponse('NOT_FOUND', 'Membre introuvable')
  if (!target.is_active) return errorResponse('CONFLICT', 'Ce membre est déjà désactivé')

  // Notify bot to remove Discord roles (non-fatal)
  await notifyBot('member-remove-roles', { discordUserId: target.discord_id })

  // Sign out all sessions for this user
  const { error: signOutError } = await db.auth.admin.signOut(user_id, 'others')
  if (signOutError) {
    console.error('signOut error:', signOutError.message)
  }

  // Soft-delete: deactivate profile instead of deleting
  const { error: updateError } = await db
    .from('profiles')
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivation_reason: String(reason).trim(),
      deactivated_by: profile.id,
    })
    .eq('id', user_id)

  if (updateError) return errorResponse('INTERNAL_ERROR', updateError.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'member.deactivate',
    target_type: 'profile',
    target_id: target.id,
    metadata: {
      discord_id: target.discord_id,
      username: target.username,
      reason: String(reason).trim(),
    },
  })

  return jsonResponse({ success: true })
})
