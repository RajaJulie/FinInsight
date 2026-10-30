import { prisma } from "@/lib/prisma"
import { toCents } from "./money"
import { calculateAccountScopeSummary, type AccountScopeSummary } from "@/lib/accounts/scope-summary"

export type CumulativeMonthlyResult = {
  previousMonthsResult: number
  closingResult: number
  recordedOpeningBalance: number
  bankBalance: null
  accountScope?: AccountScopeSummary
}

type HistoricalTransaction = { id: string; type: string; amount: unknown }

export function calculateCumulativeMonthlyResult({ previousTransactions, monthlyResult, accounts }: {
  previousTransactions: HistoricalTransaction[]
  monthlyResult: number
  accounts: { initialBalance: unknown }[]
}): CumulativeMonthlyResult {
  let previousCents = 0
  for (const transaction of new Map(previousTransactions.map(item => [item.id, item])).values()) {
    if (transaction.type === "INCOME") previousCents += toCents(transaction.amount)
    if (transaction.type === "EXPENSE") previousCents -= toCents(transaction.amount)
  }

  return {
    previousMonthsResult: previousCents / 100,
    closingResult: (previousCents + toCents(monthlyResult)) / 100,
    recordedOpeningBalance: accounts.reduce((total, account) => total + toCents(account.initialBalance), 0) / 100,
    // Account has no dated opening reference or verified history: this is not a bank balance.
    bankBalance: null,
  }
}

export async function getCumulativeMonthlyResult(userId: string, month: number, year: number, monthlyResult: number, selectedAccountIds?: string[]) {
  const [transactions, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: { in: ["INCOME", "EXPENSE", "TRANSFER"] }, date: { lt: new Date(Date.UTC(year, month, 1)) } },
      select: { id: true, type: true, amount: true, date: true, createdAt: true, accountId: true, destinationAccountId: true },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, status: true, currency: true, initialBalance: true },
    }),
  ])
  const previousTransactions = transactions.filter(transaction => transaction.date < new Date(Date.UTC(year, month - 1, 1)))
  return {
    ...calculateCumulativeMonthlyResult({ previousTransactions, monthlyResult, accounts }),
    accountScope: calculateAccountScopeSummary({ accounts, transactions, selectedAccountIds, month, year }),
  }
}
