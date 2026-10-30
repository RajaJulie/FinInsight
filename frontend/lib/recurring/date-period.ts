const dateInputPattern = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDateInputToUtcDate(value: string) {
  const match = dateInputPattern.exec(value)

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

export function formatDateInputValue(date: Date | string) {
  const parsedDate = typeof date === "string" ? new Date(date) : date

  if (Number.isNaN(parsedDate.getTime())) return ""

  const year = parsedDate.getUTCFullYear()
  const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(parsedDate.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function formatFrenchDate(date: Date | string | null) {
  if (!date) return "—"

  const inputValue = formatDateInputValue(date)
  if (!inputValue) return "—"

  const [year, month, day] = inputValue.split("-")

  return `${day}/${month}/${year}`
}

export function getFirstOccurrenceDateInput(
  occurrences: { date: string }[]
) {
  const firstOccurrence = [...occurrences].sort(
    (first, second) =>
      new Date(first.date).getTime() - new Date(second.date).getTime()
  )[0]

  return firstOccurrence ? formatDateInputValue(firstOccurrence.date) : ""
}

export function getUtcMonthRange(month: number, year: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  }
}

export function getTodayUtcDayStart() {
  // Civil dates are stored at UTC midnight; the activity action uses the French day.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date())
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")))
}

export function isRecurringPeriodApplicableForMonth({
  startDate,
  endDate,
  month,
  year,
}: {
  startDate: Date | string
  endDate: Date | string | null
  month: number
  year: number
}) {
  const monthRange = getUtcMonthRange(month, year)
  const recurringStart = toUtcDayStart(startDate)
  const recurringEnd = endDate ? toUtcDayStart(endDate) : null

  if (!recurringStart) return false
  if (recurringStart >= monthRange.end) return false
  if (recurringEnd && recurringEnd < monthRange.start) return false

  return true
}

function toUtcDayStart(date: Date | string) {
  const parsedDate = typeof date === "string" ? new Date(date) : date

  if (Number.isNaN(parsedDate.getTime())) return null

  return new Date(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate()
    )
  )
}
