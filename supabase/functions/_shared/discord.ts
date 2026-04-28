const DISCORD_API = 'https://discord.com/api/v10'
const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID')!

function roleId(name: string, fallback?: string): string {
  const value = Deno.env.get(name)?.trim()
  return value || fallback || ''
}

const ROLE_IDS = {
  direction:       roleId('DISCORD_ROLE_DIRECTION'),
  gerance:         roleId('DISCORD_ROLE_GERANCE'),
  responsable:     roleId('DISCORD_ROLE_RESPONSABLE'),
  responsable_mj:  roleId('DISCORD_ROLE_RESPONSABLE_MJ'),
  responsable_bdm: roleId('DISCORD_ROLE_RESPONSABLE_BDM', '1498316267411738735'),
  senior:          roleId('DISCORD_ROLE_SENIOR'),
  mj_senior:       roleId('DISCORD_ROLE_MJ_SENIOR'),
  animateur:       roleId('DISCORD_ROLE_ANIMATEUR'),
  mj:              roleId('DISCORD_ROLE_MJ'),
  bdm:             roleId('DISCORD_ROLE_BDM', '1498316348735099010'),
}

const ROLE_HIERARCHY: Record<string, number> = {
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
}

type StaffRole = 'direction' | 'gerance' | 'responsable' | 'responsable_mj' | 'responsable_bdm' | 'senior' | 'mj_senior' | 'animateur' | 'mj' | 'bdm'

export type GuildMemberResult =
  | { ok: true; role: StaffRole; discordId: string; username: string; avatarUrl: string | null }
  | { ok: false }

export async function getGuildMember(
  providerToken: string,
): Promise<GuildMemberResult> {
  const res = await fetch(
    `${DISCORD_API}/users/@me/guilds/${GUILD_ID}/member`,
    { headers: { Authorization: `Bearer ${providerToken}` } },
  )

  if (!res.ok) return { ok: false }

  const member = await res.json()
  const memberRoles: string[] = member.roles ?? []

  // Find the highest role this member has
  let bestRole: StaffRole | null = null
  for (const [roleName, roleId] of Object.entries(ROLE_IDS)) {
    if (memberRoles.includes(roleId)) {
      if (!bestRole || ROLE_HIERARCHY[roleName] > ROLE_HIERARCHY[bestRole]) {
        bestRole = roleName as StaffRole
      }
    }
  }

  if (!bestRole) return { ok: false }

  const user = member.user
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128`
    : null

  const displayName: string = member.nick ?? user.global_name ?? user.username

  return {
    ok: true,
    role: bestRole,
    discordId: user.id,
    username: displayName,
    avatarUrl,
  }
}

export function getAllStaffRoleIds(): string[] {
  return Object.values(ROLE_IDS).filter(Boolean)
}
