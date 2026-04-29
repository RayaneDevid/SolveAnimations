import { useState } from 'react'
import { Users, UserX, CalendarOff, AlertTriangle, History, RotateCcw, Gamepad2, CalendarDays, CheckCircle2, CircleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMembers, useFormerMembers } from '@/hooks/queries/useAnimations'
import { useRemoveMemberAccess, useReactivateMember, useUpdateMemberPerms } from '@/hooks/mutations/useAnimationMutations'
import { GlassCard } from '@/components/shared/GlassCard'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { GenderIcon } from '@/components/shared/GenderIcon'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { MemberEntry } from '@/types/database'
import type { FormerMemberEntry } from '@/hooks/queries/useAnimations'

const MANAGEMENT_ROLE_ORDER = ['direction', 'gerance']
const ANIM_ROLE_ORDER = ['responsable', 'senior', 'animateur']
const MJ_ROLE_ORDER   = ['responsable_mj', 'mj_senior', 'mj']
const BDM_ROLE_ORDER  = ['responsable_bdm', 'bdm']

type MemberSortMode = 'role' | 'quota' | 'name'

function sortByRole(members: MemberEntry[], order: string[]): MemberEntry[] {
  return [...members].sort((a, b) => {
    const ia = order.indexOf(a.role)
    const ib = order.indexOf(b.role)
    if (ia !== ib) return ia - ib
    return a.username.localeCompare(b.username)
  })
}

function quotaRatio(member: MemberEntry): number {
  const quotaMax = member.weeklyStats.quotaMax
  if (quotaMax === null) return Number.POSITIVE_INFINITY
  const quota = member.weeklyStats.animationsCreated + member.weeklyStats.participationsValidated
  return quotaMax > 0 ? quota / quotaMax : 0
}

function sortMembers(members: MemberEntry[], mode: MemberSortMode, roleOrder: string[]): MemberEntry[] {
  if (mode === 'name') {
    return [...members].sort((a, b) => a.username.localeCompare(b.username))
  }
  if (mode === 'quota') {
    return [...members].sort((a, b) => {
      const ratioDiff = quotaRatio(b) - quotaRatio(a)
      if (ratioDiff !== 0) return ratioDiff
      const quotaDiff =
        (b.weeklyStats.animationsCreated + b.weeklyStats.participationsValidated) -
        (a.weeklyStats.animationsCreated + a.weeklyStats.participationsValidated)
      if (quotaDiff !== 0) return quotaDiff
      return a.username.localeCompare(b.username)
    })
  }
  return sortByRole(members, roleOrder)
}

// ─── Remove confirm modal ─────────────────────────────────────────────────────

function RemoveConfirmModal({
  member,
  open,
  onClose,
}: {
  member: MemberEntry
  open: boolean
  onClose: () => void
}) {
  const { mutateAsync, isPending } = useRemoveMemberAccess()
  const [reason, setReason] = useState('')

  const handleConfirm = async () => {
    if (reason.trim().length < 3) {
      toast.error('La raison doit faire au moins 3 caractères')
      return
    }
    try {
      await mutateAsync({ userId: member.id, reason: reason.trim() })
      toast.success(`Accès de ${member.username} révoqué`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la révocation')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Retirer l'accès
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <UserAvatar avatarUrl={member.avatarUrl} username={member.username} />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-white/90">{member.username}</p>
                <GenderIcon gender={member.gender} />
              </div>
              <RoleBadge role={member.role as never} gender={member.gender} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Raison du retrait</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex. Viré du pôle, Inactivité prolongée…"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-red-500/50"
            />
          </div>

          <p className="text-sm text-white/60">
            Le membre perdra ses rôles Discord et ne pourra plus se connecter.
            Son historique est conservé en archive.
            L'action est <span className="text-red-400 font-medium">irréversible</span>.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isPending}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending || reason.trim().length < 3}
            >
              {isPending ? 'Révocation...' : 'Confirmer le retrait'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Profile tooltip ──────────────────────────────────────────────────────────

function ProfileTooltip({ member: m }: { member: MemberEntry }) {
  const filled = [m.steamId, m.arrivalDate].filter(Boolean).length
  const total = 2

  const icon =
    filled === total ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
    ) : filled === 0 ? (
      <CircleAlert className="h-3.5 w-3.5 text-red-400/70" />
    ) : (
      <CircleAlert className="h-3.5 w-3.5 text-amber-400" />
    )

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">{icon}</button>
      </TooltipTrigger>
      <TooltipContent side="right" className="space-y-1.5 p-3 max-w-xs">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Profil ({filled}/{total})
        </p>
        <div className="flex items-center gap-2 text-xs">
          <Gamepad2 className="h-3.5 w-3.5 text-white/40 shrink-0" />
          {m.steamId ? (
            <span className="font-mono text-white/80">{m.steamId}</span>
          ) : (
            <span className="text-red-400/80 italic">Non renseigné</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <CalendarDays className="h-3.5 w-3.5 text-white/40 shrink-0" />
          {m.arrivalDate ? (
            <span className="text-white/80">{new Date(m.arrivalDate).toLocaleDateString('fr-FR')}</span>
          ) : (
            <span className="text-red-400/80 italic">Non renseignée</span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function AbsenceBadge({ reason, declaredBy }: { reason: string | null; declaredBy: string | null }) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-400">
          Absent
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs p-3">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Raison</p>
        <p className="text-sm text-white/80">{reason?.trim() || 'Aucune raison renseignée'}</p>
        <p className="mt-2 text-xs text-white/35">
          Déclarée par <span className="text-white/60">{declaredBy ?? 'inconnu'}</span>
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

// ─── Active member table ──────────────────────────────────────────────────────

function MemberTable({
  members,
  onRemove,
}: {
  members: MemberEntry[]
  onRemove: (m: MemberEntry) => void
}) {
  if (members.length === 0) {
    return <p className="text-center text-white/30 text-sm py-12">Aucun membre</p>
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-white/[0.06]">
          {['Membre', 'Rôle', 'Anim. (joueur/sem)', 'Heures (joueur/sem)', 'Quota', 'Absence', ''].map((h) => (
            <th key={h} className="text-left text-xs font-semibold text-white/40 uppercase tracking-wider px-4 py-3">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {members.map((m, i) => {
          const quotaMax = m.weeklyStats.quotaMax
          const quota = m.weeklyStats.animationsCreated + m.weeklyStats.participationsValidated
          const quotaPct = quotaMax ? Math.min(100, (quota / quotaMax) * 100) : 100
          return (
            <motion.tr
              key={m.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <UserAvatar avatarUrl={m.avatarUrl} username={m.username} size="sm" />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium text-white/90 truncate">{m.username}</span>
                    <GenderIcon gender={m.gender} />
                    {m.isAbsent && <CalendarOff className="h-3.5 w-3.5 text-orange-400 shrink-0" />}
                    <ProfileTooltip member={m} />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3"><RoleBadge role={m.role as never} /></td>
              <td className="px-4 py-3 text-sm text-white/60">
                <span className="text-white/90 font-medium">{m.weeklyStats.animationsCreated}</span>
                <span className="text-white/30"> / {m.weeklyTotals?.animationsCreated ?? 0}</span>
              </td>
              <td className="px-4 py-3 text-sm text-white/60">
                <span className="text-white/90 font-medium">{(m.weeklyStats.hoursAnimated / 60).toFixed(1)}h</span>
                <span className="text-white/30"> / {((m.weeklyTotals?.hoursAnimated ?? 0) / 60).toFixed(1)}h</span>
              </td>
              <td className="px-4 py-3 w-32">
                {quotaMax === null ? (
                  <span className="text-xs text-white/30">Illimité</span>
                ) : (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/60">{quota}/{quotaMax}</span>
                    </div>
                    <Progress
                      value={quotaPct}
                      className="h-1"
                      indicatorClassName={
                        quotaPct >= 100
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                          : quotaPct < 40
                          ? 'bg-gradient-to-r from-red-400 to-orange-400'
                          : undefined
                      }
                    />
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                {m.isAbsent ? (
                  <AbsenceBadge reason={m.absenceReason} declaredBy={m.absenceDeclaredBy} />
                ) : (
                  <span className="text-xs text-white/20">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Button variant="destructive" size="sm" onClick={() => onRemove(m)} className="text-xs gap-1.5 h-7">
                  <UserX className="h-3 w-3" />
                  Retirer
                </Button>
              </td>
            </motion.tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Former members table ─────────────────────────────────────────────────────

function PermCheckbox({
  checked,
  label,
  onChange,
  pending,
}: {
  checked: boolean
  label: string
  onChange: (v: boolean) => void
  pending: boolean
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={pending}
      title={label}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${
        checked
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
          : 'bg-white/[0.03] border-white/[0.08] text-white/30 hover:text-white/50 hover:border-white/20'
      }`}
    >
      <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
        checked ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'
      }`}>
        {checked && (
          <svg viewBox="0 0 10 8" className="h-2 w-2 text-white fill-current">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </button>
  )
}

function FormerMembersTable({ entries }: { entries: FormerMemberEntry[] }) {
  const { mutateAsync: reactivate, isPending: reactivating } = useReactivateMember()
  const { mutate: updatePerms, isPending: updatingPerms } = useUpdateMemberPerms()

  const handleReactivate = async (m: FormerMemberEntry) => {
    if (!confirm(`Réactiver ${m.username} ? Il pourra se reconnecter une fois ses rôles Discord restaurés.`)) return
    try {
      await reactivate(m.id)
      toast.success(`${m.username} réactivé`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  if (entries.length === 0) {
    return <p className="text-center text-white/30 text-sm py-12">Aucun ancien membre</p>
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-white/[0.06]">
          {['Membre', 'Ancien rôle', 'Raison', 'Retiré par', 'Date', 'Total anim.', 'Perms retirées', ''].map((h) => (
            <th key={h} className="text-left text-xs font-semibold text-white/40 uppercase tracking-wider px-4 py-3">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((m, i) => (
          <motion.tr
            key={m.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors opacity-70"
          >
            <td className="px-4 py-3">
              <div className="flex items-center gap-2.5">
                <UserAvatar avatarUrl={m.avatarUrl} username={m.username} size="sm" />
                <span className="text-sm font-medium text-white/70">{m.username}</span>
              </div>
            </td>
            <td className="px-4 py-3"><RoleBadge role={m.role as never} /></td>
            <td className="px-4 py-3">
              <span className="text-sm text-white/60 italic">{m.deactivationReason ?? '—'}</span>
            </td>
            <td className="px-4 py-3 text-sm text-white/40">{m.deactivatedByUsername ?? '—'}</td>
            <td className="px-4 py-3 text-sm text-white/40 whitespace-nowrap">
              {m.deactivatedAt
                ? formatDistanceToNow(new Date(m.deactivatedAt), { addSuffix: true, locale: fr })
                : '—'}
            </td>
            <td className="px-4 py-3 text-sm text-white/50">
              {m.totalAnimationsCreated} anim · {(m.totalHoursAnimated / 60).toFixed(1)}h
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-col gap-1.5">
                <PermCheckbox
                  checked={m.igPermsRemoved}
                  label="IG"
                  pending={updatingPerms}
                  onChange={(v) => updatePerms({ userId: m.id, field: 'ig_perms_removed', value: v })}
                />
                <PermCheckbox
                  checked={m.discordPermsRemoved}
                  label="Discord"
                  pending={updatingPerms}
                  onChange={(v) => updatePerms({ userId: m.id, field: 'discord_perms_removed', value: v })}
                />
              </div>
            </td>
            <td className="px-4 py-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReactivate(m)}
                disabled={reactivating}
                className="text-xs gap-1.5 h-7 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <RotateCcw className="h-3 w-3" />
                Réactiver
              </Button>
            </td>
          </motion.tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Members() {
  const { data: members = [], isLoading } = useMembers()
  const { data: former = [], isLoading: isLoadingFormer } = useFormerMembers()
  const [removingMember, setRemovingMember] = useState<MemberEntry | null>(null)
  const [sortMode, setSortMode] = useState<MemberSortMode>('role')

  const managementMembers = sortMembers(members.filter((m) => MANAGEMENT_ROLE_ORDER.includes(m.role)), sortMode, MANAGEMENT_ROLE_ORDER)
  const poleAnimMembers   = sortMembers(members.filter((m) => ANIM_ROLE_ORDER.includes(m.role)), sortMode, ANIM_ROLE_ORDER)
  const poleMjMembers     = sortMembers(members.filter((m) => MJ_ROLE_ORDER.includes(m.role)), sortMode, MJ_ROLE_ORDER)
  const bdmMembers        = sortMembers(members.filter((m) => BDM_ROLE_ORDER.includes(m.role)), sortMode, BDM_ROLE_ORDER)

  const stats = {
    total: members.length,
    management: managementMembers.length,
    poleAnim: poleAnimMembers.length,
    poleMj: poleMjMembers.length,
    bdm: bdmMembers.length,
    absent: members.filter((m) => m.isAbsent).length,
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-cyan-400" />
          Membres
        </h1>
        <p className="text-sm text-white/40 mt-0.5">Gestion de l'équipe</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total actifs', value: stats.total, color: 'text-white' },
          { label: 'Direction/Gérance', value: stats.management, color: 'text-purple-400' },
          { label: 'Pôle Animation', value: stats.poleAnim, color: 'text-violet-400' },
          { label: 'Pôle MJ', value: stats.poleMj, color: 'text-red-400' },
          { label: 'BDM', value: stats.bdm, color: 'text-cyan-400' },
          { label: 'Absents', value: stats.absent, color: 'text-orange-400' },
        ].map(({ label, value, color }) => (
          <GlassCard key={label} className="p-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-white/40 mt-0.5">{label}</p>
          </GlassCard>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : (
        <Tabs defaultValue="animation">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList>
              <TabsTrigger value="management">Direction/Gérance ({managementMembers.length})</TabsTrigger>
              <TabsTrigger value="animation">Pôle Animation ({poleAnimMembers.length})</TabsTrigger>
              <TabsTrigger value="mj">Pôle MJ ({poleMjMembers.length})</TabsTrigger>
              <TabsTrigger value="bdm">BDM ({bdmMembers.length})</TabsTrigger>
              <TabsTrigger value="former" className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Anciens membres {former.length > 0 && `(${former.length})`}
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 w-fit">
              {([
                ['role', 'Rôle'],
                ['quota', 'Quota rempli'],
                ['name', 'Nom'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortMode(mode)}
                  className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
                    sortMode === mode
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'
                      : 'text-white/45 hover:text-white/75'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <TabsContent value="management">
            <GlassCard className="overflow-hidden">
              <MemberTable members={managementMembers} onRemove={setRemovingMember} />
            </GlassCard>
          </TabsContent>

          <TabsContent value="animation">
            <GlassCard className="overflow-hidden">
              <MemberTable members={poleAnimMembers} onRemove={setRemovingMember} />
            </GlassCard>
          </TabsContent>

          <TabsContent value="mj">
            <GlassCard className="overflow-hidden">
              <MemberTable members={poleMjMembers} onRemove={setRemovingMember} />
            </GlassCard>
          </TabsContent>

          <TabsContent value="bdm">
            <GlassCard className="overflow-hidden">
              <MemberTable members={bdmMembers} onRemove={setRemovingMember} />
            </GlassCard>
          </TabsContent>

          <TabsContent value="former">
            <GlassCard className="overflow-hidden">
              {isLoadingFormer ? (
                <div className="p-4 space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (
                <FormerMembersTable entries={former} />
              )}
            </GlassCard>
          </TabsContent>
        </Tabs>
      )}

      {removingMember && (
        <RemoveConfirmModal
          member={removingMember}
          open={!!removingMember}
          onClose={() => setRemovingMember(null)}
        />
      )}
    </div>
  )
}
