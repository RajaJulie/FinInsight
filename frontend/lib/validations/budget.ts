import { z } from "zod"

const monthSchema = z.coerce
  .number()
  .int("Le mois doit être un nombre entier.")
  .min(1, "Le mois doit être compris entre 1 et 12.")
  .max(12, "Le mois doit être compris entre 1 et 12.")

const yearSchema = z.coerce
  .number()
  .int("L’année doit être un nombre entier.")
  .positive("L’année doit être supérieure à zéro.")

export const budgetPeriodSchema = z
  .object({
    month: monthSchema,
    year: yearSchema,
  })
  .strict()

export const budgetSchema = z
  .object({
    categoryId: z.string().trim().min(1, "La catégorie est obligatoire."),
    amount: z.coerce
      .number()
      .finite("Le montant doit être un nombre valide.")
      .positive("Le montant doit être supérieur à zéro."),
    month: monthSchema,
    year: yearSchema,
  })
  .strict()

export const updateBudgetSchema = budgetSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ modifiable est requis.",
  })
