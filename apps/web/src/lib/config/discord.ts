export const DISCORD_GUILD_ID = import.meta.env.VITE_DISCORD_GUILD_ID as string | undefined

export const STAFF_ROLE_IDS = {
  direction: import.meta.env.VITE_DISCORD_ROLE_DIRECTION as string | undefined,
  gerance: import.meta.env.VITE_DISCORD_ROLE_GERANCE as string | undefined,
  responsable: import.meta.env.VITE_DISCORD_ROLE_RESPONSABLE as string | undefined,
  responsable_mj: import.meta.env.VITE_DISCORD_ROLE_RESPONSABLE_MJ as string | undefined,
  responsable_bdm: import.meta.env.VITE_DISCORD_ROLE_RESPONSABLE_BDM as string | undefined,
  senior: import.meta.env.VITE_DISCORD_ROLE_SENIOR as string | undefined,
  mj_senior: import.meta.env.VITE_DISCORD_ROLE_MJ_SENIOR as string | undefined,
  animateur: import.meta.env.VITE_DISCORD_ROLE_ANIMATEUR as string | undefined,
  mj: import.meta.env.VITE_DISCORD_ROLE_MJ as string | undefined,
  bdm: import.meta.env.VITE_DISCORD_ROLE_BDM as string | undefined,
} as const

export type StaffRoleKey = 'direction' | 'gerance' | 'responsable' | 'responsable_mj' | 'responsable_bdm' | 'senior' | 'mj_senior' | 'animateur' | 'mj' | 'bdm'

export const ROLE_HIERARCHY: Record<StaffRoleKey, number> = {
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

export const ROLE_LABELS: Record<StaffRoleKey, string> = {
  direction: 'Direction',
  gerance: 'Gérance',
  responsable: 'Responsable Anim.',
  responsable_mj: 'Responsable MJ',
  responsable_bdm: 'Responsable BDM',
  senior: 'Animateur Senior',
  mj_senior: 'MJ Senior',
  animateur: 'Animateur',
  mj: 'MJ',
  bdm: 'BDM',
}

export const ROLE_COLORS: Record<StaffRoleKey, string> = {
  direction: '#F8FAFC',
  gerance: '#C084FC',
  responsable: '#F59E0B',
  responsable_mj: '#F59E0B',
  responsable_bdm: '#06B6D4',
  senior: '#A855F7',
  mj_senior: '#F97316',
  animateur: '#3B82F6',
  mj: '#EF4444',
  bdm: '#06B6D4',
}

export const MJ_STAFF_ROLES: StaffRoleKey[] = ['responsable_mj', 'mj_senior', 'mj']

export function isMjStaffRole(role: string | null | undefined): boolean {
  return MJ_STAFF_ROLES.includes(role as StaffRoleKey)
}

export function hasRole(userRole: StaffRoleKey, required: StaffRoleKey): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required]
}

export function getHighestRole(roles: StaffRoleKey[], fallback: StaffRoleKey): StaffRoleKey {
  const allRoles = roles.length > 0 ? roles : [fallback]
  return [...allRoles].sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a])[0] ?? fallback
}

export function getPermissionRoles(user: { role: StaffRoleKey; available_roles?: StaffRoleKey[] | null }): StaffRoleKey[] {
  return Array.from(new Set([...(user.available_roles ?? []), user.role]))
}

export function getPermissionRole(user: { role: StaffRoleKey; available_roles?: StaffRoleKey[] | null }): StaffRoleKey {
  return getHighestRole(getPermissionRoles(user), user.role)
}

export function hasPermissionRole(roles: StaffRoleKey[], required: StaffRoleKey): boolean {
  return roles.some((role) => hasRole(role, required))
}

export function hasOwnedRole(roles: StaffRoleKey[], allowed: StaffRoleKey[]): boolean {
  return roles.some((role) => allowed.includes(role))
}

const ROLE_LABELS_FEMME: Partial<Record<StaffRoleKey, string>> = {
  animateur: 'Animatrice',
  senior: 'Animatrice Senior',
}

export function getRoleLabel(role: StaffRoleKey, gender?: 'homme' | 'femme' | 'autre' | null): string {
  if (gender === 'femme' && ROLE_LABELS_FEMME[role]) return ROLE_LABELS_FEMME[role]!
  return ROLE_LABELS[role]
}
