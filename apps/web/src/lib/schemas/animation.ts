import { z } from 'zod'

export const SERVERS = ['S1', 'S2', 'S3', 'S4', 'S5', 'SE1', 'SE2', 'SE3'] as const
export const TYPES = ['moyenne', 'grande'] as const
export const POLES = ['animation', 'mj', 'les_deux'] as const
export const MISSION_KINDS = ['classique', 'spontanee_bdm', 'passee'] as const
export const VILLAGES = [
  'konoha',
  'suna',
  'oto',
  'kiri',
  'temple_camelias',
  'autre',
  'tout_le_monde',
] as const

export type AnimationServer = (typeof SERVERS)[number]
export type AnimationType = (typeof TYPES)[number]
export type AnimationPole = (typeof POLES)[number]
export type MissionKind = (typeof MISSION_KINDS)[number]
export type Village = (typeof VILLAGES)[number]

export const createAnimationSchema = z
  .object({
    title: z.string().trim().min(3, 'Minimum 3 caractères').max(120, 'Maximum 120 caractères'),
    missionKind: z.enum(MISSION_KINDS).default('classique'),
    spontaneous: z.boolean().default(false),
    scheduledAt: z.coerce.date().optional(),
    plannedDurationMin: z
      .number({ required_error: 'Durée requise' })
      .int()
      .min(15, 'Minimum 15 minutes')
      .max(720, 'Maximum 720 minutes'),
    requiredParticipants: z
      .number({ required_error: 'Requis' })
      .int()
      .min(0, 'Minimum 0')
      .max(100, 'Maximum 100'),
    server: z.enum(SERVERS, { required_error: 'Serveur requis' }),
    type: z.enum(TYPES, { required_error: 'Type requis' }),
    pole: z.enum(POLES, { required_error: 'Pôle requis' }),
    prepTimeMin: z
      .number()
      .int()
      .min(0)
      .max(600)
      .default(0),
    village: z.enum(VILLAGES, { required_error: 'Village requis' }),
    description: z.string().trim().max(2000).optional(),
    requestValidation: z.boolean().default(true),
    pingRoles: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const isInstantMission = value.spontaneous || value.missionKind === 'spontanee_bdm'
    const isPastMission = value.missionKind === 'passee'
    if (!isInstantMission && !value.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Date requise',
        path: ['scheduledAt'],
      })
    }
    if (value.scheduledAt && value.missionKind === 'classique' && value.scheduledAt.getTime() < Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Une animation classique ne peut pas être antidatée',
        path: ['scheduledAt'],
      })
    }
    if (value.scheduledAt && isPastMission && value.scheduledAt.getTime() > Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Une animation passée ne peut pas être dans le futur',
        path: ['scheduledAt'],
      })
    }
  })

export type CreateAnimationInput = z.infer<typeof createAnimationSchema>

export const applyParticipantSchema = z.object({
  animationId: z.string().uuid(),
})

export type ApplyParticipantInput = z.infer<typeof applyParticipantSchema>

export const submitReportSchema = z.object({
  reportId: z.string().uuid(),
  characterName: z.string().trim().min(1, 'Nom du personnage requis').max(64),
  comments: z.string().trim().max(2000).optional(),
})

export type SubmitReportInput = z.infer<typeof submitReportSchema>

export const rejectSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(5, 'Minimum 5 caractères').max(500),
})

export const postponeSchema = z.object({
  id: z.string().uuid(),
  newScheduledAt: z.coerce
    .date()
    .refine((d) => d.getTime() > Date.now(), "La date doit être dans le futur"),
})

export const absenceSchema = z
  .object({
    fromDate: z.coerce.date({ required_error: 'Date de début requise' }),
    toDate: z.coerce.date({ required_error: 'Date de fin requise' }),
    userId: z.string().optional(),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.toDate >= v.fromDate, {
    message: 'La date de fin doit être après la date de début',
    path: ['toDate'],
  })

export type AbsenceInput = z.infer<typeof absenceSchema>
