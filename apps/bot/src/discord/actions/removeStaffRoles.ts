import client from '../client.js';
import { env, STAFF_ROLE_IDS } from '../../config/env.js';

export interface RemoveStaffRolesResult {
  removedRoles: string[];
  failedRoles: string[];
  memberNotFound: boolean;
}

export async function removeStaffRoles(discordUserId: string): Promise<RemoveStaffRolesResult> {
  const removedRoles: string[] = [];
  const failedRoles: string[] = [];

  if (STAFF_ROLE_IDS.length === 0) {
    console.error('[removeStaffRoles] No staff role IDs configured — nothing to remove. Check bot env vars (ROLE_RESPONSABLE, ROLE_SENIOR, etc.)');
    return { removedRoles, failedRoles, memberNotFound: false };
  }

  try {
    const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
    const member = await guild.members.fetch({ user: discordUserId, force: true });

    for (const roleId of STAFF_ROLE_IDS) {
      if (!member.roles.cache.has(roleId)) continue;
      try {
        await member.roles.remove(roleId, 'Accès panel révoqué');
        removedRoles.push(roleId);
        console.log(`[removeStaffRoles] Removed role ${roleId} from ${discordUserId}`);
      } catch (err: any) {
        failedRoles.push(roleId);
        if (err?.code === 50013) {
          console.error(`[removeStaffRoles] Missing Permissions for role ${roleId} — le rôle du bot doit être au-dessus des rôles staff dans la hiérarchie Discord.`);
        } else {
          console.error(`[removeStaffRoles] Failed to remove role ${roleId} from ${discordUserId}:`, err);
        }
      }
    }
  } catch (err: any) {
    if (err?.code === 10007) {
      // Unknown Member — they left the server, not an error
      console.log(`[removeStaffRoles] Member ${discordUserId} not found in guild (already left).`);
      return { removedRoles, failedRoles, memberNotFound: true };
    }
    console.error(`[removeStaffRoles] Failed to fetch guild member ${discordUserId}:`, err);
  }

  return { removedRoles, failedRoles, memberNotFound: false };
}
