import { useState } from 'react'
import { Trophy, Clock, Sword, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { useLeaderboard } from '@/hooks/queries/useAnimations'
import { GlassCard } from '@/components/shared/GlassCard'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/utils/format'
import type { LeaderboardEntry } from '@/types/database'

const MEDAL_STYLES = [
  'bg-gradient-to-br from-amber-400 to-yellow-600 shadow-[0_0_20px_rgba(251,191,36,0.4)]',
  'bg-gradient-to-br from-slate-300 to-slate-500 shadow-[0_0_20px_rgba(203,213,225,0.3)]',
  'bg-gradient-to-br from-orange-400 to-amber-700 shadow-[0_0_20px_rgba(251,146,60,0.3)]',
]

const MEDAL_LABELS = ['🥇', '🥈', '🥉']

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const top3 = entries.slice(0, 3)
  if (top3.length === 0) return null

  const ordered = [top3[1], top3[0], top3[2]].filter(Boolean)
  const heights = top3[1] ? ['h-28', 'h-36', 'h-24'] : ['h-36']

  return (
    <div className="flex items-end justify-center gap-4 mb-8">
      {ordered.map((entry, i) => {
        const realIdx = entry.rank - 1
        const height = heights[i]
        return (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex flex-col items-center gap-3"
          >
            <UserAvatar
              avatarUrl={entry.avatarUrl}
              username={entry.username}
              size="lg"
              className="ring-2 ring-white/20"
            />
            <div className="text-center">
              <p className="text-xs font-semibold text-white/80 max-w-[80px] truncate">
                {entry.username}
              </p>
              <p className="text-xs text-white/40">{formatDuration(entry.hoursAnimated)}</p>
            </div>
            <div
              className={`w-20 ${height} rounded-t-xl flex items-start justify-center pt-3 ${MEDAL_STYLES[realIdx] ?? ''}`}
            >
              <span className="text-2xl">{MEDAL_LABELS[realIdx]}</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function RankingTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <GlassCard className="overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {['Rang', 'Animateur', 'Rôle', 'Heures', 'Animations', 'Participations'].map((h) => (
              <th
                key={h}
                className="text-left text-xs font-semibold text-white/40 uppercase tracking-wider px-4 py-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <motion.tr
              key={entry.userId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-4 py-3">
                <span className="text-sm font-bold text-white/60">#{entry.rank}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    avatarUrl={entry.avatarUrl}
                    username={entry.username}
                    size="sm"
                  />
                  <span className="text-sm font-medium text-white/90">{entry.username}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <RoleBadge role={entry.role as never} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-sm text-white/70">
                  <Clock className="h-3.5 w-3.5 text-violet-400" />
                  {formatDuration(entry.hoursAnimated)}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-sm text-white/70">
                  <Sword className="h-3.5 w-3.5 text-cyan-400" />
                  {entry.animationsCreated}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-sm text-white/70">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  {entry.participationsValidated}
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      {entries.length === 0 && (
        <p className="text-center text-white/30 text-sm py-12">Aucune donnée</p>
      )}
    </GlassCard>
  )
}

const ANIM_ROLES = ['direction', 'gerance', 'responsable', 'senior', 'animateur']
const MJ_ROLES   = ['responsable_mj', 'mj_senior', 'mj']

export default function Leaderboard() {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week')
  const [metric, setMetric] = useState<'byHours' | 'byAnimations' | 'byParticipations'>('byHours')
  const [pole, setPole] = useState<'anim' | 'mj'>('anim')
  const { data, isLoading } = useLeaderboard(period)

  const rawEntries = data?.[metric] ?? []
  const poleRoles = pole === 'anim' ? ANIM_ROLES : MJ_ROLES
  const entries = rawEntries
    .filter((e) => poleRoles.includes(e.role))
    .map((e, i) => ({ ...e, rank: i + 1 }))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-400" />
            Classement
          </h1>
          <p className="text-sm text-white/40 mt-0.5">Performances de l'équipe</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Tabs value={pole} onValueChange={(v) => setPole(v as typeof pole)}>
            <TabsList>
              <TabsTrigger value="anim">Pôle Animation</TabsTrigger>
              <TabsTrigger value="mj">Pôle MJ</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
            <TabsList>
              <TabsTrigger value="byHours">Heures</TabsTrigger>
              <TabsTrigger value="byAnimations">Animations</TabsTrigger>
              <TabsTrigger value="byParticipations">Participations</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList>
              <TabsTrigger value="week">Sem.</TabsTrigger>
              <TabsTrigger value="month">Mois</TabsTrigger>
              <TabsTrigger value="all">Tout</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {entries.length >= 3 && <Podium entries={entries} />}
          <RankingTable entries={entries} />
        </>
      )}
    </div>
  )
}
