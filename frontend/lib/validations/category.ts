import { z } from "zod"

import { CATEGORY_ICON_VALUES } from "@/lib/categories/constants"

export const categorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Le nom de la catégorie est obligatoire.")
      .max(50, "Le nom ne doit pas dépasser 50 caractères."),
    type: z.enum(["INCOME", "EXPENSE"]),
    icon: z.enum(CATEGORY_ICON_VALUES),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "La couleur doit être au format hexadécimal."),
  })
  .strict()

export const updateCategorySchema = categorySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ modifiable est requis.",
  })
