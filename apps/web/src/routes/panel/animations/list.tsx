import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAnimations } from '@/hooks/queries/useAnimations'
import type { AnimationStatus, Animation } from '@/types/database'
import { GlassCard } from '@/components/shared/GlassCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VillageBadge } from '@/components/shared/VillageBadge'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatDuration, formatTime } from '@/lib/utils/format'

const TYPE_LABELS = { petite: 'P', moyenne: 'M', grande: 'G' } as const
const TYPE_STYLES: Record<string, string> = {
  petite: 'bg-white/[0.07] text-white/60 border-white/10',
  moyenne: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  grande: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
}

type TabValue = 'active' | 'proposed' | 'all' | 'finished' | 'rejected'

const ACTIVE_STATUSES: AnimationStatus[] = ['open', 'preparing', 'running']
const PAGE_SIZE = 24

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: 'active',   label: 'Ouvertes & en cours' },
  { value: 'proposed', label: 'Proposées' },
  { value: 'finished', label: 'Terminées' },
  { value: 'rejected', label: 'Refusées' },
  { value: 'all',      label: 'Toutes' },
]

function AnimationCard({ anim }: { anim: Animation }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link to={`/panel/animations/${anim.id}`}>
        <GlassCard className="p-4 glass-hover cursor-pointer">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white/90 truncate hover:text-cyan-400 transition-colors">
                {anim.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {anim.creator && (
                  <div className="flex items-center gap-1.5">
                    <UserAvatar
                      avatarUrl={anim.creator.avatar_url}
                      username={anim.creator.username}
                      size="xs"
                    />
                    <span className="text-xs text-white/40">{anim.creator.username}</span>
                  </div>
                )}
              </div>
            </div>
            <StatusBadge status={anim.status} />
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-3">
            <ServerBadge server={anim.server} />
            <VillageBadge village={anim.village} />
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${TYPE_STYLES[anim.type]}`}
            >
              {TYPE_LABELS[anim.type]}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-white/40">
            <span>{formatDate(anim.scheduled_at, 'EEEE dd/MM/yyyy')} à {formatTime(anim.scheduled_at)}</span>
            <span>{formatDuration(anim.planned_duration_min)}</span>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-white/40 mb-1">
              <span>Participants</span>
              <span>{anim.required_participants > 0 ? `${anim.required_participants} requis` : 'Ouvert à tous'}</span>
            </div>
          </div>
        </GlassCard>
      </Link>
    </motion.div>
  )
}

export default function AnimationsList() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabValue>('active')
  const [page, setPage] = useState(1)
  const asParticipant = searchParams.get('as_participant') === '1'
  const creatorId = searchParams.get('creator_id') ?? undefined

  useEffect(() => {
    setPage(1)
  }, [asParticipant, creatorId])

  const tabFilters =
    activeTab === 'all'      ? {} :
    activeTab === 'active'   ? { status: ACTIVE_STATUSES } :
    activeTab === 'proposed' ? { status: 'pending_validation' as AnimationStatus } :
                               { status: activeTab as AnimationStatus }

  const filters = {
    ...tabFilters,
    ...(asParticipant ? { as_participant: true } : {}),
    ...(creatorId ? { creator_id: creatorId } : {}),
    page,
    pageSize: PAGE_SIZE,
  }

  const { data, isLoading } = useAnimations(filters)

  const animations = data?.animations ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? Math.ceil(total / PAGE_SIZE)
  const safeTotalPages = Math.max(1, totalPages)
  const fromItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const toItem = Math.min(page * PAGE_SIZE, total)

  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue)
    setPage(1)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Animations</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {asParticipant ? 'Mes inscriptions' : creatorId ? 'Animations du membre' : `${total} animation${total > 1 ? 's' : ''}`}
          </p>
        </div>
        <Link to="/panel/animations/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Créer
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-44" />
                ))}
              </div>
            ) : animations.length === 0 ? (
              <GlassCard className="p-12 text-center">
                <p className="text-white/30 text-sm">Aucune animation</p>
              </GlassCard>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {animations.map((anim) => (
                    <AnimationCard key={anim.id} anim={anim} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-white/35">
                      {fromItem}-{toItem} sur {total}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || isLoading}
                        className="gap-1.5"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Précédent
                      </Button>
                      <span className="min-w-20 text-center text-xs text-white/45">
                        Page {page} / {safeTotalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(safeTotalPages, p + 1))}
                        disabled={page >= safeTotalPages || isLoading}
                        className="gap-1.5"
                      >
                        Suivant
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
