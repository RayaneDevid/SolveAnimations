import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof Error && 'code' in error) {
          const code = (error as { code: string }).code
          if (['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'].includes(code)) return false
        }
        return failureCount < 2
      },
    },
  },
})
