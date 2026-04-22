import type { Profile } from './auth.ts'
import { errorResponse } from './errorResponse.ts'

const ROLE_HIERARCHY: Record<string, number> = {
  responsable: 4,
  senior: 3,
  mj: 2,
  animateur: 1,
}

export function requireRole(
  profile: Profile,
  minRole: 'responsable' | 'senior' | 'mj' | 'animateur',
): Response | null {
  if (ROLE_HIERARCHY[profile.role] < ROLE_HIERARCHY[minRole]) {
    return errorResponse('FORBIDDEN', `Rôle requis : ${minRole}`)
  }
  return null
}

export function requireResponsable(profile: Profile): Response | null {
  return requireRole(profile, 'responsable')
}
