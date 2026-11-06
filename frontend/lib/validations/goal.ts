/**
 * Definit les schemas Zod des requetes Objectifs : creation, modification
 * et ecritures virtuelles. Valide les montants positifs a deux decimales maximum,
 * les dates, les statuts et la cle d'idempotence, puis rejette les champs inconnus.
 */
import { z } from "zod"
import { toPositiveGoalCents, fromGoalCents } from "@/lib/goals/money"
import { parseDateInputToUtcDate } from "@/lib/recurring/date-period"

const money = z.union([z.number(), z.string()]).transform((value, context) => {
  try { return fromGoalCents(toPositiveGoalCents(value)) } catch {
    context.addIssue({ code: "custom", message: "Le montant doit être positif, fini, avec deux décimales maximum (Decimal(12,2))." })
    return z.NEVER
  }
})
const title = z.string().trim().min(1, "Le titre est obligatoire.").max(120)
const accountId = z.string().trim().min(1, "Le compte est obligatoire.").max(128)
const targetDate = z.string().length(10).refine(value => parseDateInputToUtcDate(value) !== null, "Date invalide : format AAAA-MM-JJ attendu.")
  .transform(value => parseDateInputToUtcDate(value) as Date).nullable()

export const createGoalSchema = z.object({
  title, accountId, targetAmount: money, targetDate: targetDate.optional(),
}).strict()

export const updateGoalSchema = z.object({
  title: title.optional(), accountId: accountId.optional(), targetAmount: money.optional(),
  targetDate: targetDate.optional(), status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Au moins un champ modifiable est requis.")

export const createGoalEntrySchema = z.object({
  type: z.enum(["ALLOCATION", "RELEASE"]), amount: money,
  idempotencyKey: z.string().trim().min(1, "La clé d'idempotence est obligatoire.").max(128),
  note: z.string().trim().max(1000).nullable().optional().transform(value => value || null),
}).strict()

export type CreateGoalInput = z.output<typeof createGoalSchema>
export type UpdateGoalInput = z.output<typeof updateGoalSchema>
export type CreateGoalEntryInput = z.output<typeof createGoalEntrySchema>
