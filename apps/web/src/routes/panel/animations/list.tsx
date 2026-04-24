import { useState } from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
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
import { formatDateTime, formatDuration } from '@/lib/utils/format'

const TYPE_LABELS = { petite: 'P', moyenne: 'M', grande: 'G' } as const
const TYPE_STYLES: Record<string, string> = {
  petite: 'bg-white/[0.07] text-white/60 border-white/10',
  moyenne: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  grande: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
}

type TabValue = 'active' | 'all' | 'finished' | 'rejected'

const ACTIVE_STATUSES: AnimationStatus[] = ['open', 'preparing', 'running']

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: 'active', label: 'Ouvertes & en cours' },
  { value: 'all', label: 'Toutes' },
  { value: 'finished', label: 'Terminées' },
  { value: 'rejected', label: 'Refusées' },
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
            <span>{formatDateTime(anim.scheduled_at)}</span>
            <span>{formatDuration(anim.planned_duration_min)}</span>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-white/40 mb-1">
              <span>Participants</span>
              <span>{anim.required_participants} requis</span>
            </div>
          </div>
        </GlassCard>
      </Link>
    </motion.div>
  )
}

export default function AnimationsList() {
  const [activeTab, setActiveTab] = useState<TabValue>('active')

  const filters =
    activeTab === 'all'
      ? {}
      : activeTab === 'active'
        ? { status: ACTIVE_STATUSES }
        : { status: activeTab as AnimationStatus }

  const { data, isLoading } = useAnimations(filters)

  const animations = data?.animations ?? []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Animations</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {data?.total ?? 0} animation{(data?.total ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/panel/animations/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Créer
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {animations.map((anim) => (
                  <AnimationCard key={anim.id} anim={anim} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
