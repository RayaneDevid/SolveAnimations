import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './client'

export type EdgeFunctionName =
  | 'auth-me'
  | 'auth-validate-staff'
  | 'animations-list'
  | 'animations-get'
  | 'animations-create'
  | 'animations-update'
  | 'animations-validate'
  | 'animations-reject'
  | 'animations-start'
  | 'animations-start-prep'
  | 'animations-stop-prep'
  | 'animations-stop'
  | 'animations-postpone'
  | 'animations-cancel'
  | 'animations-delete'
  | 'animations-request-deletion'
  | 'animations-approve-deletion'
  | 'animations-deny-deletion'
  | 'deletion-requests-list'
  | 'participants-apply'
  | 'participants-decide'
  | 'participants-update-character'
  | 'participants-remove-validated'
  | 'participants-promote-pending'
  | 'reports-list-mine'
  | 'reports-list-user'
  | 'reports-submit'
  | 'absences-list'
  | 'absences-create'
  | 'absences-delete'
  | 'stats-weekly'
  | 'stats-villages'
  | 'stats-weekly-evolution'
  | 'leaderboard'
  | 'members-list'
  | 'members-former-list'
  | 'members-remove-access'
  | 'members-reactivate'
  | 'members-update-perms'
  | 'profile-update'
  | 'paies'

type ApiOk<T> = { data: T }
type ApiError = { error: { code: string; message: string; details?: unknown } }
type ApiResponse<T> = ApiOk<T> | ApiError

export class EdgeError extends Error {
  code: string
  details?: unknown
  constructor(err: { code: string; message: string; details?: unknown }) {
    super(err.message)
    this.code = err.code
    this.details = err.details
  }
}

export async function invokeEdge<TResponse>(
  name: EdgeFunctionName,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any,
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke<ApiResponse<TResponse>>(name, {
    body,
  })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json() as ApiError
        if (body?.error) throw new EdgeError(body.error)
      } catch (e) {
        if (e instanceof EdgeError) throw e
      }
    }
    throw new EdgeError({ code: 'NETWORK_ERROR', message: error.message })
  }
  if (data && 'error' in data) {
    throw new EdgeError((data as ApiError).error)
  }
  return (data as ApiOk<TResponse>).data
}
