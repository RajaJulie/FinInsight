import { z } from "zod"

export const emergencyReserveSchema = z
  .object({
    month: z.number().int("Mois invalide.").min(1, "Mois invalide.").max(12, "Mois invalide."),
    year: z.number().int("Année invalide.").min(1, "Année invalide.").max(9999, "Année invalide."),
    amount: z
      .number("Le montant doit être un nombre.")
      .finite("Le montant doit être un nombre valide.")
      .min(0, "Le montant doit être positif ou nul.")
      .max(9999999999.99, "Le montant est trop élevé.")
      .refine((amount) => /^\d+(?:\.\d{1,2})?$/.test(String(amount)), {
        message: "Le montant doit avoir au maximum deux décimales.",
      }),
  })
  .strict()
