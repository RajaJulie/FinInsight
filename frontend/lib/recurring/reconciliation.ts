import { toCents } from "../budgets/money"
import { normalizeRecurringTitle } from "./detection"
import { getActivityAmount, getActivityPeriodForDate, type RecurringActivityPeriod } from "./activity-periods"

export type PaymentTransaction = {
  id: string
  title: string
  amount: number
  type: string
  date: Date | string
  accountId: string | null
  categoryId: string | null
}

export type PaymentRecurringCharge = {
  id: string
  title: string
  amount: unknown
  type: string
  frequency: string
  accountId: string
  dayOfMonth: number
  startDate: Date | string
  endDate: Date | string | null
  detectionTitleNorm: string | null
  sourceTransactions: { transactionId: string }[]
  activityPeriods?: RecurringActivityPeriod[]
}

export type PendingRecurringPayment = {
  transactionId: string
  title: string
  amount: number
  date: string
  candidates: { id: string; title: string; amount: number; dayOfMonth: number }[]
}

function utcDay(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10)
}

export function isPaymentInRecurringPeriod(transaction: PaymentTransaction, recurring: PaymentRecurringCharge) {
  const period = getActivityPeriodForDate(recurring, transaction.date)
  return transaction.type === "EXPENSE" && recurring.type === "EXPENSE" &&
    recurring.frequency === "MONTHLY" && transaction.accountId === (period?.accountId ?? recurring.accountId) &&
    Boolean(period)
}

function getPaymentPeriodAmount(transaction: PaymentTransaction, recurring: PaymentRecurringCharge) {
  const period = getActivityPeriodForDate(recurring, transaction.date)
  return period ? getActivityAmount(recurring, period) : Number(recurring.amount)
}

function hasSameTitle(transaction: PaymentTransaction, recurring: PaymentRecurringCharge) {
  return normalizeRecurringTitle(transaction.title) ===
    (recurring.detectionTitleNorm ?? normalizeRecurringTitle(recurring.title))
}

function isDayCompatible(transaction: PaymentTransaction, recurring: PaymentRecurringCharge) {
  const date = new Date(transaction.date)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  const period = getActivityPeriodForDate(recurring, transaction.date)
  return Math.abs(date.getUTCDate() - Math.min(period?.dayOfMonth ?? recurring.dayOfMonth, lastDay)) <= 4
}

// This is read-only: uncertain matches remain variable until explicitly confirmed.
export function reconcileRecurringPayments(transactions: PaymentTransaction[], charges: PaymentRecurringCharge[]) {
  transactions = [...new Map(transactions.map(transaction => [transaction.id, transaction])).values()]
  const matched = new Map<string, string>()
  const occupied = new Set<string>()
  const linked = new Set<string>()
  const monthKey = (chargeId: string, transaction: PaymentTransaction) => `${chargeId}:${utcDay(transaction.date).slice(0, 7)}`

  for (const transaction of transactions) {
    const sources = charges.filter((charge) => charge.sourceTransactions.some((source) => source.transactionId === transaction.id))
    if (sources.length > 0) linked.add(transaction.id)
    if (sources.length === 1 && isPaymentInRecurringPeriod(transaction, sources[0])) {
      matched.set(transaction.id, sources[0].id)
      occupied.add(monthKey(sources[0].id, transaction))
    }
  }

  const candidateMap = new Map<string, PaymentRecurringCharge[]>()
  const strictMatches = new Map<string, PaymentRecurringCharge[]>()
  for (const transaction of transactions) {
    if (linked.has(transaction.id) || transaction.type !== "EXPENSE") continue
    const candidates = charges.filter((charge) => {
      if (!isPaymentInRecurringPeriod(transaction, charge)) return false
      if (occupied.has(monthKey(charge.id, transaction))) return false
      return hasSameTitle(transaction, charge) ||
        (toCents(transaction.amount) === toCents(getPaymentPeriodAmount(transaction, charge)) && isDayCompatible(transaction, charge))
    })
    candidateMap.set(transaction.id, candidates)
    strictMatches.set(transaction.id, candidates.filter((charge) =>
      hasSameTitle(transaction, charge) && toCents(transaction.amount) === toCents(getPaymentPeriodAmount(transaction, charge)) && isDayCompatible(transaction, charge)
    ))
  }

  for (const transaction of transactions) {
    const strict = strictMatches.get(transaction.id) ?? []
    if (strict.length !== 1) continue
    const charge = strict[0]
    // A second plausible payment in the same month prevents any automatic choice.
    const contenders = transactions.filter((other) =>
      monthKey(charge.id, other) === monthKey(charge.id, transaction) &&
      strictMatches.get(other.id)?.some((candidate) => candidate.id === charge.id)
    )
    if (contenders.length !== 1) continue
    matched.set(transaction.id, charge.id)
  }

  const pending: PendingRecurringPayment[] = transactions.flatMap((transaction) => {
    if (matched.has(transaction.id)) return []
    const candidates = candidateMap.get(transaction.id) ?? []
    if (candidates.length === 0) return []
    return [{
      transactionId: transaction.id, title: transaction.title, amount: transaction.amount,
      date: new Date(transaction.date).toISOString(),
      candidates: candidates.map((charge) => ({ id: charge.id, title: charge.title, amount: getPaymentPeriodAmount(transaction, charge), dayOfMonth: getActivityPeriodForDate(charge, transaction.date)?.dayOfMonth ?? charge.dayOfMonth })),
    }]
  })
  return { matched, pending }
}
