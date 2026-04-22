import { useState } from 'react'
import { Users, UserX, CalendarOff, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useMembers } from '@/hooks/queries/useAnimations'
import { useRemoveMemberAccess } from '@/hooks/mutations/useAnimationMutations'
import { GlassCard } from '@/components/shared/GlassCard'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { MemberEntry } from '@/types/database'

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

  const handleConfirm = async () => {
    try {
      await mutateAsync(member.id)
      toast.success(`Accès de ${member.username} révoqué`)
      onClose()
    } catch {
      toast.error('Erreur lors de la révocation')
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
          <p className="text-sm text-white/60">
            Cette action va retirer les rôles Discord de ce membre et supprimer son profil.
            L'action est <span className="text-red-400 font-medium">irréversible</span>.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending ? 'Révocation...' : 'Confirmer le retrait'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Members() {
  const { data: members = [], isLoading } = useMembers()
  const [removingMember, setRemovingMember] = useState<MemberEntry | null>(null)

  const stats = {
    total: members.length,
    responsable: members.filter((m) => m.role === 'responsable' || m.role === 'responsable_mj').length,
    senior: members.filter((m) => m.role === 'senior').length,
    animateur: members.filter((m) => m.role === 'animateur').length,
    mj: members.filter((m) => m.role === 'mj').length,
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

      {/* Stats row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Responsables', value: stats.responsable, color: 'text-amber-400' },
          { label: 'Seniors', value: stats.senior, color: 'text-violet-400' },
          { label: 'Animateurs', value: stats.animateur, color: 'text-blue-400' },
          { label: 'MJ', value: stats.mj, color: 'text-red-400' },
          { label: 'Absents', value: stats.absent, color: 'text-orange-400' },
        ].map(({ label, value, color }) => (
          <GlassCard key={label} className="p-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-white/40 mt-0.5">{label}</p>
          </GlassCard>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : (
        <GlassCard className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Membre', 'Rôle', 'Anim. (sem/tot)', 'Heures (sem/tot)', 'Quota', 'Absence', ''].map((h) => (
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
                        <UserAvatar
                          avatarUrl={m.avatarUrl}
                          username={m.username}
                          size="sm"
                        />
                        <span className="text-sm font-medium text-white/90">{m.username}</span>
                        {m.isAbsent && (
                          <CalendarOff className="h-3.5 w-3.5 text-orange-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={m.role as never} />
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">
                      <span className="text-white/90 font-medium">{m.weeklyStats.animationsCreated}</span>
                      <span className="text-white/30"> / {m.totalStats.animationsCreated}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">
                      <span className="text-white/90 font-medium">
                        {(m.weeklyStats.hoursAnimated / 60).toFixed(1)}h
                      </span>
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
                        <span className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
                          Absent
                        </span>
                      ) : (
                        <span className="text-xs text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setRemovingMember(m)}
                        className="text-xs gap-1.5 h-7"
                      >
                        <UserX className="h-3 w-3" />
                        Retirer
                      </Button>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
          {members.length === 0 && (
            <p className="text-center text-white/30 text-sm py-12">Aucun membre</p>
          )}
        </GlassCard>
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
