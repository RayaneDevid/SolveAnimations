import { useState } from 'react'
import { Users, UserX, CalendarOff, AlertTriangle, History } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMembers, useFormerMembers } from '@/hooks/queries/useAnimations'
import { useRemoveMemberAccess } from '@/hooks/mutations/useAnimationMutations'
import { GlassCard } from '@/components/shared/GlassCard'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { MemberEntry } from '@/types/database'
import type { FormerMemberEntry } from '@/hooks/queries/useAnimations'

const ANIM_ROLE_ORDER = ['responsable', 'senior', 'animateur']
const MJ_ROLE_ORDER   = ['responsable_mj', 'mj_senior', 'mj']

function sortByRole(members: MemberEntry[], order: string[]): MemberEntry[] {
  return [...members].sort((a, b) => {
    const ia = order.indexOf(a.role)
    const ib = order.indexOf(b.role)
    if (ia !== ib) return ia - ib
    return a.username.localeCompare(b.username)
  })
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
              <p className="text-sm font-medium text-white/90">{member.username}</p>
              <RoleBadge role={member.role as never} />
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
          {['Membre', 'Rôle', 'Anim. (sem/tot)', 'Heures (sem/tot)', 'Quota', 'Absence', ''].map((h) => (
            <th key={h} className="text-left text-xs font-semibold text-white/40 uppercase tracking-wider px-4 py-3">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {members.map((m, i) => {
          const quotaMax = m.weeklyStats.quotaMax
          const quota = m.weeklyStats.animationsCreated
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
                  <span className="text-sm font-medium text-white/90">{m.username}</span>
                  {m.isAbsent && <CalendarOff className="h-3.5 w-3.5 text-orange-400" />}
                </div>
              </td>
              <td className="px-4 py-3"><RoleBadge role={m.role as never} /></td>
              <td className="px-4 py-3 text-sm text-white/60">
                <span className="text-white/90 font-medium">{m.weeklyStats.animationsCreated}</span>
                <span className="text-white/30"> / {m.totalStats.animationsCreated}</span>
              </td>
              <td className="px-4 py-3 text-sm text-white/60">
                <span className="text-white/90 font-medium">{(m.weeklyStats.hoursAnimated / 60).toFixed(1)}h</span>
                <span className="text-white/30"> / {(m.totalStats.hoursAnimated / 60).toFixed(1)}h</span>
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
                  <span className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">Absent</span>
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

function FormerMembersTable({ entries }: { entries: FormerMemberEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-center text-white/30 text-sm py-12">Aucun ancien membre</p>
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-white/[0.06]">
          {['Membre', 'Ancien rôle', 'Raison', 'Retiré par', 'Date', 'Total anim.'].map((h) => (
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
              <span className="text-sm text-white/60 italic">
                {m.deactivationReason ?? '—'}
              </span>
            </td>
            <td className="px-4 py-3 text-sm text-white/40">
              {m.deactivatedByUsername ?? '—'}
            </td>
            <td className="px-4 py-3 text-sm text-white/40 whitespace-nowrap">
              {m.deactivatedAt
                ? formatDistanceToNow(new Date(m.deactivatedAt), { addSuffix: true, locale: fr })
                : '—'}
            </td>
            <td className="px-4 py-3 text-sm text-white/50">
              {m.totalAnimationsCreated} anim · {(m.totalHoursAnimated / 60).toFixed(1)}h
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

  const poleAnimMembers = sortByRole(members.filter((m) => ANIM_ROLE_ORDER.includes(m.role)), ANIM_ROLE_ORDER)
  const poleMjMembers   = sortByRole(members.filter((m) => MJ_ROLE_ORDER.includes(m.role)),   MJ_ROLE_ORDER)

  const stats = {
    total: members.length,
    poleAnim: poleAnimMembers.length,
    poleMj: poleMjMembers.length,
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total actifs', value: stats.total, color: 'text-white' },
          { label: 'Pôle Animation', value: stats.poleAnim, color: 'text-violet-400' },
          { label: 'Pôle MJ', value: stats.poleMj, color: 'text-red-400' },
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
          <TabsList>
            <TabsTrigger value="animation">Pôle Animation ({poleAnimMembers.length})</TabsTrigger>
            <TabsTrigger value="mj">Pôle MJ ({poleMjMembers.length})</TabsTrigger>
            <TabsTrigger value="former" className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Anciens membres {former.length > 0 && `(${former.length})`}
            </TabsTrigger>
          </TabsList>

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
