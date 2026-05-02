import { useState, useEffect } from 'react'
import { Plus, X, UserPlus, ChevronDown, Check, Trash2, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useRecrutements, useSeniors } from '@/hooks/queries/useAnimations'
import { useRequiredAuth } from '@/hooks/useAuth'
import { useCreateRecrutement, type RecrutementInput } from '@/hooks/mutations/useAnimationMutations'
import { GlassCard } from '@/components/shared/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { cn } from '@/lib/utils/cn'
import { isMjStaffRole } from '@/lib/config/discord'
import type { RecrutementSession, SeniorProfile } from '@/types/database'

// ─── Multi-select seniors ─────────────────────────────────────────────────────

function SeniorsMultiSelect({
  seniors,
  selected,
  onChange,
}: {
  seniors: SeniorProfile[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  const selectedProfiles = seniors.filter((s) => selected.includes(s.id))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.10] text-sm text-white/70 hover:border-white/20 transition-colors"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedProfiles.length === 0 ? (
            <span className="text-white/30">Sélectionner des recruteurs...</span>
          ) : (
            selectedProfiles.map((s) => (
              <span key={s.id} className="flex items-center gap-1 bg-white/[0.08] rounded-full px-2 py-0.5 text-xs text-white/80">
                <UserAvatar avatarUrl={s.avatar_url} username={s.username} size="xs" />
                {s.username}
              </span>
            ))
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 top-full mt-1 w-full bg-[#13141A] border border-white/[0.10] rounded-xl shadow-2xl overflow-hidden"
          >
            {seniors.map((s) => {
              const checked = selected.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.05] transition-colors"
                >
                  <div className={cn('h-4 w-4 rounded border flex items-center justify-center shrink-0', checked ? 'bg-cyan-400 border-cyan-400' : 'border-white/20')}>
                    {checked && <Check className="h-3 w-3 text-black" />}
                  </div>
                  <UserAvatar avatarUrl={s.avatar_url} username={s.username} size="xs" />
                  <span className="text-sm text-white/80">{s.username}</span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Recruit row ──────────────────────────────────────────────────────────────

function RecruitRow({
  index,
  values,
  onChange,
  onRemove,
  showRemove,
}: {
  index: number
  values: { steam_id: string; name: string }
  onChange: (v: { steam_id: string; name: string }) => void
  onRemove: () => void
  showRemove: boolean
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <Label className="text-xs text-white/50">Nom — Personne {index + 1}</Label>
        <Input
          placeholder="Pseudo in-game"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
        />
      </div>
      <div className="flex-1 space-y-1">
        <Label className="text-xs text-white/50">Steam ID 64</Label>
        <Input
          placeholder="7656119..."
          value={values.steam_id}
          onChange={(e) => onChange({ ...values, steam_id: e.target.value })}
        />
      </div>
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="mb-0.5 h-10 w-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── Create form ──────────────────────────────────────────────────────────────

const POLE_ROLES: Record<'mj' | 'animation', string[]> = {
  mj: ['mj_senior', 'responsable_mj', 'gerance', 'direction'],
  animation: ['senior', 'responsable', 'gerance', 'direction'],
}

function CreateRecrutementForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useRequiredAuth()
  const { data: seniors = [] } = useSeniors()
  const { mutateAsync, isPending } = useCreateRecrutement()

  const [type, setType] = useState<'ecrit' | 'oral'>('ecrit')
  const [pole, setPole] = useState<'mj' | 'animation'>(() => user.pay_pole === 'mj' || isMjStaffRole(user.role) ? 'mj' : 'animation')
  const [recruiterIds, setRecruiterIds] = useState<string[]>([])
  const [count, setCount] = useState(1)
  const [recruits, setRecruits] = useState<{ steam_id: string; name: string }[]>([{ steam_id: '', name: '' }])

  const filteredSeniors = seniors.filter((s) => POLE_ROLES[pole].includes(s.role))

  useEffect(() => {
    setRecruits((prev) => {
      const next = [...prev]
      while (next.length < count) next.push({ steam_id: '', name: '' })
      return next.slice(0, count)
    })
  }, [count])

  const updateRecruit = (i: number, v: { steam_id: string; name: string }) => {
    setRecruits((prev) => prev.map((r, idx) => (idx === i ? v : r)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (recruiterIds.length === 0) { toast.error('Sélectionne au moins un recruteur'); return }
    if (recruits.some((r) => !r.steam_id.trim() || !r.name.trim())) {
      toast.error('Remplis tous les champs des recrues'); return
    }
    try {
      await mutateAsync({ type, pole, recruiter_ids: recruiterIds, recruits } as RecrutementInput)
      toast.success('Recrutement enregistré !')
      onSuccess()
    } catch {
      toast.error('Erreur lors de la création')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type */}
      <div className="space-y-2">
        <Label>Type de recrutement</Label>
        <div className="flex gap-2">
          {(['ecrit', 'oral'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'flex-1 h-10 rounded-lg text-sm font-medium border transition-colors capitalize',
                type === t
                  ? 'bg-cyan-400/10 border-cyan-400/40 text-cyan-400'
                  : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/70',
              )}
            >
              {t === 'ecrit' ? 'Écrit' : 'Oral'}
            </button>
          ))}
        </div>
      </div>

      {/* Pôle */}
      <div className="space-y-2">
        <Label>Pôle</Label>
        <div className="flex gap-2">
          {([['animation', 'Animation'], ['mj', 'MJ']] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => { setPole(v); setRecruiterIds([]) }}
              className={cn(
                'flex-1 h-10 rounded-lg text-sm font-medium border transition-colors',
                pole === v
                  ? 'bg-cyan-400/10 border-cyan-400/40 text-cyan-400'
                  : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/70',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recruteurs */}
      <div className="space-y-2">
        <Label>Recruteurs</Label>
        <SeniorsMultiSelect seniors={filteredSeniors} selected={recruiterIds} onChange={setRecruiterIds} />
      </div>

      {/* Nombre */}
      <div className="space-y-2">
        <Label>Nombre de personnes recrutées</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value))))}
          className="w-28"
        />
      </div>

      {/* Recruits */}
      <div className="space-y-3">
        <Label>Recrues</Label>
        {recruits.map((r, i) => (
          <RecruitRow
            key={i}
            index={i}
            values={r}
            onChange={(v) => updateRecruit(i, v)}
            onRemove={() => { setCount((c) => c - 1) }}
            showRemove={recruits.length > 1}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Enregistrement...' : 'Enregistrer le recrutement'}
        </Button>
      </div>
    </form>
  )
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: RecrutementSession }) {
  const [open, setOpen] = useState(false)

  const recruiterNames = session.recruiters
    .map((r) => r.profile?.username)
    .filter(Boolean)
    .join(', ')

  return (
    <GlassCard className="p-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
            session.type === 'ecrit' ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400' : 'bg-orange-500/10 border border-orange-500/20 text-orange-400',
          )}>
            {session.type === 'ecrit' ? 'É' : 'O'}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white/80">
              {session.pole === 'animation' ? 'Animation' : 'MJ'} · {session.type === 'ecrit' ? 'Écrit' : 'Oral'}
              <span className="ml-2 text-white/30 text-xs font-normal">
                {session.recruits.length} recrue{session.recruits.length > 1 ? 's' : ''}
              </span>
            </p>
            <p className="text-xs text-white/30 mt-0.5">
              {format(new Date(session.created_at), 'd MMM yyyy', { locale: fr })} · par {recruiterNames}
            </p>
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-white/30 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
              {session.recruits.map((recruit) => (
                <div key={recruit.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.03]">
                  <div>
                    <p className="text-sm text-white/80">{recruit.name}</p>
                    <p className="text-xs text-white/30 font-mono">{recruit.steam_id}</p>
                  </div>
                  {recruit.profile ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar avatarUrl={recruit.profile.avatar_url} username={recruit.profile.username} size="xs" />
                      <span className="text-xs text-emerald-400">{recruit.profile.username}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-white/25">Non lié</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Recrutement() {
  const [showForm, setShowForm] = useState(false)
  const { data: sessions, isLoading } = useRecrutements()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recrutement</h1>
          <p className="text-sm text-white/40 mt-0.5">Enregistre les sessions de recrutement</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Fermer' : 'Nouveau recrutement'}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <UserPlus className="h-5 w-5 text-cyan-400" />
                <h2 className="text-base font-semibold text-white">Nouveau recrutement</h2>
              </div>
              <CreateRecrutementForm onSuccess={() => setShowForm(false)} />
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-4 w-4 text-white/30" />
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">
            Historique ({sessions?.length ?? 0})
          </h2>
        </div>

        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)
        ) : sessions?.length === 0 ? (
          <GlassCard className="p-10 text-center">
            <UserPlus className="h-8 w-8 text-white/15 mx-auto mb-3" />
            <p className="text-white/30 text-sm">Aucun recrutement enregistré</p>
          </GlassCard>
        ) : (
          sessions?.map((s) => <SessionCard key={s.id} session={s} />)
        )}
      </div>
    </div>
  )
}
