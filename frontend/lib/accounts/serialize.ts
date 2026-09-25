import type {
  Account,
  Transaction,
} from "@/lib/generated/prisma/client"

type AccountWithTransactions = Account & {
  transactions: Pick<Transaction, "amount" | "type" | "date">[]
  incomingTransfers: Pick<Transaction, "amount" | "date">[]
}

export function serializeAccount(account: AccountWithTransactions) {
  const transactionBalance = account.transactions.reduce(
    (balance, transaction) =>
      balance +
      (transaction.type === "INCOME"
        ? transaction.amount
        : -transaction.amount),
    0
  )
  const incomingTransferBalance = account.incomingTransfers.reduce(
    (balance, transaction) => balance + transaction.amount,
    0
  )
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
    currentBalance:
      account.initialBalance + transactionBalance + incomingTransferBalance,
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
