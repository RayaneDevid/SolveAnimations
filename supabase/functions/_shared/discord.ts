const DISCORD_API = 'https://discord.com/api/v10'
const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID')!

const ROLE_IDS = {
  responsable:    Deno.env.get('DISCORD_ROLE_RESPONSABLE')!,
  responsable_mj: Deno.env.get('DISCORD_ROLE_RESPONSABLE_MJ')!,
  senior:         Deno.env.get('DISCORD_ROLE_SENIOR')!,
  mj_senior:      Deno.env.get('DISCORD_ROLE_MJ_SENIOR')!,
  animateur:      Deno.env.get('DISCORD_ROLE_ANIMATEUR')!,
  mj:             Deno.env.get('DISCORD_ROLE_MJ')!,
}

const ROLE_HIERARCHY: Record<string, number> = {
  responsable: 4,
  responsable_mj: 4,
  senior: 3,
  mj_senior: 3,
  mj: 2,
  animateur: 1,
}

type StaffRole = 'responsable' | 'responsable_mj' | 'senior' | 'mj_senior' | 'animateur' | 'mj'

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
