import { useState, useEffect } from 'react'
import { User, Save } from 'lucide-react'
import { GenderIcon } from '@/components/shared/GenderIcon'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useRequiredAuth } from '@/hooks/useAuth'
import { useUpdateProfile } from '@/hooks/mutations/useAnimationMutations'
import { GlassCard } from '@/components/shared/GlassCard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getRoleLabel, type StaffRoleKey } from '@/lib/config/discord'

type PreferredRole = 'homme' | 'femme' | 'autre'

export default function ProfilePage() {
  const { user, role } = useRequiredAuth()
  const { mutateAsync, isPending } = useUpdateProfile()

  const [steamId, setSteamId] = useState(user.steam_id ?? '')
  const [arrivalDate, setArrivalDate] = useState(user.arrival_date ?? '')
  const [gender, setGender] = useState<PreferredRole | null>(user.gender ?? null)
  const [primaryRole, setPrimaryRole] = useState<StaffRoleKey>(role)
  const availableRoles = (user.available_roles?.length ? user.available_roles : [role]) as StaffRoleKey[]

  useEffect(() => {
    setSteamId(user.steam_id ?? '')
    setArrivalDate(user.arrival_date ?? '')
    setGender(user.gender ?? null)
    setPrimaryRole(role)
  }, [user.steam_id, user.arrival_date, user.gender, role])

  const handleSave = async () => {
    try {
      await mutateAsync({
        steam_id: steamId.trim() || null,
        arrival_date: arrivalDate || null,
        gender: gender ?? null,
        primary_role: primaryRole,
      })
      toast.success('Profil mis à jour')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <User className="h-6 w-6 text-cyan-400" />
          Mon profil
        </h1>
        <p className="text-sm text-white/40 mt-0.5">Informations personnelles complémentaires</p>
      </motion.div>

      {/* Discord info (readonly) */}
      <GlassCard className="p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
          Compte Discord
        </p>
        <div className="flex items-center gap-4">
          <UserAvatar avatarUrl={user.avatar_url} username={user.username} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-white">{user.username}</p>
              <GenderIcon gender={user.gender} className="text-sm" />
            </div>
            <div className="mt-1">
              <RoleBadge role={role} gender={user.gender} size="md" />
            </div>
            <p className="text-xs text-white/30 mt-2">ID Discord : {user.discord_id}</p>
          </div>
        </div>
      </GlassCard>

      {/* Editable fields */}
      <GlassCard className="p-6 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
          Informations complémentaires
        </p>

        <div className="space-y-2">
          <Label className="text-white/70">Rôle préférenciel</Label>
          <div className="flex gap-2">
            {([
              ['homme', '♂ Masculin'],
              ['femme', '♀ Féminin'],
              ['autre', 'Autre'],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setGender(gender === v ? null : v)}
                className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-colors ${
                  gender === v
                    ? v === 'homme'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : v === 'femme'
                        ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                        : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                    : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {availableRoles.length > 1 && (
          <div className="space-y-2">
            <Label className="text-white/70">Rôle principal sur le panel</Label>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((availableRole) => (
                <button
                  key={availableRole}
                  type="button"
                  onClick={() => setPrimaryRole(availableRole)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    primaryRole === availableRole
                      ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-200'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/45 hover:text-white/75'
                  }`}
                >
                  {getRoleLabel(availableRole, gender)}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/30">
              Ce rôle sert aux quotas, classements, permissions et affichages du panel.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-white/70">Steam ID 64</Label>
          <Input
            value={steamId}
            onChange={(e) => setSteamId(e.target.value)}
            placeholder="76561198XXXXXXXXX"
            maxLength={17}
            className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-cyan-500/50 font-mono"
          />
          <p className="text-xs text-white/30">17 chiffres — trouvable sur{' '}
            <a href="https://steamid.io" target="_blank" rel="noopener noreferrer" className="text-cyan-400/70 hover:text-cyan-400 underline transition-colors">steamid.io</a>
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">Date d'arrivée dans le staff</Label>
          <Input
            type="date"
            value={arrivalDate}
            onChange={(e) => setArrivalDate(e.target.value)}
            className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-cyan-500/50"
          />
        </div>

        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 gap-2"
          >
            <Save className="h-4 w-4" />
            {isPending ? 'Sauvegarde…' : 'Sauvegarder'}
          </Button>
        </div>
      </GlassCard>
    </div>
  )
}
