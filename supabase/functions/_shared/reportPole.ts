export type ReportPole = 'animateur' | 'mj' | 'bdm'

export type RoleCarrier = {
  role?: string | null
  available_roles?: string[] | null
}

const ANIMATION_ROLES = new Set(['animateur', 'senior', 'responsable', 'direction', 'gerance'])
const MJ_ROLES = new Set(['mj', 'mj_senior', 'responsable_mj'])
const BDM_ROLES = new Set(['bdm', 'responsable_bdm'])

export function getProfileRoles(profile: RoleCarrier | null | undefined): string[] {
  return Array.from(new Set([...(profile?.available_roles ?? []), profile?.role].filter(Boolean) as string[]))
}

export function getAllowedReportPoles(profile: RoleCarrier | null | undefined): ReportPole[] {
  const roles = getProfileRoles(profile)
  const poles: ReportPole[] = []
  if (roles.some((role) => ANIMATION_ROLES.has(role))) poles.push('animateur')
  if (roles.some((role) => MJ_ROLES.has(role))) poles.push('mj')
  if (roles.some((role) => BDM_ROLES.has(role))) poles.push('bdm')
  return poles
}

export function defaultReportPole(profile: RoleCarrier | null | undefined, animation: { pole?: string | null; bdm_mission?: boolean | null }): ReportPole {
  const allowed = getAllowedReportPoles(profile)
  if (animation.bdm_mission && allowed.includes('bdm')) return 'bdm'
  if (animation.pole === 'mj' && allowed.includes('mj')) return 'mj'
  if (allowed.includes('animateur')) return 'animateur'
  if (allowed.includes('mj')) return 'mj'
  return allowed[0] ?? 'animateur'
}

