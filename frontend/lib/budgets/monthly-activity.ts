import { prisma } from "@/lib/prisma"
import { reconcileRecurringPayments } from "@/lib/recurring/reconciliation"
import { getRecurringMonthlyAmounts } from "@/lib/budgets/recurring-commitments"
import { sumMoney, toCents } from "@/lib/budgets/money"
import { calculateMonthlyActualSummary } from "@/lib/budgets/actual-summary"

export async function getMonthlyBudgetActivity(userId: string, month: number, year: number) {
  const [transactions, recurringTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) } },
      select: {
        id: true, title: true, amount: true, type: true, date: true, accountId: true, categoryId: true,
        category: true, categoryRelation: { select: { name: true } },
      },
    }),
    prisma.recurringTransaction.findMany({
      where: { userId, type: "EXPENSE", frequency: "MONTHLY" },
      select: {
        id: true, title: true, amount: true, type: true, frequency: true, accountId: true, dayOfMonth: true,
        startDate: true, endDate: true, detectionTitleNorm: true, sourceTransactions: { select: { transactionId: true } },
        activityPeriods: { select: { id: true, startDate: true, endDate: true, amount: true, cancelled: true, accountId: true, dayOfMonth: true } },
      },
    }),
  ])
  const expenses = [...new Map(transactions.filter((transaction) => transaction.type === "EXPENSE").map(transaction => [transaction.id, transaction])).values()]
  const reconciliation = reconcileRecurringPayments(expenses, recurringTransactions)
  const actualCentsByRecurringId = new Map<string, number>()
  const centsByCategory = new Map<string, number>()
  for (const transaction of expenses) {
    const chargeId = reconciliation.matched.get(transaction.id)
    if (chargeId) {
      actualCentsByRecurringId.set(chargeId, (actualCentsByRecurringId.get(chargeId) ?? 0) + toCents(transaction.amount))
      continue
    }
    if (!transaction.categoryId) continue
    centsByCategory.set(transaction.categoryId, (centsByCategory.get(transaction.categoryId) ?? 0) + toCents(transaction.amount))
  }
  const monthlyRecurringAmounts = getRecurringMonthlyAmounts({
    recurringTransactions: recurringTransactions.map((item) => ({ ...item, amount: Number(item.amount) })), month, year,
    actualAmountsByRecurringId: new Map([...actualCentsByRecurringId].map(([id, cents]) => [id, cents / 100])),
  })
  return {
    actualSummary: calculateMonthlyActualSummary(transactions, new Set(reconciliation.matched.keys())),
    monthlyIncome: sumMoney(transactions.filter((transaction) => transaction.type === "INCOME").map((transaction) => transaction.amount)),
    recurringCommittedTotal: sumMoney(monthlyRecurringAmounts.map((item) => item.retainedAmount)),
    recurringPayments: monthlyRecurringAmounts.flatMap(item => item.recurringTransactionId ? [{
      ...item,
      recurringTransactionId: item.recurringTransactionId,
      title: recurringTransactions.find(charge => charge.id === item.recurringTransactionId)!.title,
      transactionIds: [...reconciliation.matched].filter(([, chargeId]) => chargeId === item.recurringTransactionId).map(([id]) => id),
    }] : []),
    spentByCategory: new Map([...centsByCategory].map(([id, cents]) => [id, cents / 100])),
    pendingPayments: reconciliation.pending,
  }
}
