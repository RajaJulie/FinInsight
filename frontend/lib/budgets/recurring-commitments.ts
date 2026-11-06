/**
 * Calcule les charges mensuelles applicables selon leurs periodes d'activite.
 * Distingue les montants prevus, les paiements rapproches et les montants finalement retenus.
 */
import { getActivityAmount, getActivityPeriods, type RecurringActivityPeriod } from "../recurring/activity-periods"

export type RecurringBudgetCommitment = {
  id?: string
  amount: number
  type: "INCOME" | "EXPENSE" | "TRANSFER"
  frequency: "MONTHLY"
  startDate: Date | string
  endDate: Date | string | null
  activityPeriods?: RecurringActivityPeriod[]
}

function toUtcDayStart(date: Date | string) {
  const parsedDate = typeof date === "string" ? new Date(date) : date

  if (Number.isNaN(parsedDate.getTime())) return null

  return new Date(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate()
    )
  )
}

export function getRecurringCommittedTotal({
  recurringTransactions,
  month,
  year,
  actualAmountsByRecurringId,
}: {
  recurringTransactions: RecurringBudgetCommitment[]
  month: number
  year: number
  actualAmountsByRecurringId?: ReadonlyMap<string, number>
}) {
  return getRecurringMonthlyAmounts({ recurringTransactions, month, year, actualAmountsByRecurringId })
    .reduce((total, item) => total + Math.round(item.retainedAmount * 100), 0) / 100
}

export type RecurringMonthlyAmount = {
  recurringTransactionId: string | null
  plannedAmount: number
  actualAmount: number | null
  retainedAmount: number
  difference: number | null
}

export type RecurringPaymentSummary = RecurringMonthlyAmount & {
  recurringTransactionId: string
  title: string
  transactionIds: string[]
}

export function getRecurringMonthlyAmounts({ recurringTransactions, month, year, actualAmountsByRecurringId }: {
  recurringTransactions: RecurringBudgetCommitment[]
  month: number
  year: number
  actualAmountsByRecurringId?: ReadonlyMap<string, number>
}): RecurringMonthlyAmount[] {
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 1))
  const result: RecurringMonthlyAmount[] = []

  for (const recurring of recurringTransactions) {
    if (recurring.type !== "EXPENSE" || recurring.frequency !== "MONTHLY") continue
    const period = getActivityPeriods(recurring)
      .filter((period) => {
        const start = toUtcDayStart(period.startDate)
        const end = period.endDate ? toUtcDayStart(period.endDate) : null
        return start && start < monthEnd && (!end || end >= monthStart)
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]
    // A restart inside the same month still reserves this charge only once.
    if (period) {
      const plannedCents = Math.round(getActivityAmount(recurring, period) * 100)
      const actual = recurring.id ? actualAmountsByRecurringId?.get(recurring.id) : undefined
      const actualCents = actual === undefined ? null : Math.round(actual * 100)
      result.push({
        recurringTransactionId: recurring.id ?? null,
        plannedAmount: plannedCents / 100,
        actualAmount: actualCents === null ? null : actualCents / 100,
        retainedAmount: (actualCents ?? plannedCents) / 100,
        difference: actualCents === null ? null : (actualCents - plannedCents) / 100,
      })
    }
  }

  return result
}
