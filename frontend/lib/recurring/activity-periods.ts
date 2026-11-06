/**
 * Resout les periodes d'activite d'une charge, y compris les donnees historiques.
 * Retrouve la periode et le montant applicables a une date sans modifier les enregistrements.
 */
export type RecurringActivityPeriod = {
  id?: string
  startDate: Date | string
  endDate: Date | string | null
  amount?: unknown
  cancelled?: boolean
  accountId?: string | null
  dayOfMonth?: number | null
}

export type RecurringActivity = {
  startDate: Date | string
  endDate: Date | string | null
  amount: unknown
  activityPeriods?: RecurringActivityPeriod[]
}

export function getActivityPeriods(recurring: RecurringActivity) {
  const periods = recurring.activityPeriods?.length
    ? recurring.activityPeriods
    : [{ startDate: recurring.startDate, endDate: recurring.endDate, amount: recurring.amount }]
  return periods.filter((period) => !period.cancelled &&
    (!period.endDate || new Date(period.endDate) >= new Date(period.startDate)))
}

export function getActivityPeriodForDate(recurring: RecurringActivity, date: Date | string) {
  const day = new Date(date).toISOString().slice(0, 10)
  return getActivityPeriods(recurring).find((period) =>
    day >= new Date(period.startDate).toISOString().slice(0, 10) &&
    (!period.endDate || day <= new Date(period.endDate).toISOString().slice(0, 10))
  )
}

export function getActivityAmount(recurring: Pick<RecurringActivity, "amount">, period: RecurringActivityPeriod) {
  return Number(period.amount ?? recurring.amount)
}
