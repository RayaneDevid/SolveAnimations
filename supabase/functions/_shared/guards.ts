import type { Profile } from './auth.ts'
import { errorResponse } from './errorResponse.ts'

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

function rolePool(profile: Profile): string[] {
  const roles = Array.isArray(profile.available_roles) && profile.available_roles.length > 0
    ? profile.available_roles
    : [profile.role]
  return Array.from(new Set([...roles, profile.role]))
}

export function hasEffectiveRole(profile: Profile, minRole: string): boolean {
  return rolePool(profile).some((role) => (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0))
}

export function hasAnyRole(profile: Profile, roles: string[]): boolean {
  return rolePool(profile).some((role) => roles.includes(role))
}

export function isResponsableRole(roleOrProfile: string | Profile): boolean {
  const responsableRoles = ['direction', 'gerance', 'responsable', 'responsable_mj', 'responsable_bdm']
  if (typeof roleOrProfile === 'string') return responsableRoles.includes(roleOrProfile)
  return hasAnyRole(roleOrProfile, responsableRoles)
}

export function requireRole(
  profile: Profile,
  minRole: 'direction' | 'gerance' | 'responsable' | 'responsable_mj' | 'responsable_bdm' | 'senior' | 'mj_senior' | 'mj' | 'animateur' | 'bdm',
): Response | null {
  if (!hasEffectiveRole(profile, minRole)) {
    return errorResponse('FORBIDDEN', `Rôle requis : ${minRole}`)
  }
  return null
}

export function requireResponsable(profile: Profile): Response | null {
  if (!isResponsableRole(profile)) {
    return errorResponse('FORBIDDEN', 'Accès réservé aux responsables')
  }
  return null
}
