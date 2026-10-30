import { getAccountMovementCents, resolveAccountScope } from "./balance"
import { toCents } from "@/lib/budgets/money"
import type { ScopeAccount } from "./scope-summary"

export type HistoricalMovement = {
  id: string
  date: Date | string
  createdAt?: Date | string
  type: string
  amount: unknown
  accountId: string | null
  destinationAccountId: string | null
}

export function compareTransactionsChronologically(first: HistoricalMovement, second: HistoricalMovement) {
  const dateOrder = new Date(first.date).getTime() - new Date(second.date).getTime()
  if (dateOrder) return dateOrder
  const creationOrder = new Date(first.createdAt ?? first.date).getTime() - new Date(second.createdAt ?? second.date).getTime()
  if (creationOrder) return creationOrder
  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0
}

export function buildAccountBalanceHistory({ accounts, transactions, selectedAccountIds }: {
  accounts: ScopeAccount[]
  transactions: HistoricalMovement[]
  selectedAccountIds?: string[]
}) {
  const selected = new Set(resolveAccountScope(accounts, selectedAccountIds))
  const initialCents = accounts.filter(account => selected.has(account.id))
    .reduce((total, account) => total + toCents(account.initialBalance), 0)
  let balanceCents = initialCents
  const entries = []

  // Build the entire ledger before applying any display/search filters.
  const ordered = [...new Map(transactions.map(item => [item.id, item])).values()]
    .sort(compareTransactionsChronologically)
  for (const transaction of ordered) {
    const source = selected.has(transaction.accountId ?? "")
    const destination = transaction.type === "TRANSFER" && selected.has(transaction.destinationAccountId ?? "")
    if (!source && !destination) continue
    const movementCents = getAccountMovementCents(transaction, source, destination)
    const beforeCents = balanceCents
    balanceCents += movementCents
    entries.push({ transactionId: transaction.id, date: new Date(transaction.date), beforeCents, afterCents: balanceCents, movementCents })
  }
  return { selectedAccountIds: [...selected], initialCents, entries }
}
