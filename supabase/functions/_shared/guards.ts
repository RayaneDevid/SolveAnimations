import type { Profile } from './auth.ts'
import { errorResponse } from './errorResponse.ts'

const ROLE_HIERARCHY: Record<string, number> = {
  responsable: 4,
  responsable_mj: 4,
  senior: 3,
  mj_senior: 3,
  mj: 2,
  animateur: 1,
}

export function isResponsableRole(role: string): boolean {
  return role === 'responsable' || role === 'responsable_mj'
}

export function requireRole(
  profile: Profile,
  minRole: 'responsable' | 'responsable_mj' | 'senior' | 'mj_senior' | 'mj' | 'animateur',
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
