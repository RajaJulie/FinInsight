import { getAccountMovementCents } from "./balance"
import { buildAccountBalanceHistory } from "./history"
export { InvalidAccountScopeError } from "./balance"
import { toCents } from "@/lib/budgets/money"

export type ScopeAccount = {
  id: string
  name: string
  type: string
  status: string
  currency: string
  initialBalance: unknown
}

type ScopeTransaction = {
  id: string
  amount: unknown
  type: string
  date: Date
  createdAt?: Date
  accountId: string | null
  destinationAccountId: string | null
}

export type AccountScopeSummary = {
  accounts: Omit<ScopeAccount, "initialBalance">[]
  selectedAccountIds: string[]
  previousVariation: number
  income: number
  expenses: number
  transfersIn: number
  transfersOut: number
  netTransfers: number
  transferredToSavings: number
  cumulativeTransferredToSavings: number
  closingVariation: number
  recordedOpeningBalance: number
  bankBalance: null
  openingBalance: number | null
  closingBalance: number | null
  monthlyResult: number
  firstRecordedMovement: string | null
  unassignedTransactionCount: number
}

export function calculateAccountScopeSummary({ accounts, transactions, selectedAccountIds, month, year }: {
  accounts: ScopeAccount[]
  transactions: ScopeTransaction[]
  selectedAccountIds?: string[]
  month: number
  year: number
}): AccountScopeSummary {
  const history = buildAccountBalanceHistory({ accounts, transactions, selectedAccountIds })
  const selected = new Set(history.selectedAccountIds)
  const byId = new Map(accounts.map(account => [account.id, account]))
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  let previous = 0, income = 0, expenses = 0, transfersIn = 0, transfersOut = 0
  let savings = 0, cumulativeSavings = 0, unassigned = 0
  const first = history.entries[0]
  const beforeMonth = history.entries.filter(entry => entry.date < start).at(-1)
  const throughMonth = history.entries.filter(entry => entry.date < end).at(-1)

  for (const transaction of new Map(transactions.map(item => [item.id, item])).values()) {
    if (transaction.date >= end) continue
    const source = selected.has(transaction.accountId ?? "")
    const destination = selected.has(transaction.destinationAccountId ?? "")
    const cents = toCents(transaction.amount)
    const currentMonth = transaction.date >= start
    if (["INCOME", "EXPENSE"].includes(transaction.type) && !transaction.accountId) unassigned++
    if (!currentMonth) previous += getAccountMovementCents(transaction, source, destination)
    if (transaction.type === "TRANSFER") {
      if (source && !destination) {
        if (currentMonth) transfersOut += cents
        const target = byId.get(transaction.destinationAccountId ?? "")
        if (target && ["SAVINGS", "INVESTMENT"].includes(target.type)) {
          cumulativeSavings += cents
          if (currentMonth) savings += cents
        }
      }
      if (!source && destination && currentMonth) transfersIn += cents
    } else if (source && currentMonth) {
      if (transaction.type === "INCOME") income += cents
      if (transaction.type === "EXPENSE") expenses += cents
    }
  }

  return {
    accounts: accounts.map(({ id, name, type, status, currency }) => ({ id, name, type, status, currency })),
    selectedAccountIds: [...selected],
    previousVariation: previous / 100,
    income: income / 100,
    expenses: expenses / 100,
    transfersIn: transfersIn / 100,
    transfersOut: transfersOut / 100,
    netTransfers: (transfersIn - transfersOut) / 100,
    transferredToSavings: savings / 100,
    cumulativeTransferredToSavings: cumulativeSavings / 100,
    closingVariation: (previous + income - expenses + transfersIn - transfersOut) / 100,
    recordedOpeningBalance: accounts.filter(account => selected.has(account.id)).reduce((total, account) => total + toCents(account.initialBalance), 0) / 100,
    // A dated, verified bank reference is not stored by the current Account model.
    bankBalance: null,
    openingBalance: beforeMonth ? beforeMonth.afterCents / 100 : first && first.date <= start ? history.initialCents / 100 : null,
    closingBalance: throughMonth ? throughMonth.afterCents / 100 : null,
    monthlyResult: (income - expenses) / 100,
    firstRecordedMovement: first?.date.toISOString() ?? null,
    unassignedTransactionCount: unassigned,
  }
}
