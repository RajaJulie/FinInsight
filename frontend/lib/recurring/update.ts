/**
 * Applique les modifications d'une charge recurrente dans une transaction Prisma.
 * Controle les relations et les periodes, tout en preservant l'identite de detection et l'historique.
 */
import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getTodayUtcDayStart } from "@/lib/recurring/date-period"
import { planRecurringActivityTransition, RecurringActivityValidationError } from "@/lib/recurring/activity-transition"
import { serializeRecurringTransaction } from "@/lib/recurring/serialization"
import { normalizeRecurringTitle } from "@/lib/recurring/detection"
import type { z } from "zod"
import type { updateRecurringTransactionSchema } from "@/lib/validations/recurring-transaction"

export async function updateRecurringTransactionForUser(userId: string, id: string, patch: z.output<typeof updateRecurringTransactionSchema>) {
  const { confirmPeriodCorrection, ...fields } = patch
  return prisma.$transaction(async (tx) => {
    const current = await tx.recurringTransaction.findFirst({
      where: { id, userId },
      include: { activityPeriods: { orderBy: [{ startDate: "asc" }, { id: "asc" }] } },
    })
    if (!current) return null
    const type = patch.type ?? current.type
    if (patch.categoryId !== undefined || patch.type !== undefined || patch.active === true) {
      const category = await tx.category.findFirst({ where: { id: patch.categoryId ?? current.categoryId, userId, type }, select: { id: true } })
      if (!category) throw new RecurringActivityValidationError("La catégorie doit appartenir à l’utilisateur et être compatible avec le type choisi.")
    }
    if (patch.accountId !== undefined || patch.active === true) {
      const account = await tx.account.findFirst({ where: { id: patch.accountId ?? current.accountId, userId, status: "ACTIVE" }, select: { id: true } })
      if (!account) throw new RecurringActivityValidationError("Le compte doit être un compte actif appartenant à l’utilisateur.")
    }
    const plan = planRecurringActivityTransition(current, { ...fields, confirmPeriodCorrection }, getTodayUtcDayStart())
    for (const period of plan.updates) {
      await tx.recurringActivityPeriod.update({ where: { id: period.id, recurringTransactionId: current.id }, data: {
        startDate: period.startDate, endDate: period.endDate,
        amount: new Prisma.Decimal(String(period.amount)), cancelled: period.cancelled,
        accountId: period.accountId, dayOfMonth: period.dayOfMonth,
      } })
    }
    for (const period of plan.creates) {
      await tx.recurringActivityPeriod.create({ data: {
        recurringTransactionId: current.id, startDate: period.startDate, endDate: period.endDate,
        amount: new Prisma.Decimal(String(period.amount)), cancelled: period.cancelled,
        accountId: period.accountId, dayOfMonth: period.dayOfMonth,
      } })
    }
    const updated = await tx.recurringTransaction.update({
      where: { id: current.id, userId },
      data: {
        ...fields, ...plan.record,
        ...(fields.amount !== undefined ? { amount: new Prisma.Decimal(fields.amount) } : {}),
        ...(fields.title !== undefined && !current.detectionTitleNorm
          ? { detectionTitleNorm: normalizeRecurringTitle(current.title) } : {}),
      },
      include: {
        category: { select: { id: true, name: true, type: true, icon: true, color: true } },
        account: { select: { id: true, name: true, status: true } },
        activityPeriods: { orderBy: [{ startDate: "asc" }, { id: "asc" }] },
        sourceTransactions: {
          where: { transaction: { userId, type: "EXPENSE" } },
          orderBy: { transaction: { date: "desc" } }, take: 1,
          select: { transaction: { select: { date: true } } },
        },
      },
    })
    return serializeRecurringTransaction(updated)
  }, { isolationLevel: "Serializable" })
}
