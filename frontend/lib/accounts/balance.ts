import { toCents } from "@/lib/budgets/money"

type Movement = { type: string; amount: unknown }

type SelectableAccount = { id: string; type: string; status: string; currency: string }

export class InvalidAccountScopeError extends Error {}

export function resolveAccountScope(accounts: SelectableAccount[], selectedAccountIds?: string[]) {
  const ids = [...new Set(selectedAccountIds ?? accounts.filter(account =>
    account.status === "ACTIVE" && account.currency === "EUR" && ["CHECKING", "CASH"].includes(account.type)
  ).map(account => account.id))]
  const byId = new Map(accounts.map(account => [account.id, account]))
  if (ids.some(id => !byId.has(id) || byId.get(id)!.currency !== "EUR")) {
    throw new InvalidAccountScopeError("Périmètre de comptes invalide.")
  }
  return ids
}

export function getAccountMovementCents(movement: Movement, sourceIncluded: boolean, destinationIncluded: boolean) {
  const cents = toCents(movement.amount)
  if (movement.type === "TRANSFER") return (destinationIncluded ? cents : 0) - (sourceIncluded ? cents : 0)
  if (!sourceIncluded) return 0
  if (movement.type === "INCOME") return cents
  if (movement.type === "EXPENSE") return -cents
  return 0
}

export function calculateRecordedAccountBalance(account: {
  initialBalance: unknown
  transactions: Movement[]
  incomingTransfers: { amount: unknown }[]
}) {
  const sourceCents = account.transactions.reduce((total, item) => total + getAccountMovementCents(item, true, false), 0)
  const incomingCents = account.incomingTransfers.reduce((total, item) => total + getAccountMovementCents({ ...item, type: "TRANSFER" }, false, true), 0)
  return (toCents(account.initialBalance) + sourceCents + incomingCents) / 100
}
