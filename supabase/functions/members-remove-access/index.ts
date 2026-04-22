import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  if (profile.role !== 'responsable' && profile.role !== 'responsable_mj')
    return errorResponse('FORBIDDEN', 'Accès réservé aux responsables')

  const { user_id } = await req.json()
  if (!user_id) return errorResponse('VALIDATION_ERROR', 'user_id requis')
  if (user_id === profile.id)
    return errorResponse('VALIDATION_ERROR', 'Tu ne peux pas te retirer toi-même')

  const db = getServiceClient()

  const { data: target } = await db
    .from('profiles')
    .select('id, discord_id, username')
    .eq('id', user_id)
    .single()

  if (!target) return errorResponse('NOT_FOUND', 'Membre introuvable')

  // Remove Discord roles — fatal: if this fails the operator must fix the bot config
  const botResult = await notifyBot<{ removedRoles: string[]; failedRoles: string[]; memberNotFound: boolean }>(
    'member-remove-roles',
    { discordUserId: target.discord_id },
  )
  if (!botResult) {
    return errorResponse('INTERNAL_ERROR', 'Le bot Discord est injoignable. Vérifiez que le bot est en ligne.')
  }
  if (botResult.failedRoles && botResult.failedRoles.length > 0) {
    return errorResponse('INTERNAL_ERROR', 'Le bot n\'a pas pu retirer tous les rôles Discord. Vérifiez la hiérarchie des rôles dans les paramètres du serveur Discord (le rôle du bot doit être au-dessus des rôles staff).')
  }

  // Audit before deletion so we have context
  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'member.remove_access',
    target_type: 'profile',
    target_id: target.id,
    metadata: { discord_id: target.discord_id, username: target.username },
  })

  // Sign out all sessions for this user
  const { error: signOutError } = await db.auth.admin.signOut(user_id, 'others')
  if (signOutError) {
    console.error('signOut error:', signOutError.message)
  }

  // Delete profile (auth.users row will cascade or be cleaned up by Auth)
  const { error: deleteError } = await db
    .from('profiles')
    .delete()
    .eq('id', user_id)

  if (deleteError) return errorResponse('INTERNAL_ERROR', deleteError.message)

  // Delete auth user (profile was already deleted above)
  const { error: deleteAuthError } = await db.auth.admin.deleteUser(user_id)
  if (deleteAuthError) {
    // Non-fatal: profile is gone so they can't use the panel, but log clearly
    // so the operator knows the auth.users row may still exist.
    console.error('[members-remove-access] deleteUser failed — auth row may persist:', deleteAuthError.message)
    return jsonResponse({ success: true, warning: 'auth_user_not_deleted' })
  }

  return jsonResponse({ success: true })
})
