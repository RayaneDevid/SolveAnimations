import type { GuildMember } from 'discord.js';
import { env } from '../config/env.js';
import { supabase } from '../lib/supabase.js';
import client from './client.js';

const PROFILE_SYNC_INTERVAL_MS = 60_000;

type StaffRole =
  | 'direction'
  | 'gerance'
  | 'responsable'
  | 'responsable_mj'
  | 'responsable_bdm'
  | 'senior'
  | 'mj_senior'
  | 'animateur'
  | 'mj'
  | 'bdm';

type ProfileRow = {
  id: string;
  discord_id: string;
  username: string;
  avatar_url: string | null;
  role: StaffRole;
  available_roles: StaffRole[] | null;
  primary_role_overridden: boolean | null;
};

const ROLE_IDS: Record<StaffRole, string | undefined> = {
  direction: env.ROLE_DIRECTION,
  gerance: env.ROLE_GERANCE,
  responsable: env.ROLE_RESPONSABLE,
  responsable_mj: env.ROLE_RESPONSABLE_MJ,
  responsable_bdm: env.ROLE_RESPONSABLE_BDM,
  senior: env.ROLE_SENIOR,
  mj_senior: env.ROLE_MJ_SENIOR,
  animateur: env.ROLE_ANIMATEUR,
  mj: env.ROLE_MJ,
  bdm: env.ROLE_BDM,
};

const ROLE_HIERARCHY: Record<StaffRole, number> = {
  direction: 6,
  gerance: 5,
  responsable: 4,
  responsable_mj: 4,
  senior: 3,
  mj_senior: 3,
  mj: 2,
  animateur: 1,
  responsable_bdm: 0.2,
  bdm: 0.1,
};

function getDiscordDisplayName(member: GuildMember): string {
  return member.nickname ?? member.user.globalName ?? member.user.username;
}

function getDiscordAvatarUrl(member: GuildMember): string | null {
  if (!member.user.avatar) return null;
  return member.user.displayAvatarURL({ extension: 'webp', size: 128 });
}

function getAvailableRoles(member: GuildMember): StaffRole[] {
  const memberRoleIds = new Set(member.roles.cache.keys());
  const roles = Object.entries(ROLE_IDS)
    .filter((entry): entry is [StaffRole, string] => Boolean(entry[1]))
    .filter(([, roleId]) => memberRoleIds.has(roleId))
    .map(([role]) => role);

  return roles.sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]);
}

function normalizeRoles(roles: StaffRole[] | null | undefined, fallback: StaffRole): StaffRole[] {
  const source = roles && roles.length > 0 ? roles : [fallback];
  return Array.from(new Set(source)).sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]);
}

function sameRoles(a: StaffRole[], b: StaffRole[]): boolean {
  return a.length === b.length && a.every((role, index) => role === b[index]);
}

async function updateProfileFromDiscord(profile: ProfileRow, member: GuildMember): Promise<boolean> {
  const username = getDiscordDisplayName(member);
  const avatarUrl = getDiscordAvatarUrl(member);
  const availableRoles = getAvailableRoles(member);

  if (availableRoles.length === 0) {
    console.warn(`[profile-sync] ${profile.discord_id} has no known staff role anymore; profile left unchanged.`);
    return false;
  }

  const currentAvailableRoles = normalizeRoles(profile.available_roles, profile.role);
  const keepExplicitRole = Boolean(
    profile.primary_role_overridden &&
    availableRoles.includes(profile.role),
  );
  const nextRole = keepExplicitRole ? profile.role : availableRoles[0];
  const nextPrimaryRoleOverridden = keepExplicitRole;

  const changes: Partial<ProfileRow> & { last_role_check_at?: string } = {};

  if (profile.username !== username) changes.username = username;
  if (profile.avatar_url !== avatarUrl) changes.avatar_url = avatarUrl;
  if (profile.role !== nextRole) changes.role = nextRole;
  if (!sameRoles(currentAvailableRoles, availableRoles)) changes.available_roles = availableRoles;
  if (Boolean(profile.primary_role_overridden) !== nextPrimaryRoleOverridden) {
    changes.primary_role_overridden = nextPrimaryRoleOverridden;
  }

  if (Object.keys(changes).length === 0) return false;

  changes.last_role_check_at = new Date().toISOString();

  const { error } = await supabase
    .from('profiles')
    .update(changes)
    .eq('id', profile.id);

  if (error) {
    console.warn(`[profile-sync] Failed to update profile ${profile.id}:`, error.message);
    return false;
  }

  await supabase.from('audit_log').insert({
    actor_id: null,
    action: 'profile.discord_sync',
    target_type: 'profile',
    target_id: profile.id,
    metadata: {
      username_changed: profile.username !== username,
      avatar_changed: profile.avatar_url !== avatarUrl,
      role_before: profile.role,
      role_after: nextRole,
      available_roles_before: currentAvailableRoles,
      available_roles_after: availableRoles,
    },
  });

  return true;
}

export async function runDiscordProfileSync(): Promise<void> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, discord_id, username, avatar_url, role, available_roles, primary_role_overridden')
    .eq('is_active', true);

  if (error) {
    console.warn('[profile-sync] Failed to fetch profiles:', error.message);
    return;
  }

  if (!profiles || profiles.length === 0) return;

  const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
  let updated = 0;

  for (const profile of profiles as ProfileRow[]) {
    try {
      const member = await guild.members.fetch({ user: profile.discord_id, force: true });
      if (await updateProfileFromDiscord(profile, member)) updated++;
    } catch (err) {
      console.warn(`[profile-sync] Failed to fetch Discord member ${profile.discord_id}:`, err);
    }
  }

  if (updated > 0) {
    console.log(`[profile-sync] Updated ${updated}/${profiles.length} profile(s) from Discord.`);
  }
}

export function startDiscordProfileSyncScheduler(): ReturnType<typeof setInterval> {
  void runDiscordProfileSync();
  return setInterval(() => void runDiscordProfileSync(), PROFILE_SYNC_INTERVAL_MS);
}
