import client from '../client.js';
import { env, STAFF_ROLE_IDS } from '../../config/env.js';

type StaffRole = 'direction' | 'gerance' | 'responsable' | 'responsable_mj' | 'responsable_bdm' | 'senior' | 'mj_senior' | 'animateur' | 'mj' | 'bdm';

const ROLE_ID_MAP: Record<StaffRole, string | undefined> = {
  direction:      env.ROLE_DIRECTION,
  gerance:        env.ROLE_GERANCE,
  responsable:    env.ROLE_RESPONSABLE,
  responsable_mj: env.ROLE_RESPONSABLE_MJ,
  responsable_bdm: env.ROLE_RESPONSABLE_BDM,
  senior:         env.ROLE_SENIOR,
  mj_senior:      env.ROLE_MJ_SENIOR,
  animateur:      env.ROLE_ANIMATEUR,
  mj:             env.ROLE_MJ,
  bdm:            env.ROLE_BDM,
};

export interface AddStaffRolesResult {
  addedRoles: string[];
}

export async function addStaffRoles(discordUserId: string, role: StaffRole): Promise<AddStaffRolesResult> {
  const addedRoles: string[] = [];

  if (STAFF_ROLE_IDS.length === 0) {
    console.warn('[addStaffRoles] No staff role IDs configured — nothing to add.');
    return { addedRoles };
  }

  const roleId = ROLE_ID_MAP[role];
  if (!roleId) {
    console.warn(`[addStaffRoles] No Discord role ID configured for role "${role}".`);
    return { addedRoles };
  }

  try {
    const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
    const member = await guild.members.fetch({ user: discordUserId, force: true });
    await member.roles.add(roleId);
    addedRoles.push(roleId);
  } catch (err: any) {
    const code = err?.code;
    if (code !== 10011 && code !== 50013) {
      console.warn(`[addStaffRoles] Error adding role ${roleId} to ${discordUserId}:`, err);
    }
  }

  return { addedRoles };
}
