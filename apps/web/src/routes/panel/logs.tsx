import { useMemo, useState } from 'react'
import { Activity, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuditLogs, useMemberDirectory } from '@/hooks/queries/useAnimations'
import { GlassCard } from '@/components/shared/GlassCard'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { AuditLogEntry } from '@/types/database'
import type { StaffRoleKey } from '@/lib/config/discord'

const ACTION_LABELS: Record<string, string> = {
  'animation.validate': 'Animation validée',
  'animation.reject': 'Animation refusée',
  'animation.cancel': 'Animation annulée',
  'animation.delete': 'Animation supprimée',
  'animation.correct_finished': 'Animation corrigée',
  'animation.request_deletion': 'Suppression demandée',
  'animation.approve_deletion': 'Suppression acceptée',
  'animation.deny_deletion': 'Suppression refusée',
  'member.deactivate': 'Membre retiré',
  'member.reactivate': 'Membre réactivé',
  'user_warning.create': 'Avertissement ajouté',
  'trame_report.update': 'Trame modifiée',
  'trame_report.delete': 'Trame supprimée',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function formatMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 4)
  if (entries.length === 0) return '—'
  return entries
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ')
}

function LogRow({ log }: { log: AuditLogEntry }) {
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {log.actor ? (
            <>
              <UserAvatar avatarUrl={log.actor.avatar_url} username={log.actor.username} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white/85">{log.actor.username}</p>
                <RoleBadge role={log.actor.role as StaffRoleKey} className="mt-0.5" />
              </div>
            </>
          ) : (
            <span className="text-sm text-white/30">Utilisateur inconnu</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex whitespace-nowrap rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-300">
          {actionLabel(log.action)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-white/45">
        <span className="font-mono text-xs">{log.target_type}</span>
        {log.target_id && <span className="ml-2 font-mono text-[11px] text-white/25">{log.target_id.slice(0, 8)}</span>}
      </td>
      <td className="max-w-md px-4 py-3 text-xs text-white/45">
        <p className="truncate" title={JSON.stringify(log.metadata ?? {})}>
          {formatMetadata(log.metadata ?? {})}
        </p>
      </td>
      <td className="px-4 py-3 text-right text-sm text-white/40 whitespace-nowrap">
        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
      </td>
    </tr>
  )
}

export default function Logs() {
  const [action, setAction] = useState('')
  const [actorId, setActorId] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50
  const { data: members = [] } = useMemberDirectory()

  const filters = useMemo(() => ({ action: action || null, actorId: actorId || null, page, pageSize }), [action, actorId, page])
  const { data, isLoading, isFetching } = useAuditLogs(filters)

  const handleActionChange = (nextAction: string) => {
    setAction(nextAction)
    setPage(1)
  }

  const handleActorChange = (nextActorId: string) => {
    setActorId(nextActorId)
    setPage(1)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Activity className="h-6 w-6 text-cyan-400" />
          Logs
        </h1>
        <p className="mt-0.5 text-sm text-white/40">Actions enregistrées sur le panel</p>
      </div>

      <GlassCard className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/35">
            <Filter className="h-4 w-4" />
            Filtres
          </div>
          <select
            value={action}
            onChange={(event) => handleActionChange(event.target.value)}
            className="h-10 min-w-56 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white/80 [color-scheme:dark] focus:outline-none focus:border-cyan-500/50"
          >
            <option value="" className="bg-[#121318]">Toutes les actions</option>
            {(data?.actions ?? []).map((availableAction) => (
              <option key={availableAction} value={availableAction} className="bg-[#121318]">
                {actionLabel(availableAction)}
              </option>
            ))}
          </select>
          <select
            value={actorId}
            onChange={(event) => handleActorChange(event.target.value)}
            className="h-10 min-w-56 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white/80 [color-scheme:dark] focus:outline-none focus:border-cyan-500/50"
          >
            <option value="" className="bg-[#121318]">Tous les utilisateurs</option>
            {members.map((member) => (
              <option key={member.id} value={member.id} className="bg-[#121318]">
                {member.username}
              </option>
            ))}
          </select>
          {(action || actorId) && (
            <Button variant="outline" onClick={() => { setAction(''); setActorId(''); setPage(1) }}>
              Réinitialiser
            </Button>
          )}
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <p className="text-sm text-white/50">
            {data ? `${data.total} log${data.total > 1 ? 's' : ''}` : 'Chargement'}
            {isFetching && <span className="ml-2 text-cyan-400/60">actualisation…</span>}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="gap-1.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Préc.
            </Button>
            <span className="text-xs text-white/35">
              Page {data?.page ?? page} / {data?.totalPages ?? 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data || page >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="gap-1.5"
            >
              Suiv.
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : !data || data.logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-white/25">
            <Search className="h-8 w-8" />
            <p className="text-sm">Aucun log trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Utilisateur', 'Action', 'Cible', 'Détails', 'Date'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40 last:text-right">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
