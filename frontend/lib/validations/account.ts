import { z } from "zod"

import {
  ACCOUNT_ICON_VALUES,
  ACCOUNT_TYPE_VALUES,
} from "@/lib/accounts/constants"

const accountFields = {
  name: z
    .string()
    .trim()
    .min(1, "Le nom est obligatoire.")
    .max(50, "Le nom ne doit pas dépasser 50 caractères."),
  type: z.enum(ACCOUNT_TYPE_VALUES),
  initialBalance: z.coerce
    .number()
    .finite("Le solde initial doit être un nombre valide."),
  currency: z.literal("EUR", {
    error: "Seule la devise EUR est disponible dans le MVP.",
  }),
  icon: z.enum(ACCOUNT_ICON_VALUES),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "La couleur doit être au format hexadécimal."),
  isPrimary: z.boolean(),
}

export const accountSchema = z
  .object({
    ...accountFields,
    isPrimary: accountFields.isPrimary.default(false),
  })
  .strict()

export const updateAccountSchema = z
  .object({
    name: accountFields.name.optional(),
    type: accountFields.type.optional(),
    initialBalance: accountFields.initialBalance.optional(),
    currency: accountFields.currency.optional(),
    icon: accountFields.icon.optional(),
    color: accountFields.color.optional(),
    isPrimary: accountFields.isPrimary.optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ modifiable est requis.",
  })
