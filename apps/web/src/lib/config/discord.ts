export const DISCORD_GUILD_ID = import.meta.env.VITE_DISCORD_GUILD_ID as string | undefined

export const STAFF_ROLE_IDS = {
  responsable: import.meta.env.VITE_DISCORD_ROLE_RESPONSABLE as string | undefined,
  responsable_mj: import.meta.env.VITE_DISCORD_ROLE_RESPONSABLE_MJ as string | undefined,
  senior: import.meta.env.VITE_DISCORD_ROLE_SENIOR as string | undefined,
  animateur: import.meta.env.VITE_DISCORD_ROLE_ANIMATEUR as string | undefined,
  mj: import.meta.env.VITE_DISCORD_ROLE_MJ as string | undefined,
} as const

export type StaffRoleKey = 'responsable' | 'responsable_mj' | 'senior' | 'animateur' | 'mj'

export const ROLE_HIERARCHY: Record<StaffRoleKey, number> = {
  responsable: 4,
  responsable_mj: 4,
  senior: 3,
  mj: 2,
  animateur: 1,
}

export const ROLE_LABELS: Record<StaffRoleKey, string> = {
  responsable: 'Responsable',
  responsable_mj: 'Responsable MJ',
  senior: 'Senior',
  animateur: 'Animateur',
  mj: 'Maître du Jeu',
}

export const ROLE_COLORS: Record<StaffRoleKey, string> = {
  responsable: '#F59E0B',
  responsable_mj: '#F59E0B',
  senior: '#A855F7',
  animateur: '#3B82F6',
  mj: '#EF4444',
}

export function hasRole(userRole: StaffRoleKey, required: StaffRoleKey): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required]
}
