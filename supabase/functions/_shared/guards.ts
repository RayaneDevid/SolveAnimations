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
}

export function isResponsableRole(role: string): boolean {
  return ['direction', 'gerance', 'responsable', 'responsable_mj'].includes(role)
}

export function requireRole(
  profile: Profile,
  minRole: 'direction' | 'gerance' | 'responsable' | 'responsable_mj' | 'senior' | 'mj_senior' | 'mj' | 'animateur',
): Response | null {
  if ((ROLE_HIERARCHY[profile.role] ?? 0) < ROLE_HIERARCHY[minRole]) {
    return errorResponse('FORBIDDEN', `Rôle requis : ${minRole}`)
  }
  return null
}

export function requireResponsable(profile: Profile): Response | null {
  if (!isResponsableRole(profile.role)) {
    return errorResponse('FORBIDDEN', 'Accès réservé aux responsables')
  }
  return null
}
