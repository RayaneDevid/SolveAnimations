import { corsHeaders } from './cors.ts'

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

const STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED:     401,
  FORBIDDEN:        403,
  NOT_FOUND:        404,
  VALIDATION_ERROR: 422,
  CONFLICT:         409,
  INTERNAL_ERROR:   500,
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
): Response {
  return new Response(
    JSON.stringify({ error: { code, message, ...(details ? { details } : {}) } }),
    {
      status: STATUS_MAP[code],
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
}
