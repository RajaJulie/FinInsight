export type RecurringConfirmationSuggestion = {
  suggestionId: string
  title: string
  type: "INCOME" | "EXPENSE"
  estimatedAmount: number
  frequency: "MONTHLY"
  estimatedDayOfMonth: number
  categoryId: string | null
  accountId: string | null
  occurrences: { date: string }[]
}

export type RecurringConfirmationFormValues = {
  title: string
  amount: number
  categoryId: string
  accountId: string
  frequency: "MONTHLY"
  dayOfMonth: number
  active: boolean
  startDate: string
  endDate: string
}

export type RecurringConfirmationPayload = Omit<
  RecurringConfirmationFormValues,
  "endDate"
> & {
  suggestionId: string
  type: "EXPENSE"
  endDate: string | null
}

export type RecurringConfirmationValidationResult =
  | { success: true; payload: RecurringConfirmationPayload }
  | { success: false; message: string }

export type RecurringConfirmErrorBody = {
  message?: string
  errors?: {
    formErrors?: string[]
    fieldErrors?: Record<string, string[] | undefined>
  }
}

export function getRecurringConfirmationDefaults(
  suggestion: RecurringConfirmationSuggestion
): RecurringConfirmationFormValues {
  return {
    title: suggestion.title,
    amount: suggestion.estimatedAmount,
    categoryId: suggestion.categoryId ?? "",
    accountId: suggestion.accountId ?? "",
    frequency: "MONTHLY",
    dayOfMonth: suggestion.estimatedDayOfMonth,
    active: true,
    startDate: getFirstOccurrenceDateInput(suggestion.occurrences),
    endDate: "",
  }
}

export function validateRecurringConfirmation({
  suggestionId,
  values,
}: {
  suggestionId: string
  values: RecurringConfirmationFormValues
}): RecurringConfirmationValidationResult {
  const title = values.title.trim()

  if (!suggestionId.trim()) {
    return { success: false, message: "La suggestion est introuvable." }
  }

  if (!title) {
    return { success: false, message: "Le titre est obligatoire." }
  }

  if (!Number.isFinite(values.amount) || values.amount <= 0) {
    return {
      success: false,
      message: "Le montant doit être un nombre supérieur à 0.",
    }
  }

  if (!values.categoryId.trim()) {
    return { success: false, message: "La catégorie est obligatoire." }
  }

  if (!values.accountId.trim()) {
    return { success: false, message: "Le compte est obligatoire." }
  }

  if (
    !Number.isInteger(values.dayOfMonth) ||
    values.dayOfMonth < 1 ||
    values.dayOfMonth > 31
  ) {
    return {
      success: false,
      message: "Le jour du mois doit être compris entre 1 et 31.",
    }
  }

  const startDate = parseDateInputToUtcDate(values.startDate)
  const endDate = values.endDate ? parseDateInputToUtcDate(values.endDate) : null

  if (!startDate) {
    return { success: false, message: "La date de début est obligatoire." }
  }

  if (values.endDate && !endDate) {
    return { success: false, message: "La date de fin est invalide." }
  }

  if (endDate && endDate < startDate) {
    return {
      success: false,
      message: "La date de fin doit être postérieure ou égale à la date de début.",
    }
  }

  return {
    success: true,
    payload: {
      suggestionId,
      title,
      amount: values.amount,
      type: "EXPENSE",
      categoryId: values.categoryId,
      accountId: values.accountId,
      frequency: "MONTHLY",
      dayOfMonth: values.dayOfMonth,
      active: values.active,
      startDate: values.startDate,
      endDate: values.endDate || null,
    },
  }
}

export function getRecurringConfirmErrorMessage(
  status: number,
  body: RecurringConfirmErrorBody
) {
  if (status === 400) {
    const fieldErrors = Object.values(body.errors?.fieldErrors ?? {})
      .flatMap((errors) => errors ?? [])
      .filter(Boolean)
    const formErrors = body.errors?.formErrors ?? []
    const validationErrors = [...formErrors, ...fieldErrors]

    return validationErrors[0] ?? body.message ?? "Données invalides."
  }

  if (status === 404 || status === 409) {
    return (
      body.message ??
      "Cette suggestion est introuvable ou a déjà été confirmée."
    )
  }

  return body.message ?? "Impossible de confirmer cette dépense récurrente."
}

function getFirstOccurrenceDateInput(occurrences: { date: string }[]) {
  const firstOccurrence = [...occurrences].sort(
    (first, second) =>
      new Date(first.date).getTime() - new Date(second.date).getTime()
  )[0]

  return firstOccurrence ? formatDateInputValue(firstOccurrence.date) : ""
}

function formatDateInputValue(date: Date | string) {
  const parsedDate = typeof date === "string" ? new Date(date) : date

  if (Number.isNaN(parsedDate.getTime())) return ""

  const year = parsedDate.getUTCFullYear()
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(parsedDate.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function parseDateInputToUtcDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}
