import { z } from "zod"

const commonFields = {
  title: z.string().trim().min(1, "Le titre ne doit pas être vide."),
  amount: z.coerce
    .number()
    .positive("Le montant doit être supérieur à 0."),
  accountId: z.string().trim().min(1, "Le compte source est obligatoire."),
  date: z.coerce.date("La date doit être valide."),
}

const categorizedTransactionSchema = z
  .object({
    ...commonFields,
    type: z.enum(["INCOME", "EXPENSE"]),
    categoryId: z.string().trim().min(1, "La catégorie est obligatoire."),
  })
  .strict()

const transferSchema = z
  .object({
    ...commonFields,
    type: z.literal("TRANSFER"),
    destinationAccountId: z
      .string()
      .trim()
      .min(1, "Le compte destination est obligatoire."),
  })
  .strict()
  .refine((data) => data.accountId !== data.destinationAccountId, {
    message: "Les comptes source et destination doivent être différents.",
    path: ["destinationAccountId"],
  })

export const transactionSchema = z.discriminatedUnion("type", [
  categorizedTransactionSchema,
  transferSchema,
])

export const updateTransactionSchema = z
  .object({
    title: commonFields.title.optional(),
    amount: commonFields.amount.optional(),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
    categoryId: z.string().trim().min(1).optional(),
    accountId: commonFields.accountId.optional(),
    destinationAccountId: z.string().trim().min(1).nullable().optional(),
    date: commonFields.date.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ modifiable est requis.",
  })
