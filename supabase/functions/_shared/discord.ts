import { notifyBot } from './bot.ts'

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
  | { ok: true; role: StaffRole; availableRoles: StaffRole[]; discordId: string; username: string; discordUsername: string; avatarUrl: string | null }
  | { ok: false }

type DiscordUser = {
  id: string
  username: string
  discriminator?: string
  global_name?: string | null
  avatar?: string | null
}

type DiscordMember = {
  roles?: string[]
  nick?: string | null
  user?: DiscordUser
}

type BotLookupResponse = {
  success: boolean
  data?: GuildMemberResult & { reason?: string; discordRoleIds?: string[] }
}

function buildResultFromMember(member: DiscordMember): GuildMemberResult {
  const memberRoles: string[] = member.roles ?? []

  const availableRoles: StaffRole[] = []
  for (const [roleName, roleId] of Object.entries(ROLE_IDS)) {
    if (memberRoles.includes(roleId)) {
      availableRoles.push(roleName as StaffRole)
    }
  }

  availableRoles.sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a])
  const bestRole = availableRoles[0] ?? null

  if (!bestRole || !member.user) return { ok: false }

  const user = member.user
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128`
    : null

  const displayName: string = member.nick ?? user.global_name ?? user.username
  const discordUsername: string = user.discriminator && user.discriminator !== '0'
    ? `${user.username}#${user.discriminator}`
    : user.username

  return {
    ok: true,
    role: bestRole,
    availableRoles,
    discordId: user.id,
    username: displayName,
    discordUsername,
    avatarUrl,
  }
}

async function getCurrentDiscordUser(providerToken: string): Promise<DiscordUser | null> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${providerToken}` },
  })
  if (!res.ok) return null
  return await res.json() as DiscordUser
}

async function getGuildMemberViaBot(discordUserId: string): Promise<GuildMemberResult> {
  const result = await notifyBot<BotLookupResponse>('discord-member-lookup', { discordUserId })
  if (result?.data?.ok) {
    return result.data
  }
  console.warn('Discord bot member lookup failed or found no mapped staff role', {
    discordUserId,
    reason: result?.data && 'reason' in result.data ? result.data.reason : null,
  })
  return { ok: false }
}

export async function getGuildMember(
  providerToken: string,
): Promise<GuildMemberResult> {
  const res = await fetch(
    `${DISCORD_API}/users/@me/guilds/${GUILD_ID}/member`,
    { headers: { Authorization: `Bearer ${providerToken}` } },
  )

  if (!res.ok) {
    console.warn('Discord OAuth guild member lookup failed', { status: res.status })
    const user = await getCurrentDiscordUser(providerToken)
    return user ? await getGuildMemberViaBot(user.id) : { ok: false }
  }

  const member = await res.json() as DiscordMember
  const oauthResult = buildResultFromMember(member)
  if (oauthResult.ok) return oauthResult

  if (member.user?.id) {
    console.warn('Discord OAuth member lookup returned no mapped staff role, trying bot fallback', {
      discordUserId: member.user.id,
      discordRoleIds: member.roles ?? [],
    })
    return await getGuildMemberViaBot(member.user.id)
  }

  return { ok: false }
}

export function getAllStaffRoleIds(): string[] {
  return Object.values(ROLE_IDS).filter(Boolean)
}
