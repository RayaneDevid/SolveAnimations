# CLAUDE.md — Solve Animations

Panel web destiné aux animateurs et maîtres du jeu de la Solve Community (Garry's Mod NarutoRP) pour créer, valider, suivre et archiver les animations in-game, avec gestion des quotas hebdomadaires, absences, rapports, calendrier RP, et diffusion Discord automatisée.

---

## 1. Vue d'ensemble

Trois composants :

1. **`solve-animations-web`** — SPA React 19 + Vite
2. **Supabase Cloud** — PostgreSQL + Auth + Edge Functions + Realtime
3. **`solve-animations-bot`** — Bot Discord TypeScript (discord.js v14), service HTTP séparé

Flux principaux :

```
Utilisateur (navigateur)
       │
       ▼
React SPA ─────► Supabase Auth (OAuth Discord, PKCE)
       │
       ├────────► Supabase Edge Functions ──► PostgreSQL
       │                                          ▲
       │                                          │
       └────────► Supabase Realtime ──────────────┘
                         │
                         └── Bot Discord (via webhook HTTP depuis Edge Functions)
                                  │
                                  ▼
                             Discord API
```

**Important** : il n'y a **aucun serveur applicatif custom** côté frontend. La SPA est servie en statique. Toute la logique métier vit dans les Edge Functions Supabase.

---

## 2. Stack technique

### Web (`solve-animations-web`)

- **Framework** : React 19 + Vite 6
- **Langage** : TypeScript strict
- **Routing** : React Router v7 (en mode "declarative", pas framework)
- **Styling** : Tailwind CSS + shadcn/ui, thème glassmorphism dark
- **État serveur** : TanStack Query v5 (toutes les I/O passent par là)
- **État client global** : Zustand (uniquement pour l'UI globale : sidebar collapsed, toasts custom, etc.)
- **État local** : `useState` / `useReducer`
- **Forms** : React Hook Form + Zod resolver
- **Validation** : Zod — schémas partagés avec les Edge Functions
- **Client Supabase** : `@supabase/supabase-js` (anon key uniquement)
- **Dates** : `date-fns` + `date-fns-tz` (locale `fr`, timezone Europe/Paris)
- **Graphs** : Recharts
- **Calendrier** : implémentation custom avec `date-fns` (voir §8 — la logique "journée RP" ne s'adapte pas à un composant existant)
- **Build** : Vite, sortie statique dans `dist/`

### Backend (Supabase Cloud)

- **PostgreSQL 15+**
- **Supabase Auth** avec provider Discord OAuth (PKCE flow)
- **Edge Functions** : Deno runtime, TypeScript
- **Realtime** : activé sur `animations` et `animation_participants`

### Bot (`solve-animations-bot`)

- **Runtime** : Node.js 20+
- **Libs** : `discord.js` v14, `fastify`, `zod`, `@supabase/supabase-js` (service role si lecture DB nécessaire)
- **Process** : `pm2` sur VPS OVH

---

## 3. Règles d'or (non négociables)

1. **Zéro requête DB directe depuis le frontend.** Toutes les écritures et lectures métier passent par des Edge Functions. Le client Supabase côté frontend sert uniquement à :
   - l'authentification (`signInWithOAuth`, `getSession`, `signOut`)
   - les subscriptions Realtime (lecture seule, strictement pour invalider les queries TanStack)
   - l'appel aux Edge Functions via `supabase.functions.invoke()`
2. **La service role key n'existe jamais côté frontend.** Elle vit exclusivement dans les secrets des Edge Functions et du bot. Le frontend n'utilise que l'anon key.
3. **RLS activée partout** en defense-in-depth.
4. **Tous les inputs sont validés par Zod** avant d'atteindre la DB. Les schémas sont partagés entre le frontend (`src/lib/schemas/`) et les Edge Functions (via duplication ou package workspace `@solve/schemas`).
5. **Toute mutation TanStack Query invalide les clés liées.** Au minimum : `['animations']`, `['animation', id]`, `['stats', 'weekly']`, `['reports', 'mine']`, `['members']`, `['absences']`, `['calendar', weekStart]` selon la mutation.
6. **Les rôles Discord sont la source de vérité.** Revalidés à chaque login et toutes les 24h via un effect dans le layout principal.
7. **Aucun ID Discord hardcodé** en dehors de `src/lib/config/discord.ts`.
8. **Les Edge Functions partagent des helpers** dans `supabase/functions/_shared/` : `cors.ts`, `jsonResponse.ts`, `errorResponse.ts`, `supabaseClient.ts`, `auth.ts`, `guards.ts`, `week.ts`, `bot.ts`, `discord.ts`.
9. **Toute action sensible est auditée** dans `audit_log`.
10. **La SPA doit fonctionner sans refresh** — toutes les transitions de route sont client-side, aucune redirection `window.location`.

---

## 4. Structure du repo (monorepo pnpm)

```
solve-animations/
├── apps/
│   ├── web/                              # React SPA
│   │   ├── src/
│   │   │   ├── main.tsx                  # bootstrap : QueryClientProvider + Router + AuthProvider
│   │   │   ├── App.tsx                   # routes
│   │   │   ├── routes/
│   │   │   │   ├── index.tsx             # redirect → /dashboard ou /login
│   │   │   │   ├── login.tsx
│   │   │   │   ├── auth-callback.tsx     # gère le retour OAuth
│   │   │   │   └── panel/
│   │   │   │       ├── layout.tsx        # shell (sidebar + topbar), guard
│   │   │   │       ├── dashboard.tsx
│   │   │   │       ├── animations/
│   │   │   │       │   ├── list.tsx
│   │   │   │       │   ├── new.tsx
│   │   │   │       │   └── detail.tsx
│   │   │   │       ├── calendar.tsx
│   │   │   │       ├── reports.tsx
│   │   │   │       ├── absences.tsx
│   │   │   │       ├── validation.tsx    # responsable
│   │   │   │       ├── leaderboard.tsx   # responsable
│   │   │   │       ├── members.tsx       # responsable
│   │   │   │       └── villages.tsx      # responsable
│   │   │   ├── components/
│   │   │   │   ├── ui/                   # shadcn
│   │   │   │   ├── animations/
│   │   │   │   ├── reports/
│   │   │   │   ├── absences/
│   │   │   │   ├── calendar/             # WeekGrid, DayColumn, AnimationBlock
│   │   │   │   ├── charts/
│   │   │   │   ├── layout/               # Sidebar, Topbar, WeekIndicator
│   │   │   │   ├── auth/                 # ProtectedRoute, RoleGate
│   │   │   │   └── shared/               # GlassCard, RoleBadge, ServerBadge, VillageBadge
│   │   │   ├── hooks/
│   │   │   │   ├── queries/              # useAnimations, useAnimation, useWeeklyStats, ...
│   │   │   │   ├── mutations/            # useCreateAnimation, useStartAnimation, ...
│   │   │   │   ├── useAuth.ts            # session + role + revalidation
│   │   │   │   ├── useCurrentWeek.ts     # bornes Sat 4am → Sat 4am
│   │   │   │   └── useRealtimeAnimation.ts
│   │   │   ├── lib/
│   │   │   │   ├── supabase/
│   │   │   │   │   ├── client.ts         # createClient unique
│   │   │   │   │   └── edge.ts           # wrapper typé pour functions.invoke
│   │   │   │   ├── schemas/              # Zod
│   │   │   │   ├── config/
│   │   │   │   │   └── discord.ts        # rôles, guild
│   │   │   │   ├── auth/
│   │   │   │   │   └── guards.ts         # helpers côté React (hasRole, requireRole)
│   │   │   │   ├── query/
│   │   │   │   │   ├── client.ts         # QueryClient configuré
│   │   │   │   │   └── keys.ts           # factory de query keys centralisée
│   │   │   │   └── utils/
│   │   │   │       ├── week.ts           # getCurrentWeekBounds, rpDayFromDate
│   │   │   │       ├── calendar.ts       # logique journée RP (18h → 03h/04h)
│   │   │   │       └── format.ts
│   │   │   ├── stores/                   # Zustand
│   │   │   │   └── ui-store.ts
│   │   │   ├── types/                    # types DB générés par `supabase gen types`
│   │   │   ├── index.css                 # Tailwind
│   │   │   └── vite-env.d.ts
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── bot/
│       ├── src/
│       │   ├── index.ts
│       │   ├── discord/
│       │   │   ├── client.ts
│       │   │   ├── embeds/
│       │   │   └── actions/              # removeStaffRoles, sendDM
│       │   ├── http/
│       │   │   ├── server.ts
│       │   │   ├── auth.ts               # X-Bot-Secret
│       │   │   └── routes/
│       │   │       ├── animation-created.ts
│       │   │       ├── animation-validated.ts
│       │   │       ├── animation-rejected.ts
│       │   │       ├── animation-updated.ts
│       │   │       ├── animation-started.ts
│       │   │       ├── animation-finished.ts
│       │   │       ├── animation-postponed.ts
│       │   │       └── member-role-removed.ts
│       │   └── config/env.ts
│       └── package.json
├── packages/
│   └── schemas/                          # Zod schémas partagés web + bot (optionnel)
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── *.sql
│   ├── seed.sql
│   └── functions/
│       ├── _shared/
│       │   ├── cors.ts
│       │   ├── jsonResponse.ts
│       │   ├── errorResponse.ts
│       │   ├── supabaseClient.ts
│       │   ├── auth.ts
│       │   ├── guards.ts
│       │   ├── week.ts
│       │   ├── bot.ts
│       │   └── discord.ts
│       ├── auth-validate-staff/
│       ├── animations-create/
│       ├── animations-update/
│       ├── animations-list/
│       ├── animations-get/
│       ├── animations-validate/
│       ├── animations-reject/
│       ├── animations-start/
│       ├── animations-stop/
│       ├── animations-postpone/
│       ├── animations-cancel/
│       ├── participants-apply/
│       ├── participants-decide/
│       ├── participants-update-character/
│       ├── participants-remove-validated/
│       ├── participants-promote-pending/
│       ├── reports-list-mine/
│       ├── reports-submit/
│       ├── absences-list/
│       ├── absences-create/
│       ├── absences-delete/
│       ├── stats-weekly/
│       ├── stats-villages/
│       ├── leaderboard/
│       ├── members-list/
│       └── members-remove-access/
├── pnpm-workspace.yaml
├── package.json
└── CLAUDE.md
```

---

## 5. Schéma de base de données

PostgreSQL. Identique à la version précédente — l'architecture DB ne dépend pas du choix du framework frontend.

### Enums

```sql
create type staff_role as enum ('responsable', 'senior', 'animateur', 'mj');
create type animation_status as enum (
  'pending_validation', 'open', 'running', 'finished',
  'rejected', 'cancelled', 'postponed'
);
create type animation_server as enum ('S1','S2','S3','S4','S5','SE1','SE2','SE3');
create type animation_type as enum ('petite','moyenne','grande');
create type village as enum ('konoha','suna','oto','kiri','temple_camelias','autre','tout_le_monde');
create type participant_status as enum ('pending','validated','rejected','removed');
```

### `profiles`

Lié à `auth.users.id`. Créé/mis à jour par `auth-validate-staff`.

| Colonne              | Type        | Notes                                        |
|----------------------|-------------|----------------------------------------------|
| `id`                 | uuid PK     | = auth.users.id                              |
| `discord_id`         | text UQ     |                                              |
| `username`           | text        |                                              |
| `avatar_url`         | text        |                                              |
| `role`               | staff_role  | rôle effectif (plus haut parmi ceux détenus) |
| `last_role_check_at` | timestamptz |                                              |
| `created_at`         | timestamptz |                                              |
| `last_login_at`      | timestamptz |                                              |

### `animations`

| Colonne                   | Type             | Notes                                  |
|---------------------------|------------------|----------------------------------------|
| `id`                      | uuid PK          |                                        |
| `title`                   | text             | 3 ≤ len ≤ 120                          |
| `scheduled_at`            | timestamptz      |                                        |
| `planned_duration_min`    | int              | ≥ 15                                   |
| `required_participants`   | int              | ≥ 1                                    |
| `server`                  | animation_server |                                        |
| `type`                    | animation_type   |                                        |
| `prep_time_min`           | int              | ≥ 0                                    |
| `village`                 | village          |                                        |
| `document_url`            | text             |                                        |
| `creator_id`              | uuid FK          | → profiles.id                          |
| `creator_character_name`  | text null        | perso joué par le créateur s'il joue   |
| `status`                  | animation_status | default `'pending_validation'`         |
| `validated_by`            | uuid FK null     |                                        |
| `validated_at`            | timestamptz null |                                        |
| `rejected_by`             | uuid FK null     |                                        |
| `rejected_at`             | timestamptz null |                                        |
| `rejection_reason`        | text null        |                                        |
| `started_at`              | timestamptz null |                                        |
| `ended_at`                | timestamptz null |                                        |
| `actual_duration_min`     | int null         |                                        |
| `discord_message_id`      | text null        |                                        |
| `postponed_from`          | timestamptz null |                                        |
| `postpone_count`          | int default 0    |                                        |
| `created_at`              | timestamptz      |                                        |
| `updated_at`              | timestamptz      | trigger `moddatetime`                  |

Index : `(status, scheduled_at)`, `(creator_id, status)`, `(scheduled_at)`, `(ended_at) where status = 'finished'`.

### `animation_participants`

| Colonne          | Type               | Notes                              |
|------------------|--------------------|------------------------------------|
| `id`             | uuid PK            |                                    |
| `animation_id`   | uuid FK            | ON DELETE CASCADE                  |
| `user_id`        | uuid FK            | → profiles.id                      |
| `character_name` | text               | obligatoire, éditable              |
| `status`         | participant_status | default `'pending'`                |
| `applied_at`     | timestamptz        |                                    |
| `decided_at`     | timestamptz null   |                                    |
| `decided_by`     | uuid FK null       |                                    |

Contrainte : `unique (animation_id, user_id)`.

### `animation_reports`

Un rapport par membre présent (créateur + validés) généré au `stop`.

| Colonne          | Type             | Notes                              |
|------------------|------------------|------------------------------------|
| `id`             | uuid PK          |                                    |
| `animation_id`   | uuid FK          |                                    |
| `user_id`        | uuid FK          |                                    |
| `pole`           | text             | `'mj'` ou `'animateur'` (snapshot) |
| `character_name` | text             | snapshot                           |
| `comments`       | text null        | seul champ éditable                |
| `submitted_at`   | timestamptz null |                                    |
| `created_at`    | timestamptz     |                                    |

Contrainte : `unique (animation_id, user_id)`.

### `user_absences`

| Colonne      | Type        | Notes              |
|--------------|-------------|--------------------|
| `id`         | uuid PK     |                    |
| `user_id`    | uuid FK     | ON DELETE CASCADE  |
| `from_date`  | date        |                    |
| `to_date`    | date        | ≥ from_date        |
| `reason`     | text null   |                    |
| `created_at` | timestamptz |                    |

Index : `(user_id, from_date, to_date)`.

### `audit_log`

| Colonne       | Type         | Notes                          |
|---------------|--------------|--------------------------------|
| `id`          | uuid PK      |                                |
| `actor_id`    | uuid FK null |                                |
| `action`      | text         | ex. `'animation.validate'`     |
| `target_type` | text         |                                |
| `target_id`   | uuid null    |                                |
| `metadata`    | jsonb        |                                |
| `created_at`  | timestamptz  |                                |

### Fonctions SQL partagées (semaine samedi 4h → samedi 4h)

```sql
create or replace function week_start(ts timestamptz default now())
returns timestamptz language plpgsql immutable as $$
declare
  local_ts timestamp;
  dow int;
  days_since_sat int;
  anchor timestamp;
begin
  local_ts := ts at time zone 'Europe/Paris';
  dow := extract(dow from local_ts)::int;       -- 0 dim … 6 sam
  days_since_sat := (dow + 1) % 7;              -- 0 si sam, 1 si dim, …
  anchor := date_trunc('day', local_ts) - (days_since_sat || ' days')::interval
            + interval '4 hours';
  if anchor > local_ts then
    anchor := anchor - interval '7 days';
  end if;
  return anchor at time zone 'Europe/Paris';
end;
$$;

create or replace function week_end(ts timestamptz default now())
returns timestamptz language sql immutable as $$
  select week_start(ts) + interval '7 days';
$$;
```

**Tester impérativement** sur samedi 03:59 / 04:00, transitions CET ↔ CEST.

---

## 6. Authentification (SPA — PKCE flow)

### Flow complet

1. **`/login`** affiche le bouton "Se connecter avec Discord".
2. Click → `supabase.auth.signInWithOAuth({ provider: 'discord', options: { scopes: 'identify guilds.members.read', redirectTo: \`${APP_URL}/auth/callback\` } })`.
3. Discord redirige vers **`/auth/callback`** avec le code en query param (ou hash selon config).
4. La route `/auth/callback` monte un composant qui :
   - Appelle `supabase.auth.getSession()` pour finaliser l'échange (géré automatiquement par supabase-js en PKCE).
   - Attend que la session soit disponible.
   - Invoque `supabase.functions.invoke('auth-validate-staff')`.
5. **`auth-validate-staff`** (Edge Function, service role) :
   - Extrait `provider_token` Discord depuis `auth.users.raw_user_meta_data`.
   - `GET https://discord.com/api/users/@me/guilds/{GUILD_ID}/member` avec ce token.
   - Vérifie ≥ 1 rôle staff dans `member.roles`.
   - Si oui : upsert `profiles` avec le rôle le plus élevé, met à jour `last_role_check_at`.
   - Sinon : renvoie 403. Le client appelle alors `supabase.auth.signOut()` et redirige vers `/login?error=unauthorized`.
6. Sinon, redirect client-side vers `/dashboard`.

### Provider Auth React

`src/hooks/useAuth.ts` expose :

```ts
type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: Profile; role: StaffRoleKey };
```

Il :
- Souscrit à `supabase.auth.onAuthStateChange`
- Au premier SIGNED_IN, fetch `profiles` via Edge Function `auth-validate-staff` (qui revalide + retourne les infos)
- Stocke le résultat dans un contexte React + une query TanStack (`queryKey: ['auth', 'me']`)
- Fournit `signOut()`

### Revalidation périodique 24h

Dans le layout panel (`routes/panel/layout.tsx`), un `useEffect` :

```ts
useEffect(() => {
  const intervalMs = 60 * 60 * 1000; // 1h
  const check = async () => {
    const hoursSince = (Date.now() - new Date(me.last_role_check_at).getTime()) / 3_600_000;
    if (hoursSince >= 24) {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      // Le refetch rappelle auth-validate-staff qui déconnecte si les rôles ont disparu.
    }
  };
  check();
  const id = setInterval(check, intervalMs);
  return () => clearInterval(id);
}, [me.last_role_check_at]);
```

Si `auth-validate-staff` renvoie 403 lors d'un refetch : le provider Auth appelle `signOut()` et redirige vers `/login?error=revoked`.

### Custom access token hook (Supabase Auth)

Enrichit le JWT avec `app_role` depuis `profiles.role`. Permet d'écrire des policies RLS basées sur `(auth.jwt() ->> 'app_role')::staff_role`.

### Guards côté frontend

`src/components/auth/ProtectedRoute.tsx` — wrapper qui :
- Redirige vers `/login` si non authentifié
- Affiche un `<FullPageLoader />` pendant `status === 'loading'`

`src/components/auth/RoleGate.tsx` — wrapper qui :
- Prend une prop `allow={['responsable']}` et affiche `children` uniquement si le rôle courant est dans la liste
- Sinon affiche une page 403 stylée OU retourne `null` si utilisé pour masquer un élément de sidebar

```tsx
<Route path="/panel" element={<ProtectedRoute><PanelLayout /></ProtectedRoute>}>
  <Route path="dashboard" element={<Dashboard />} />
  <Route path="members" element={<RoleGate allow={['responsable']}><Members /></RoleGate>} />
  {/* ... */}
</Route>
```

### Guards côté Edge Functions

Non changés : `requireAuth`, `requireStaff`, `requireRole(['responsable'])`, `requireCreator`, `requireParticipant`. C'est la vraie défense — le frontend ne fait qu'optimiser l'UX.

---

## 7. Edge Functions — contrats

Format universel : `{ data: T }` ou `{ error: { code, message, details? } }`.

Le frontend les appelle via un wrapper typé :

```ts
// src/lib/supabase/edge.ts
export async function invokeEdge<TResponse, TBody = unknown>(
  name: EdgeFunctionName,
  body?: TBody,
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke<ApiResponse<TResponse>>(name, { body });
  if (error) throw new EdgeError(error);
  if ('error' in (data ?? {})) throw new EdgeError((data as ApiError).error);
  return (data as ApiOk<TResponse>).data;
}
```

Chaque hook TanStack Query appelle `invokeEdge` :

```ts
export function useAnimations(filters: AnimationFilters) {
  return useQuery({
    queryKey: ['animations', filters],
    queryFn: () => invokeEdge<AnimationListResult>('animations-list', filters),
  });
}
```

Tableau exhaustif des fonctions (inchangé par rapport à la version précédente) :

| Fonction                           | Accès              | Body                                                                    |
|------------------------------------|--------------------|-------------------------------------------------------------------------|
| `auth-validate-staff`              | authentifié        | —                                                                       |
| `animations-list`                  | staff              | `{ status?, server?, village?, type?, creator_id?, from?, to?, page?, pageSize? }` |
| `animations-get`                   | staff              | `{ id }`                                                                |
| `animations-create`                | staff              | voir Zod                                                                |
| `animations-update`                | créateur           | subset si status ∈ {pending_validation, open}                           |
| `animations-validate`              | responsable        | `{ id }`                                                                |
| `animations-reject`                | responsable        | `{ id, reason }`                                                        |
| `animations-start`                 | créateur           | `{ id }`                                                                |
| `animations-stop`                  | créateur           | `{ id }` — génère les rapports                                          |
| `animations-postpone`              | créateur           | `{ id, new_scheduled_at }` — reset participants                         |
| `animations-cancel`                | créateur ou resp.  | `{ id }`                                                                |
| `participants-apply`               | staff (≠ créateur) | `{ animation_id, character_name }`                                      |
| `participants-decide`              | créateur           | `{ participant_id, decision }`                                          |
| `participants-update-character`    | concerné           | `{ participant_id, character_name }`                                    |
| `participants-remove-validated`    | créateur           | `{ participant_id }`                                                    |
| `participants-promote-pending`     | créateur           | `{ participant_id }`                                                    |
| `reports-list-mine`                | staff              | —                                                                       |
| `reports-submit`                   | owner              | `{ report_id, comments }`                                               |
| `absences-list`                    | self ou resp.      | `{ user_id? }`                                                          |
| `absences-create`                  | self               | `{ from_date, to_date, reason? }`                                       |
| `absences-delete`                  | self               | `{ id }`                                                                |
| `stats-weekly`                     | staff              | `{ user_id? }`                                                          |
| `stats-villages`                   | responsable        | —                                                                       |
| `leaderboard`                      | responsable        | `{ period }`                                                            |
| `members-list`                     | responsable        | —                                                                       |
| `members-remove-access`            | responsable        | `{ user_id }`                                                           |

### Schémas Zod clés (partagés)

`src/lib/schemas/animation.ts` — identique à la version précédente :

```ts
import { z } from 'zod';

export const SERVERS  = ['S1','S2','S3','S4','S5','SE1','SE2','SE3'] as const;
export const TYPES    = ['petite','moyenne','grande'] as const;
export const VILLAGES = ['konoha','suna','oto','kiri','temple_camelias','autre','tout_le_monde'] as const;

export const createAnimationSchema = z.object({
  title: z.string().trim().min(3).max(120),
  scheduledAt: z.coerce.date().refine(d => d.getTime() > Date.now()),
  plannedDurationMin: z.number().int().min(15).max(720),
  requiredParticipants: z.number().int().min(1).max(100),
  server: z.enum(SERVERS),
  type: z.enum(TYPES),
  prepTimeMin: z.number().int().min(0).max(600),
  village: z.enum(VILLAGES),
  documentUrl: z.string().url().max(500),
  creatorCharacterName: z.string().trim().min(1).max(64).optional(),
});

export const applyParticipantSchema = z.object({
  animationId: z.string().uuid(),
  characterName: z.string().trim().min(1).max(64),
});

export const rejectSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
});

export const postponeSchema = z.object({
  id: z.string().uuid(),
  newScheduledAt: z.coerce.date().refine(d => d.getTime() > Date.now()),
});

export const absenceSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  reason: z.string().trim().max(300).optional(),
}).refine(v => v.toDate >= v.fromDate);
```

---

## 8. Règles métier

### Cycle de vie

```
    [création]
        │
        ▼
pending_validation ──► rejected (raison)
        │
        │ (responsable valide)
        ▼
      open ──────────► cancelled
        │  ──────────► postponed → (retour à open avec nouvelle date)
        │
        │ (créateur démarre, ≥ 1 validated)
        ▼
    running
        │
        │ (créateur termine)
        ▼
    finished  → génération automatique des rapports
```

### Semaine administrative

**Samedi 04:00 Europe/Paris → samedi suivant 04:00.** Toutes les stats, quotas, graphiques. Affichage topbar : "Sem. du 15/11 04:00 → 22/11 04:00".

### Journée RP (pour l'affichage du calendrier uniquement)

Concept distinct de la semaine administrative. Une **journée RP** va de **18:00 à 03:00** (04:00 les vendredis et samedis soir). Une animation qui commence vendredi 23:00 et se termine samedi 01:00 est une "session du vendredi" et s'affiche intégralement dans la colonne "Vendredi" du calendrier.

**Règle de mapping `scheduled_at` → colonne d'affichage** :

```ts
// src/lib/utils/calendar.ts
import { subHours, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Retourne le jour RP auquel une animation appartient pour l'affichage calendrier.
 * Règle : on recule la date de 4 heures et on prend le jour civil Europe/Paris correspondant.
 * - Une anim à sam 25 01:30 → 01:30 - 4h = sam 25 -2:30 = ven 24 21:30 → colonne "Vendredi 24"
 * - Une anim à sam 25 05:00 → 05:00 - 4h = sam 25 01:00 → colonne "Samedi 25"
 * - Une anim à ven 24 20:00 → 20:00 - 4h = ven 24 16:00 → colonne "Vendredi 24"
 */
export function rpDayFromDate(scheduledAt: Date): Date {
  const paris = toZonedTime(scheduledAt, 'Europe/Paris');
  const shifted = subHours(paris, 4);
  return startOfDay(shifted);
}
```

Cette règle est **cohérente avec `week_start`** : la semaine admin et la journée RP utilisent toutes les deux le décalage de 4h. Une animation dans la semaine administrative W apparaîtra toujours dans une des 7 colonnes RP de cette semaine.

### Rendu du calendrier

- **7 colonnes** : Samedi, Dimanche, Lundi, Mardi, Mercredi, Jeudi, Vendredi (dans cet ordre — samedi = début de semaine admin)
- **Axe vertical** : continu de 18:00 à 03:00 ou 04:00 selon le jour
  - Colonnes Dim/Lun/Mar/Mer/Jeu : se terminent à 03:00
  - Colonnes Ven/Sam : se terminent à 04:00
- **Heures après minuit** affichées normalement : 00:00, 01:00, 02:00, 03:00 (pas de 24:00 / 25:00)
- **Plages hors-session** (03:00 → 18:00) : cellules muted / striées pour signaler qu'on ne peut rien y placer
- **Blocs d'animation** : positionnés selon `rpDayFromDate(scheduled_at)` pour la colonne, et selon l'heure réelle pour la position verticale. Un bloc qui part à 23:00 et dure 2h s'étend de la row 23:00 à la row 01:00 dans la même colonne, sans coupure.
- **Ligne rouge du temps courant** : visible uniquement si l'heure actuelle est dans une plage de session (18:00–03:00 ou 18:00–04:00).
- **Couleur du bloc** : par village (cohérent avec les badges).
- **Header colonne** : weekday + date du **début de session** (ex. "VEN 24").

### Quotas hebdomadaires

Compte les animations **créées par l'utilisateur** avec status = `finished` ET `ended_at` dans `[week_start(), week_end())`.

| Rôle                  | Quota                                  |
|-----------------------|----------------------------------------|
| Animateur             | 5                                      |
| Animateur Senior      | 5                                      |
| Maître du Jeu (MJ)    | 3                                      |
| Responsable Animateur | illimité (affiché "Illimité")          |

Progress bar : rouge si derrière le prorata temporel, verte si atteint, neutre sinon.

### Contraintes backend

- Impossible de se proposer sur sa propre animation.
- Unique `(animation_id, user_id)` sur participants. Une fois `removed`, plus d'inscription possible sur la même animation.
- Impossible de se proposer pendant une absence déclarée couvrant la date.
- `start` : uniquement depuis `open`, ≥ 1 `validated`, pas > 24h avant `scheduled_at`.
- `stop` : uniquement depuis `running`.
- `actual_duration_min = GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60))`.
- `remove-validated` : uniquement si `open`. Pas de delete, passage à `removed`.
- `postpone` : tous les `pending` et `validated` passent à `removed`, DM à chacun via bot, `postpone_count++`, ancienne date dans `postponed_from`. Reste en `open`.
- `validate` / `reject` : responsable uniquement. Rejet requiert raison ≥ 5 chars. DM créateur.
- `members-remove-access` : retire rôles Discord via bot, delete profile, signOut toutes les sessions. Audité.

### Génération des rapports au `stop`

Dans une transaction, insert un row dans `animation_reports` pour :
- Le créateur (avec `creator_character_name` si renseigné, sinon `'—'`).
- Chaque participant `validated` (snapshot de `character_name`).

Tous initialisés avec `comments = null, submitted_at = null`. Le membre soumet ensuite via `reports-submit`. Un banner apparaît sur le dashboard si rapports en retard > 48h.

### Absences

- Création d'une absence couvrant des participations existantes : pas de suppression auto, warning dashboard.
- Création d'une participation pendant une absence : refusée par Edge Function.

### Graphique villages (responsable)

`stats-villages` :

```ts
{
  currentWeek: {
    start, end,
    byVillage: { konoha: 42.3, ... },    // pourcentages
    counts:    { konoha: 10, ... }
  },
  lastFourWeeks: [{ weekStart, byVillage }, ...]
}
```

Basé sur les animations `finished` terminées dans la fenêtre.

### Leaderboard

Trois classements sur la période (week / month / all) :
- Heures animées (somme `actual_duration_min` des animations `finished` créées par l'user)
- Animations créées (count `finished`)
- Participations validées (count `animation_participants` validated sur `finished`)

Cache 5 min côté Edge Function.

---

## 9. Intégration Bot Discord

Endpoints en `POST`, auth via `X-Bot-Secret`.

| Route                          | Payload                                                                      | Retour                |
|--------------------------------|------------------------------------------------------------------------------|-----------------------|
| `/webhook/animation-created`   | `{ animationId, ...details }` — embed channel validation                     | `{ adminMessageId }`  |
| `/webhook/animation-validated` | `{ animationId, creatorDiscordId, ...details }` — embed public + DM créateur | `{ publicMessageId }` |
| `/webhook/animation-rejected`  | `{ animationId, creatorDiscordId, reason }` — DM créateur                    | `{}`                  |
| `/webhook/animation-updated`   | `{ animationId, publicMessageId, ...details }`                               | `{}`                  |
| `/webhook/animation-started`   | `{ animationId, publicMessageId }`                                           | `{}`                  |
| `/webhook/animation-finished`  | `{ animationId, publicMessageId, actualDurationMin }`                        | `{}`                  |
| `/webhook/animation-postponed` | `{ animationId, publicMessageId, newDate, formerParticipantDiscordIds }`     | `{}`                  |
| `/webhook/member-remove-roles` | `{ discordUserId }`                                                          | `{ removedRoles }`    |

### Couleurs embed

- `pending_validation` : gris
- `open` : cyan
- `running` : vert
- `finished` : violet
- `rejected` : rouge
- `postponed` : orange
- `cancelled` : gris foncé

### Embed public

```
🎭  [Titre]
────────────────────────────────
🗓️  12/11/2026 à 21h00
⏱️  Durée prévue : 2h · Prépa : 30 min
🌐  Serveur : S3
🏯  Village : Konoha
🎯  Type : Moyenne
👥  Participants : 4 / 6
📄  [Voir le document]

Organisé par @Saki Sato
Statut : 🟢 Ouverte

[🔗 Ouvrir dans le panel]
```

Lien : `https://animations.solve.tld/panel/animations/{id}`.

---

## 10. UI

Design produit dans **Claude Design** avant dev, handoff bundle vers Claude Code.

- Fond `bg-[#0A0B0F]`, orbes gradient flous en background.
- Glass cards : `bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]`.
- Accent cyan `#22D3EE`.
- Badges rôle : Responsable or `#F59E0B`, Senior violet `#A855F7`, Animateur bleu `#3B82F6`, MJ rouge `#EF4444`.
- Badges village (figer en design) : Konoha vert feuille, Suna sable, Oto violet profond, Kiri teal brumeux, Temple rose doux, Autre gris, Tout le monde gradient multicolore.
- Badges type : Petite (gris clair), Moyenne (cyan), Grande (doré).
- Toasts : `sonner` top-right.
- Icônes : `lucide-react`.
- Animations : `framer-motion` pour modals et cartes.
- Graphiques : `recharts`.
- Sidebar role-aware : `Validation`, `Classement`, `Membres`, `Graphique villages` masqués si non-responsable.
- Composants shadcn : `button`, `card`, `input`, `label`, `select`, `dialog`, `dropdown-menu`, `badge`, `avatar`, `table`, `tabs`, `sonner`, `progress`, `separator`, `skeleton`, `calendar`, `popover`, `tooltip`, `sheet`, `form`, `alert-dialog`.

### Calendrier — composants

Décomposition recommandée :

```
components/calendar/
├── WeekGrid.tsx          # conteneur principal, 7 colonnes + axe horaire
├── DayColumn.tsx         # 1 colonne, avec fin de session variable (03h ou 04h)
├── TimeAxis.tsx          # labels horaires à gauche
├── AnimationBlock.tsx    # bloc animation avec couleur village
├── NowIndicator.tsx      # ligne rouge temps courant
└── WeekNavigator.tsx     # flèches prev/next + "Semaine actuelle"
```

`WeekGrid` reçoit :
```ts
{
  weekStart: Date;  // samedi 04:00
  animations: Animation[];
  onBlockClick: (id: string) => void;
}
```

En interne, il groupe les animations par `rpDayFromDate(scheduled_at)` en 7 buckets, puis chaque `DayColumn` positionne ses blocs en absolu selon `(scheduled_at, planned_duration_min)`.

---

## 11. Variables d'environnement

### `apps/web/.env` (exposées au bundle, préfixe `VITE_`)

```
VITE_SUPABASE_URL="https://xxx.supabase.co"
VITE_SUPABASE_ANON_KEY="..."
VITE_APP_URL="https://animations.solve.tld"
```

**Aucune** clé sensible ici — tout ce qui est dans `VITE_*` est embarqué dans le bundle JS public.

### Supabase Edge Functions (secrets via `supabase secrets set`)

```
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_GUILD_ID=...
DISCORD_ANNOUNCE_CHANNEL_ID=...
DISCORD_VALIDATION_CHANNEL_ID=...
BOT_WEBHOOK_URL=https://bot.solve.tld
BOT_WEBHOOK_SECRET=...
APP_PUBLIC_URL=https://animations.solve.tld
```

### `apps/bot/.env`

```
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_ANNOUNCE_CHANNEL_ID=...
DISCORD_VALIDATION_CHANNEL_ID=...
BOT_WEBHOOK_SECRET=...
BOT_PORT=4001
APP_PUBLIC_URL=https://animations.solve.tld
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 12. Déploiement

### Architecture cible

```
Internet → Nginx (443)
           ├─► / → static files (dist/ du build Vite)
           └─► bot.solve.tld → Bot (4001) [sous-domaine séparé, HTTPS]

Navigateur → Supabase Cloud (HTTPS)
Edge Functions → Bot (HTTPS)
```

La SPA est **100% statique**. Nginx sert `dist/` avec fallback SPA :

```nginx
location / {
  root /var/www/solve-animations;
  try_files $uri $uri/ /index.html;
}
```

### Étapes

1. **Supabase** : `supabase db push`, `supabase functions deploy`, `supabase secrets set ...`.
2. **Discord App** : OAuth redirect vers `https://<project>.supabase.co/auth/v1/callback` + scopes `identify guilds.members.read`. Client ID/Secret dans Supabase Auth > Providers > Discord.
3. **Bot** : build + `pm2 start dist/index.js --name solve-anim-bot`. Invité sur Discord avec permissions `Manage Roles`, `Send Messages`, `Embed Links`.
4. **Web** : `pnpm --filter web build` → upload `dist/` dans `/var/www/solve-animations/`.
5. **Nginx** : static + fallback SPA + Let's Encrypt.

### CI/CD suggéré

- GitHub Actions qui build la SPA et déploie par `rsync` sur le VPS lors d'un push sur `main`.
- Les Edge Functions se déploient séparément via `supabase functions deploy`.

---

## 13. Ordre de développement suggéré

1. Setup monorepo (pnpm workspaces), Vite React TS, Tailwind, shadcn, Supabase CLI.
2. Migrations SQL + RLS + fonctions `week_start` / `week_end` avec tests pgTAP.
3. Auth Discord + Edge Function `auth-validate-staff` + `useAuth` + `ProtectedRoute` + revalidation 24h.
4. Shell (sidebar role-aware + topbar + WeekIndicator).
5. CRUD animations (create → validate → open → start → stop) sans bot.
6. Participants (apply avec perso, decide, update character, remove, promote).
7. Reports (génération auto au stop, page Mes rapports, soumission).
8. Absences (CRUD).
9. Dashboard stats hebdo + quotas.
10. Scaffold bot + endpoint `animation-validated`.
11. Brancher tous les events animations → bot.
12. Pages responsable : Validation, Membres, Classement, Graphique villages.
13. **Calendrier RP** (WeekGrid custom avec journée RP 18h → 03h/04h).
14. `members-remove-access` + endpoint bot associé.
15. `animations-postpone` avec DMs.
16. Polish : empty states, skeletons, toasts, responsive, Realtime subscriptions sur détail animation (pour voir les participants en live).
17. Déploiement VPS + Supabase Cloud.

---

## 14. Anti-patterns à éviter

- ❌ Requêtes DB directes depuis le frontend (hors Realtime read-only).
- ❌ Service role key dans le bundle frontend — **jamais**. Elle vit uniquement dans Edge Functions et bot.
- ❌ `fetch` direct vers les Edge Functions — toujours `supabase.functions.invoke` via le wrapper `invokeEdge`.
- ❌ État serveur dans Zustand. Le state serveur vit dans TanStack Query, Zustand est pour l'UI client uniquement.
- ❌ Hardcoder des IDs Discord hors de `config/discord.ts`.
- ❌ Déduire le rôle côté client sans revalidation : le hook `useAuth` déclenche un refetch toutes les 24h.
- ❌ Laisser un créateur valider sa propre animation (responsable only, audité si le créateur est lui-même responsable — à trancher : bloquer complètement ou auditer).
- ❌ Oublier d'inclure le créateur dans les rapports générés.
- ❌ Calculer la semaine ou la journée RP sur la timezone du navigateur : **toujours Europe/Paris**, via `date-fns-tz`.
- ❌ Rendre le calendrier avec un composant tiers qui pense en "jours civils" — notre journée RP traverse minuit, il faut du custom.
- ❌ Supprimer auto les participations lors d'une absence : on avertit seulement.
- ❌ Utiliser `window.location` pour naviguer — toujours `useNavigate()` ou `<Link>` React Router.
- ❌ Oublier le fallback SPA dans Nginx (`try_files ... /index.html`) — sans ça, un refresh sur `/panel/animations/xxx` retourne 404.