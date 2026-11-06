/**
 * Definit les schemas Zod de creation, confirmation et modification des charges.
 * Controle les montants, la frequence, le jour et la coherence des dates d'application.
 */
import { z } from "zod"

import { parseDateInputToUtcDate } from "@/lib/recurring/date-period"

const dateInputSchema = z
  .string()
  .trim()
  .refine((value) => parseDateInputToUtcDate(value) !== null, {
    message: "La date doit être valide.",
  })
  .transform((value) => parseDateInputToUtcDate(value) as Date)

const optionalDateInputSchema = z
  .union([z.literal(""), dateInputSchema, z.null()])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value))

const updateDateInputSchema = z
  .union([z.literal(""), dateInputSchema, z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    if (value === "") return null

    return value
  })

const recurringTransactionFields = {
  title: z.string().trim().min(1, "Le titre ne doit pas être vide."),
  amount: z
    .number()
    .finite("Le montant doit être un nombre valide.")
    .positive("Le montant doit être supérieur à 0.")
    .max(9999999999.99, "Le montant est trop élevé.")
    .refine(
      (value) => value === Number(value.toFixed(2)),
      "Le montant doit comporter au maximum deux décimales."
    ),
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().trim().min(1, "La catégorie est obligatoire."),
  accountId: z.string().trim().min(1, "Le compte est obligatoire."),
  frequency: z.literal("MONTHLY"),
  dayOfMonth: z.coerce
    .number()
    .int("Le jour du mois doit être un nombre entier.")
    .min(1, "Le jour du mois doit être compris entre 1 et 31.")
    .max(31, "Le jour du mois doit être compris entre 1 et 31."),
  active: z.boolean(),
  startDate: dateInputSchema,
  endDate: optionalDateInputSchema,
}

export const recurringTransactionSchema = z
  .object({
    ...recurringTransactionFields,
    active: recurringTransactionFields.active.default(true),
    endDate: recurringTransactionFields.endDate.default(null),
  })
  .strict()
  .refine(
    (data) => !data.endDate || data.endDate >= data.startDate,
    {
      message: "La date de fin doit être postérieure ou égale à la date de début.",
      path: ["endDate"],
    }
  )

export const confirmRecurringTransactionSchema = z
  .object({
    suggestionId: z.string().trim().min(1, "La suggestion est obligatoire."),
    title: recurringTransactionFields.title,
    amount: recurringTransactionFields.amount,
    type: recurringTransactionFields.type.optional(),
    categoryId: recurringTransactionFields.categoryId,
    accountId: recurringTransactionFields.accountId,
    frequency: recurringTransactionFields.frequency,
    dayOfMonth: recurringTransactionFields.dayOfMonth,
    active: recurringTransactionFields.active.default(true),
    startDate: recurringTransactionFields.startDate,
    endDate: recurringTransactionFields.endDate.default(null),
  })
  .strict()
  .refine(
    (data) => !data.endDate || data.endDate >= data.startDate,
    {
      message: "La date de fin doit être postérieure ou égale à la date de début.",
      path: ["endDate"],
    }
  )

export const updateRecurringTransactionSchema = z
  .object({
    title: recurringTransactionFields.title.optional(),
    amount: recurringTransactionFields.amount.optional(),
    type: recurringTransactionFields.type.optional(),
    categoryId: recurringTransactionFields.categoryId.optional(),
    accountId: recurringTransactionFields.accountId.optional(),
    frequency: recurringTransactionFields.frequency.optional(),
    dayOfMonth: recurringTransactionFields.dayOfMonth.optional(),
    active: recurringTransactionFields.active.optional(),
    startDate: recurringTransactionFields.startDate.optional(),
    endDate: updateDateInputSchema,
    confirmPeriodCorrection: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).some((key) => key !== "confirmPeriodCorrection"), {
    message: "Au moins un champ modifiable est requis.",
  })
  .refine((data) => !data.confirmPeriodCorrection ||
    (data.active === undefined && (data.startDate !== undefined || data.endDate !== undefined)), {
    message: "La confirmation historique doit accompagner une correction de dates, sans changement d’activation.",
    path: ["confirmPeriodCorrection"],
  })
