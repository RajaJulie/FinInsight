import { z } from "zod"

const currentYear = new Date().getFullYear()

export const categoryAnalyticsQuerySchema = z.object({
  period: z.enum(["month", "year", "all"]).default("month"),
  year: z.coerce.number().int().min(2000).max(currentYear + 10).default(currentYear),
  month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1),
  type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
})
