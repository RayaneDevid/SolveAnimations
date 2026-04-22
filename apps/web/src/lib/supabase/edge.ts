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
  | 'animations-stop'
  | 'animations-postpone'
  | 'animations-cancel'
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
  | 'leaderboard'
  | 'members-list'
  | 'members-remove-access'

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
    throw new EdgeError({ code: 'NETWORK_ERROR', message: error.message })
  }
  if (data && 'error' in data) {
    throw new EdgeError((data as ApiError).error)
  }
  return (data as ApiOk<TResponse>).data
}
