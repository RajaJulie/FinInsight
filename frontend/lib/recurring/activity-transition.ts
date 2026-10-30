type Period = {
  id?: string
  startDate: Date
  endDate: Date | null
  amount: unknown
  cancelled: boolean
  accountId?: string | null
  dayOfMonth?: number | null
}

type CurrentActivity = {
  active: boolean
  startDate: Date
  endDate: Date | null
  amount: unknown
  activityPeriods: Period[]
  accountId?: string
  dayOfMonth?: number
}

type ActivityPatch = { active?: boolean; startDate?: Date; endDate?: Date | null; amount?: number; accountId?: string; dayOfMonth?: number; confirmPeriodCorrection?: boolean }

export class RecurringActivityValidationError extends Error {}

export function planRecurringActivityTransition(current: CurrentActivity, patch: ActivityPatch, today: Date) {
  const record = { active: patch.active ?? current.active, startDate: current.startDate, endDate: current.endDate }
  const creates: Period[] = []
  const updates: Period[] = []
  const periods = current.activityPeriods.map(period => ({
    ...period, accountId: period.accountId ?? current.accountId, dayOfMonth: period.dayOfMonth ?? current.dayOfMonth,
  })).sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const last = periods.find(period => !period.cancelled && !period.endDate) ??
    periods.filter(period => !period.cancelled).at(-1) ?? periods.at(-1)
  const legacy: Period = { startDate: current.startDate, endDate: current.endDate, amount: current.amount, accountId: current.accountId, dayOfMonth: current.dayOfMonth, cancelled: Boolean(current.endDate && current.endDate < current.startDate) }
  const currentPeriod = last ?? legacy
  const resume = patch.active === true && (!current.active || Boolean(current.endDate && current.endDate < today))
  const stop = patch.active === false && current.active
  const save = (period: Period) => { if (period.id) updates.push(period); else creates.push(period) }

  if (resume) {
    if (!last && !legacy.endDate && legacy.startDate <= today) {
      throw new RecurringActivityValidationError("La fin de la période inactive est inconnue. Renseignez son historique avant de réactiver cette charge.")
    }
    if (!last && legacy.endDate) creates.push(legacy)
    const closedEnds = periods.filter(p => !p.cancelled && p.endDate).map(p => p.endDate!.getTime())
    if (!last && legacy.endDate && !legacy.cancelled) closedEnds.push(legacy.endDate.getTime())
    const earliest = new Date(Math.max(today.getTime(), current.startDate.getTime(), ...closedEnds.map(end => end + 86_400_000)))
    if (patch.startDate && patch.startDate < earliest) {
      throw new RecurringActivityValidationError("La reprise ne peut pas précéder aujourd’hui ni une période déjà clôturée.")
    }
    const startDate = patch.startDate ?? earliest
    const endDate = patch.endDate ?? null
    if (endDate && endDate < startDate) throw new RecurringActivityValidationError("La date de fin doit être postérieure ou égale à la date de reprise.")
    creates.push({ startDate, endDate, amount: patch.amount ?? current.amount, accountId: patch.accountId ?? current.accountId, dayOfMonth: patch.dayOfMonth ?? current.dayOfMonth, cancelled: false })
    record.endDate = endDate
    return { record, creates, updates }
  }

  if (stop) {
    if (patch.startDate !== undefined) throw new RecurringActivityValidationError("La désactivation ne doit pas changer la date de début.")
    if (patch.endDate && patch.endDate > today) throw new RecurringActivityValidationError("Une désactivation immédiate ne peut pas se terminer dans le futur.")
    const endDate = new Date(Math.min(today.getTime(), currentPeriod.endDate?.getTime() ?? Infinity, patch.endDate?.getTime() ?? Infinity))
    const cancelled = currentPeriod.startDate > today || currentPeriod.cancelled
    if (!cancelled && endDate < currentPeriod.startDate) throw new RecurringActivityValidationError("La date de fin précède la période d’activité.")
    // A future period can be cancelled without deleting it or inventing activity.
    if (!last || !currentPeriod.endDate || currentPeriod.endDate >= today) {
      save({ ...currentPeriod, amount: current.amount, endDate: cancelled ? currentPeriod.startDate : endDate, cancelled })
    }
    record.endDate = cancelled ? currentPeriod.startDate : endDate
    return { record, creates, updates }
  }

  const startDate = patch.startDate ?? currentPeriod.startDate
  const endDate = patch.endDate === undefined ? currentPeriod.endDate : patch.endDate
  const changesDates = startDate.getTime() !== currentPeriod.startDate.getTime() ||
    endDate?.getTime() !== currentPeriod.endDate?.getTime()
  const closed = !current.active || Boolean(currentPeriod.endDate && currentPeriod.endDate < today)
  const changesStart = startDate.getTime() !== currentPeriod.startDate.getTime()
  const changesEnd = endDate?.getTime() !== currentPeriod.endDate?.getTime()
  const historicalCorrection = changesDates && (closed ||
    (changesStart && (startDate < today || currentPeriod.startDate < today)) ||
    (changesEnd && Boolean((endDate && endDate < today) || (currentPeriod.endDate && currentPeriod.endDate < today))))
  if (historicalCorrection && !patch.confirmPeriodCorrection) {
    throw new RecurringActivityValidationError("Confirmez explicitement la correction des dates historiques : elle recalculera les mois concernés.")
  }
  if (changesDates && currentPeriod.cancelled) throw new RecurringActivityValidationError("Cette période a été annulée avant son début. Réactivez la charge pour ouvrir une nouvelle période.")
  if (!current.active && !endDate && changesDates) throw new RecurringActivityValidationError("Une charge désactivée doit conserver une date de fin. Utilisez Réactiver pour reprendre l’abonnement.")
  if (endDate && endDate < startDate) throw new RecurringActivityValidationError("La date de fin doit être postérieure ou égale à la date de début.")
  if (changesDates && periods.some(period => period !== last && !period.cancelled && (!period.endDate || startDate <= period.endDate))) {
    throw new RecurringActivityValidationError("La correction ne peut pas chevaucher une autre période d’activité.")
  }

  const changesAmount = patch.amount !== undefined && patch.amount !== Number(currentPeriod.amount)
  const changesSchedule = (patch.accountId !== undefined && patch.accountId !== currentPeriod.accountId) ||
    (patch.dayOfMonth !== undefined && patch.dayOfMonth !== currentPeriod.dayOfMonth)
  const changesTerms = changesAmount || changesSchedule
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const mutableAmount = current.active && (!currentPeriod.endDate || currentPeriod.endDate >= today) && (!endDate || endDate >= today)
  const newTerms = {
    amount: patch.amount ?? currentPeriod.amount,
    accountId: patch.accountId ?? currentPeriod.accountId,
    dayOfMonth: patch.dayOfMonth ?? currentPeriod.dayOfMonth,
  }
  // Freeze legacy snapshot fields before changing the root's current terms.
  if (changesSchedule) {
    for (const period of periods.filter(period => period !== last)) {
      if (current.activityPeriods.some(original => original.id === period.id &&
        (original.accountId == null || original.dayOfMonth == null))) save(period)
    }
  }
  if (changesTerms && mutableAmount && startDate < monthStart) {
    // Preserve previous months at their former price; never rewrite a closed period.
    save({ ...currentPeriod, startDate, endDate: new Date(monthStart.getTime() - 86_400_000) })
    creates.push({ startDate: monthStart, endDate, ...newTerms, cancelled: false })
  } else if (changesDates || (changesTerms && mutableAmount)) {
    save({ ...currentPeriod, startDate, endDate, ...(mutableAmount ? newTerms : {}) })
  } else if (changesSchedule && last) {
    save(currentPeriod)
  } else if (!last && changesTerms && closed) {
    creates.push(legacy)
  }
  if (patch.startDate && !periods.some(period => period !== last && !period.cancelled)) record.startDate = patch.startDate
  if (patch.endDate !== undefined) record.endDate = patch.endDate
  return { record, creates, updates }
}
