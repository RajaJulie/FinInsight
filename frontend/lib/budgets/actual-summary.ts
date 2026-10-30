import { toCents } from "./money"

type ActualTransaction = {
  id: string
  type: string
  amount: unknown
  categoryId: string | null
  category?: string
  categoryRelation?: { name: string } | null
}

export type MonthlyActualSummary = {
  transactionCount: number
  income: number
  recurringPaidTotal: number
  remainingAfterRecurringPayments: number
  otherExpenses: { categoryId: string | null; category: string; amount: number }[]
  otherExpensesTotal: number
  totalExpenses: number
  remaining: number
}

export function calculateMonthlyActualSummary(
  transactions: ActualTransaction[],
  matchedTransactionIds: ReadonlySet<string>
): MonthlyActualSummary {
  const uniqueTransactions = [...new Map(transactions.map(transaction => [transaction.id, transaction])).values()]
    .filter(transaction => transaction.type === "INCOME" || transaction.type === "EXPENSE")
  const categories = new Map<string, { categoryId: string | null; category: string; cents: number }>()
  let incomeCents = 0
  let recurringPaidCents = 0
  let otherExpensesCents = 0

  for (const transaction of uniqueTransactions) {
    const cents = toCents(transaction.amount)
    if (transaction.type === "INCOME") {
      incomeCents += cents
    } else if (matchedTransactionIds.has(transaction.id)) {
      recurringPaidCents += cents
    } else {
      const category = transaction.categoryRelation?.name ?? (transaction.category?.trim() || "Sans catégorie")
      const key = transaction.categoryId ? `id:${transaction.categoryId}` : `legacy:${category}`
      const group = categories.get(key) ?? { categoryId: transaction.categoryId, category, cents: 0 }
      group.cents += cents
      categories.set(key, group)
      otherExpensesCents += cents
    }
  }

  return {
    transactionCount: uniqueTransactions.length,
    income: incomeCents / 100,
    recurringPaidTotal: recurringPaidCents / 100,
    remainingAfterRecurringPayments: (incomeCents - recurringPaidCents) / 100,
    otherExpenses: [...categories.values()]
      .sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category, "fr"))
      .map(group => ({ categoryId: group.categoryId, category: group.category, amount: group.cents / 100 })),
    otherExpensesTotal: otherExpensesCents / 100,
    totalExpenses: (recurringPaidCents + otherExpensesCents) / 100,
    remaining: (incomeCents - recurringPaidCents - otherExpensesCents) / 100,
  }
}
