/**
 * Prepare une charge Prisma pour le JSON en convertissant ses montants
 * et en exposant les informations disponibles sur ses paiements sources.
 */
export function serializeRecurringTransaction<T extends {
  amount: unknown
  activityPeriods?: { amount: unknown }[]
  sourceTransactions?: { transactionId?: string; transaction?: { date: Date | string } }[]
}>(item: T) {
  return {
    ...item,
    amount: Number(item.amount),
    ...(item.activityPeriods ? { activityPeriods: item.activityPeriods.map(period => ({ ...period, amount: Number(period.amount) })) } : {}),
    lastPaymentDate: item.sourceTransactions?.[0]?.transaction?.date ?? null,
  }
}
