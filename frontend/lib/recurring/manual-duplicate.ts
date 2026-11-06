/**
 * Compare l'identite et le calendrier d'une charge saisie manuellement a une autre
 * pour detecter un doublon sans se limiter a un titre similaire.
 */
import { normalizeRecurringTitle } from "./detection"

type RecurringIdentity = {
  title: string
  amount: unknown
  type: string
  frequency: string
  accountId: string
  dayOfMonth: number
  startDate: Date
  endDate: Date | null
  detectionTitleNorm?: string | null
}

export function isSameManualRecurringCharge(existing: RecurringIdentity, candidate: RecurringIdentity) {
  return (
    normalizeRecurringTitle(existing.detectionTitleNorm ?? existing.title) === normalizeRecurringTitle(candidate.title) &&
    Number(existing.amount) === Number(candidate.amount) &&
    existing.type === candidate.type &&
    existing.frequency === candidate.frequency &&
    existing.accountId === candidate.accountId &&
    existing.dayOfMonth === candidate.dayOfMonth &&
    (!existing.endDate || existing.endDate >= candidate.startDate) &&
    (!candidate.endDate || candidate.endDate >= existing.startDate)
  )
}
