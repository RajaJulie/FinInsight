/**
 * Prepare les valeurs et les modifications du formulaire de charge recurrente.
 * Distingue la periode editable des anciennes periodes et signale les corrections historiques.
 */
import { formatDateInputValue, getTodayUtcDayStart } from "./date-period"

export type RecurringChargeData = {
  id: string
  title: string
  amount: number
  type: "EXPENSE" | "INCOME" | "TRANSFER"
  frequency: "MONTHLY"
  dayOfMonth: number
  active: boolean
  startDate: string
  endDate: string | null
  lastPaymentDate?: string | null
  activityPeriods?: { id: string; startDate: string; endDate: string | null; cancelled: boolean }[]
  category: { id: string; name: string; type: "EXPENSE" | "INCOME" | "TRANSFER"; icon?: string; color?: string }
  account: { id: string; name: string; status: "ACTIVE" | "ARCHIVED" }
}

export type RecurringChargeFormValues = {
  title: string
  amount: string
  categoryId: string
  accountId: string
  dayOfMonth: string
  startDate: string
  endDate: string
}

export function getRecurringEditPeriod(charge: RecurringChargeData) {
  const periods = [...(charge.activityPeriods ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate))
  return periods.find(period => !period.cancelled && !period.endDate) ??
    periods.filter(period => !period.cancelled).at(-1) ?? periods.at(-1) ?? charge
}

export function getRecurringChargeFormValues(charge: RecurringChargeData | undefined, month: number, year: number): RecurringChargeFormValues {
  const period = charge ? getRecurringEditPeriod(charge) : null
  return {
    title: charge?.title ?? "",
    amount: charge ? charge.amount.toFixed(2).replace(".", ",") : "",
    categoryId: charge?.category.id ?? "",
    accountId: charge?.account.id ?? "",
    dayOfMonth: String(charge?.dayOfMonth ?? 1),
    startDate: period ? formatDateInputValue(period.startDate) : `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: period?.endDate ? formatDateInputValue(period.endDate) : "",
  }
}

export function getRecurringChargeEditPayload(values: RecurringChargeFormValues, charge: RecurringChargeData) {
  const initial = getRecurringChargeFormValues(charge, 1, 2000)
  const payload: { title?: string; amount?: number; categoryId?: string; accountId?: string; frequency?: "MONTHLY"; dayOfMonth?: number; startDate?: string; endDate?: string | null; confirmPeriodCorrection?: boolean } = {}
  if (values.title.trim() !== charge.title) payload.title = values.title.trim()
  if (Number(values.amount.replace(",", ".")) !== charge.amount) payload.amount = Number(values.amount.replace(",", "."))
  if (values.categoryId !== charge.category.id) payload.categoryId = values.categoryId
  if (values.accountId !== charge.account.id) payload.accountId = values.accountId
  if (Number(values.dayOfMonth) !== charge.dayOfMonth) payload.dayOfMonth = Number(values.dayOfMonth)
  if (values.startDate !== initial.startDate) payload.startDate = values.startDate
  if (values.endDate !== initial.endDate) payload.endDate = values.endDate || null
  return payload
}

export function needsRecurringPeriodCorrection(values: RecurringChargeFormValues, charge: RecurringChargeData, today = formatDateInputValue(getTodayUtcDayStart())) {
  const initial = getRecurringChargeFormValues(charge, 1, 2000)
  const changesStart = values.startDate !== initial.startDate
  const changesEnd = values.endDate !== initial.endDate
  const closed = !charge.active || Boolean(initial.endDate && initial.endDate < today)
  return (changesStart || changesEnd) && (closed ||
    (changesStart && (values.startDate < today || initial.startDate < today)) ||
    (changesEnd && Boolean((values.endDate && values.endDate < today) || (initial.endDate && initial.endDate < today))))
}
