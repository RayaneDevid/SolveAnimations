import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAnimations, useMemberDirectory } from '@/hooks/queries/useAnimations'
import type { AnimationStatus, Animation } from '@/types/database'
import { GlassCard } from '@/components/shared/GlassCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VillageBadge, VILLAGE_LABELS } from '@/components/shared/VillageBadge'
import { ServerBadge } from '@/components/shared/ServerBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatDuration, formatTime } from '@/lib/utils/format'
import { SERVERS, VILLAGES, type AnimationServer, type Village } from '@/lib/schemas/animation'

const TYPE_LABELS = { moyenne: 'M', grande: 'G' } as const
const TYPE_STYLES: Record<string, string> = {
  moyenne: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  grande: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
}

type TabValue = 'active' | 'proposed' | 'all' | 'finished' | 'rejected'

const ACTIVE_STATUSES: AnimationStatus[] = ['open', 'preparing', 'running']
const PAGE_SIZE = 24
const ALL_FILTER = 'all'

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
              <span>{anim.required_participants > 0 ? `${anim.required_participants} requis` : 'Aucun participant demandé'}</span>
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
  const [finishedTitle, setFinishedTitle] = useState('')
  const [finishedVillage, setFinishedVillage] = useState(ALL_FILTER)
  const [finishedServer, setFinishedServer] = useState(ALL_FILTER)
  const [finishedMemberId, setFinishedMemberId] = useState(ALL_FILTER)
  const asParticipant = searchParams.get('as_participant') === '1'
  const creatorId = searchParams.get('creator_id') ?? undefined
  const { data: members = [] } = useMemberDirectory(activeTab === 'finished')

  useEffect(() => {
    setPage(1)
  }, [asParticipant, creatorId, finishedTitle, finishedVillage, finishedServer, finishedMemberId])

  const finishedTitleSearch = finishedTitle.trim()
  const hasFinishedFilters = finishedTitleSearch.length > 0 ||
    finishedVillage !== ALL_FILTER ||
    finishedServer !== ALL_FILTER ||
    finishedMemberId !== ALL_FILTER

  const finishedFilters = useMemo(() => {
    if (activeTab !== 'finished') return {}
    return {
      ...(finishedTitleSearch ? { title: finishedTitleSearch } : {}),
      ...(finishedVillage !== ALL_FILTER ? { village: finishedVillage as Village } : {}),
      ...(finishedServer !== ALL_FILTER ? { server: finishedServer as AnimationServer } : {}),
      ...(finishedMemberId !== ALL_FILTER ? { member_id: finishedMemberId } : {}),
    }
  }, [activeTab, finishedMemberId, finishedServer, finishedTitleSearch, finishedVillage])

  const tabFilters =
    activeTab === 'all'      ? {} :
    activeTab === 'active'   ? { status: ACTIVE_STATUSES } :
    activeTab === 'proposed' ? { status: 'pending_validation' as AnimationStatus } :
                               { status: activeTab as AnimationStatus }

  const filters = {
    ...tabFilters,
    ...finishedFilters,
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

  const resetFinishedFilters = () => {
    setFinishedTitle('')
    setFinishedVillage(ALL_FILTER)
    setFinishedServer(ALL_FILTER)
    setFinishedMemberId(ALL_FILTER)
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

        {activeTab === 'finished' && (
          <GlassCard className="mt-4 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1.3fr_auto] xl:items-end">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Nom
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                  <Input
                    value={finishedTitle}
                    onChange={(event) => setFinishedTitle(event.target.value)}
                    placeholder="Nom de l'animation"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Village
                </label>
                <Select value={finishedVillage} onValueChange={setFinishedVillage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Village" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>Tous les villages</SelectItem>
                    {VILLAGES.map((village) => (
                      <SelectItem key={village} value={village}>
                        {VILLAGE_LABELS[village]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Serveur
                </label>
                <Select value={finishedServer} onValueChange={setFinishedServer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Serveur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>Tous les serveurs</SelectItem>
                    {SERVERS.map((server) => (
                      <SelectItem key={server} value={server}>{server}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Créateur / participant
                </label>
                <Select value={finishedMemberId} onValueChange={setFinishedMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Membre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>Tous les membres</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={resetFinishedFilters}
                disabled={!hasFinishedFilters}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Réinitialiser
              </Button>
            </div>
          </GlassCard>
        )}

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
