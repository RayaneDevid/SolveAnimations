import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/query/keys'

const invalidateAnimationCaches = (
  qc: ReturnType<typeof useQueryClient>,
  id?: string,
) => {
  qc.invalidateQueries({ queryKey: queryKeys.animations.all })
  qc.invalidateQueries({ queryKey: ['animation'] })
  if (id) qc.invalidateQueries({ queryKey: queryKeys.animations.detail(id) })
}

const invalidateStatsCaches = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['stats'] })
  qc.invalidateQueries({ queryKey: ['leaderboard'] })
  qc.invalidateQueries({ queryKey: ['paies'] })
  qc.invalidateQueries({ queryKey: queryKeys.weeklyReview })
}

export function useRealtimeSync() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('global-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animations' },
        (payload) => {
          const record = (payload.new ?? payload.old) as { id?: string } | null
          invalidateAnimationCaches(qc, record?.id)
          qc.invalidateQueries({ queryKey: queryKeys.calendar.availabilityAll })
          invalidateStatsCaches(qc)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animation_participants' },
        (payload) => {
          const record = (payload.new ?? payload.old) as { animation_id?: string } | null
          if (record?.animation_id) {
            invalidateAnimationCaches(qc, record.animation_id)
          }
          qc.invalidateQueries({ queryKey: queryKeys.calendar.availabilityAll })
          invalidateStatsCaches(qc)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animation_reports' },
        () => {
          qc.invalidateQueries({ queryKey: ['reports'] })
          invalidateStatsCaches(qc)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_absences' },
        () => {
          qc.invalidateQueries({ queryKey: ['absences'] })
          qc.invalidateQueries({ queryKey: queryKeys.members.list })
          qc.invalidateQueries({ queryKey: queryKeys.calendar.availabilityAll })
          qc.invalidateQueries({ queryKey: queryKeys.weeklyReview })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_warnings' },
        (payload) => {
          const record = (payload.new ?? payload.old) as { user_id?: string } | null
          qc.invalidateQueries({ queryKey: ['warnings'] })
          qc.invalidateQueries({ queryKey: queryKeys.weeklyReview })
          if (record?.user_id) {
            qc.invalidateQueries({ queryKey: queryKeys.warnings.user(record.user_id) })
          }
          qc.invalidateQueries({ queryKey: queryKeys.members.list })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.members.list })
          qc.invalidateQueries({ queryKey: queryKeys.members.directory })
          qc.invalidateQueries({ queryKey: queryKeys.members.former })
          qc.invalidateQueries({ queryKey: ['seniors'] })
          qc.invalidateQueries({ queryKey: queryKeys.calendar.availabilityAll })
          qc.invalidateQueries({ queryKey: queryKeys.weeklyReview })
          invalidateStatsCaches(qc)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trame_reports' },
        () => {
          qc.invalidateQueries({ queryKey: ['trame-reports'] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}
