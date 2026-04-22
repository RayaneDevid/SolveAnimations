import client from '../client.js';
import { env, STAFF_ROLE_IDS } from '../../config/env.js';

export interface RemoveStaffRolesResult {
  removedRoles: string[];
}

/**
 * Removes all staff roles from a guild member identified by their Discord user ID.
 * Returns the list of role IDs that were actually removed.
 * Errors are caught and logged — they do NOT propagate to callers.
 */
export async function removeStaffRoles(discordUserId: string): Promise<RemoveStaffRolesResult> {
  const removedRoles: string[] = [];

  if (STAFF_ROLE_IDS.length === 0) {
    console.warn('[removeStaffRoles] No staff role IDs configured — nothing to remove.');
    return { removedRoles };
  }

  try {
    const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
    const member = await guild.members.fetch({ user: discordUserId, force: true });

    for (const roleId of STAFF_ROLE_IDS) {
      try {
        await member.roles.remove(roleId);
        removedRoles.push(roleId);
      } catch (err: any) {
        // 10011 = Unknown Role, 50013 = Missing Permissions — log anything unexpected
        const code = err?.code;
        if (code !== 10011 && code !== 50013) {
          console.warn(`[removeStaffRoles] Unexpected error removing role ${roleId} from ${discordUserId}:`, err);
        }
      }
    }
  } catch (err) {
    console.warn(`[removeStaffRoles] Failed to fetch guild member ${discordUserId}:`, err);
  }

  return { removedRoles };
}
