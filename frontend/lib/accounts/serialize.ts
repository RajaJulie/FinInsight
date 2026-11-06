/**
 * Prepare les comptes Prisma pour les reponses JSON en ajoutant leur solde
 * calcule avec la fonction de solde commune au projet.
 */
import type {
  Account,
  Transaction,
} from "@/lib/generated/prisma/client"
import { calculateRecordedAccountBalance } from "./balance"

type AccountWithTransactions = Account & {
  transactions: Pick<Transaction, "amount" | "type" | "date">[]
  incomingTransfers: Pick<Transaction, "amount" | "date">[]
}

export function serializeAccount(account: AccountWithTransactions) {
  const activityDates = [
    ...account.transactions.map((transaction) => transaction.date),
    ...account.incomingTransfers.map((transaction) => transaction.date),
  ]
  const lastActivity = activityDates.reduce<Date | null>(
    (latestDate, date) =>
      !latestDate || date > latestDate
        ? date
        : latestDate,
    null
  )

  return {
    id: account.id,
    name: account.name,
    type: account.type,
    initialBalance: account.initialBalance,
    currentBalance: calculateRecordedAccountBalance(account),
    currency: account.currency,
    icon: account.icon,
    color: account.color,
    status: account.status,
    isPrimary: account.isPrimary,
    transactionCount:
      account.transactions.length + account.incomingTransfers.length,
    lastActivity,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }
}
