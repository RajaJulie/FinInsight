import { z } from "zod"

const recurringTransactionFields = {
  title: z.string().trim().min(1, "Le titre ne doit pas être vide."),
  amount: z.coerce
    .number()
    .finite("Le montant doit être un nombre valide.")
    .positive("Le montant doit être supérieur à 0."),
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
}

export const recurringTransactionSchema = z
  .object({
    ...recurringTransactionFields,
    active: recurringTransactionFields.active.default(true),
  })
  .strict()

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
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ modifiable est requis.",
  })
