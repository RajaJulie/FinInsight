export type DetectableTransactionType = "INCOME" | "EXPENSE"
export type RecurringSuggestionConfidence = "POSSIBLE" | "HIGH"

export type DetectableTransaction = {
  id: string
  title: string
  amount: number
  type: DetectableTransactionType | "TRANSFER"
  date: Date | string
  categoryId: string | null
  accountId: string | null
  category: {
    id: string
    name: string
    type: DetectableTransactionType | "TRANSFER"
  } | null
  account: {
    id: string
    name: string
  } | null
}

export type DetectableRecurringTransaction = {
  title: string
  amount: number
  type: DetectableTransactionType
  frequency: "MONTHLY"
  dayOfMonth: number
  active: boolean
  accountId: string
}

export type RecurringSuggestionOccurrence = {
  transactionId: string
  date: string
  amount: number
  title: string
}

export type RecurringTransactionSuggestion = {
  suggestionId: string
  title: string
  type: DetectableTransactionType
  estimatedAmount: number
  frequency: "MONTHLY"
  estimatedDayOfMonth: number
  confidence: RecurringSuggestionConfidence
  occurrenceCount: number
  categoryId: string | null
  category: {
    id: string
    name: string
    type: DetectableTransactionType | "TRANSFER"
  } | null
  accountId: string | null
  account: {
    id: string
    name: string
  } | null
  occurrences: RecurringSuggestionOccurrence[]
}

type CandidateGroup = {
  key: string
  transactions: DetectableTransaction[]
}

type CandidateSequence = {
  transactions: DetectableTransaction[]
  occurrenceIds: Set<string>
}

const MIN_OCCURRENCES = 2
const HIGH_CONFIDENCE_OCCURRENCES = 3

// Banking monthly charges can shift a few days around weekends or processing
// delays. Four days accepts 15/14/16 while staying strict enough for the MVP.
const MONTHLY_DAY_TOLERANCE_DAYS = 4

// A real monthly history can miss one imported month. Accept at most one
// calendar-month gap inside a sequence; larger gaps are too weak for this MVP.
const MAX_MISSING_MONTHS_IN_SEQUENCE = 1
const MAX_MONTH_GAP_BETWEEN_OCCURRENCES =
  MAX_MISSING_MONTHS_IN_SEQUENCE + 1

// Variable recurring bills are accepted only when every occurrence stays close
// to the sequence average: up to 10%, capped at 5 EUR to avoid broad grouping.
const AMOUNT_RELATIVE_TOLERANCE = 0.1
const AMOUNT_ABSOLUTE_TOLERANCE_CAP = 5
const AMOUNT_MINIMUM_TOLERANCE = 0.02

export function normalizeRecurringTitle(title: string) {
  return title.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")
}

export function isAmountWithinRecurringTolerance(amounts: number[]) {
  if (amounts.length === 0) return false

  const average = averageNumber(amounts)
  const tolerance = Math.max(
    AMOUNT_MINIMUM_TOLERANCE,
    Math.min(
      AMOUNT_ABSOLUTE_TOLERANCE_CAP,
      Math.abs(average) * AMOUNT_RELATIVE_TOLERANCE
    )
  )

  return amounts.every((amount) => Math.abs(amount - average) <= tolerance)
}

export function estimateRecurringAmount(amounts: number[]) {
  return roundMoney(averageNumber(amounts))
}

export function estimateRecurringDayOfMonth(dates: Date[]) {
  const estimatedDay = Math.round(
    averageNumber(dates.map((date) => date.getUTCDate()))
  )

  return Math.min(31, Math.max(1, estimatedDay))
}

export function detectRecurringTransactionSuggestions({
  transactions,
  recurringTransactions,
}: {
  transactions: DetectableTransaction[]
  recurringTransactions: DetectableRecurringTransaction[]
}) {
  const activeRecurringTransactions = recurringTransactions.filter(
    (transaction) => transaction.active && transaction.frequency === "MONTHLY"
  )
  const suggestions = groupCandidateTransactions(transactions)
    .flatMap((group) =>
      buildSuggestionsForGroup(group, activeRecurringTransactions)
    )

  return suggestions.sort((first, second) => {
    if (second.occurrenceCount !== first.occurrenceCount) {
      return second.occurrenceCount - first.occurrenceCount
    }

    return first.title.localeCompare(second.title, "fr")
  })
}

function groupCandidateTransactions(transactions: DetectableTransaction[]) {
  const groups = new Map<string, CandidateGroup>()

  for (const transaction of transactions) {
    if (transaction.type !== "INCOME" && transaction.type !== "EXPENSE") {
      continue
    }

    const normalizedTitle = normalizeRecurringTitle(transaction.title)
    if (!normalizedTitle) continue

    const key = [
      transaction.type,
      normalizedTitle,
      transaction.accountId ?? "no-account",
    ].join("|")
    const group = groups.get(key) ?? { key, transactions: [] }

    group.transactions.push(transaction)
    groups.set(key, group)
  }

  return Array.from(groups.values()).filter(
    (group) => group.transactions.length >= MIN_OCCURRENCES
  )
}

function buildSuggestionsForGroup(
  group: CandidateGroup,
  activeRecurringTransactions: DetectableRecurringTransaction[]
) {
  const sortedTransactions = [...group.transactions].sort(
    (first, second) => toDate(first.date).getTime() - toDate(second.date).getTime()
  )
  const candidateSequences = getCandidateSequences(sortedTransactions).filter(
    (candidate) =>
      !isAlreadyConfirmedRecurringSuggestion(
        buildSuggestionFromSequence(candidate.transactions),
        activeRecurringTransactions
      )
  )
  const selectedSequences = selectNonOverlappingSequences(candidateSequences)

  return selectedSequences.map((sequence) =>
    buildSuggestionFromSequence(sequence.transactions)
  )
}

function getCandidateSequences(transactions: DetectableTransaction[]) {
  const candidates = new Map<string, CandidateSequence>()

  for (const [index, transaction] of transactions.entries()) {
    extendCandidateSequence({
      sequence: [transaction],
      startIndex: index + 1,
      transactions,
      candidates,
    })
  }

  return Array.from(candidates.values())
}

function extendCandidateSequence({
  sequence,
  startIndex,
  transactions,
  candidates,
}: {
  sequence: DetectableTransaction[]
  startIndex: number
  transactions: DetectableTransaction[]
  candidates: Map<string, CandidateSequence>
}) {
  if (sequence.length >= MIN_OCCURRENCES && isRecurringSequenceCoherent(sequence)) {
    const key = getSequenceKey(sequence)

    candidates.set(key, {
      transactions: sequence,
      occurrenceIds: new Set(sequence.map((transaction) => transaction.id)),
    })
  }

  for (let index = startIndex; index < transactions.length; index += 1) {
    const transaction = transactions[index]
    const lastTransaction = sequence[sequence.length - 1]

    if (toDate(transaction.date) <= toDate(lastTransaction.date)) continue
    if (!isMonthlyOccurrenceWithinAllowedGap(lastTransaction, transaction)) {
      continue
    }
    const nextSequence = [...sequence, transaction]
    if (!isMissingMonthGapAllowed(nextSequence)) continue
    if (
      !isAmountSequencePotentiallyCoherent(nextSequence) ||
      !isDateSequencePotentiallyCoherent(nextSequence)
    ) {
      continue
    }

    extendCandidateSequence({
      sequence: nextSequence,
      startIndex: index + 1,
      transactions,
      candidates,
    })
  }
}

function selectNonOverlappingSequences(candidates: CandidateSequence[]) {
  const sortedCandidates = [...candidates].sort(compareCandidateSequences)
  let bestSelection: CandidateSequence[] = []

  function visit(
    index: number,
    selected: CandidateSequence[],
    usedTransactionIds: Set<string>
  ) {
    if (index >= sortedCandidates.length) {
      if (isBetterSequenceSelection(selected, bestSelection)) {
        bestSelection = selected
      }

      return
    }

    const candidate = sortedCandidates[index]
    const hasOverlap = Array.from(candidate.occurrenceIds).some((id) =>
      usedTransactionIds.has(id)
    )

    if (!hasOverlap) {
      const nextUsedTransactionIds = new Set(usedTransactionIds)

      for (const id of candidate.occurrenceIds) {
        nextUsedTransactionIds.add(id)
      }

      visit(index + 1, [...selected, candidate], nextUsedTransactionIds)
    }

    visit(index + 1, selected, usedTransactionIds)
  }

  visit(0, [], new Set())

  return bestSelection.sort(compareCandidateSequences)
}

function compareCandidateSequences(
  first: CandidateSequence,
  second: CandidateSequence
) {
  if (second.transactions.length !== first.transactions.length) {
    return second.transactions.length - first.transactions.length
  }

  return (
    getSequenceAmountSpread(first.transactions) -
    getSequenceAmountSpread(second.transactions)
  )
}

function isBetterSequenceSelection(
  candidateSelection: CandidateSequence[],
  currentSelection: CandidateSequence[]
) {
  const candidateOccurrences = getSelectionOccurrenceCount(candidateSelection)
  const currentOccurrences = getSelectionOccurrenceCount(currentSelection)

  if (candidateOccurrences !== currentOccurrences) {
    return candidateOccurrences > currentOccurrences
  }

  if (candidateSelection.length !== currentSelection.length) {
    return candidateSelection.length < currentSelection.length
  }

  return (
    getSelectionAmountSpread(candidateSelection) <
    getSelectionAmountSpread(currentSelection)
  )
}

function getSelectionOccurrenceCount(selection: CandidateSequence[]) {
  return selection.reduce(
    (total, candidate) => total + candidate.transactions.length,
    0
  )
}

function getSelectionAmountSpread(selection: CandidateSequence[]) {
  return selection.reduce(
    (total, candidate) => total + getSequenceAmountSpread(candidate.transactions),
    0
  )
}

function isMonthlyOccurrenceWithinAllowedGap(
  previous: DetectableTransaction,
  next: DetectableTransaction
) {
  const previousDate = toDate(previous.date)
  const nextDate = toDate(next.date)
  const monthDiff = getMonthIndex(nextDate) - getMonthIndex(previousDate)

  return monthDiff >= 1 && monthDiff <= MAX_MONTH_GAP_BETWEEN_OCCURRENCES
}

function isMissingMonthGapAllowed(sequence: DetectableTransaction[]) {
  const sortedSequence = [...sequence].sort(
    (first, second) => toDate(first.date).getTime() - toDate(second.date).getTime()
  )
  const missingMonths = sortedSequence
    .slice(1)
    .reduce((total, transaction, index) => {
      const previousTransaction = sortedSequence[index]
      const monthDiff =
        getMonthIndex(toDate(transaction.date)) -
        getMonthIndex(toDate(previousTransaction.date))

      return total + Math.max(0, monthDiff - 1)
    }, 0)

  return missingMonths <= MAX_MISSING_MONTHS_IN_SEQUENCE
}

function isRecurringSequenceCoherent(sequence: DetectableTransaction[]) {
  return (
    isMissingMonthGapAllowed(sequence) &&
    isDateCoherentWithSequence(sequence) &&
    isAmountSequenceCoherent(sequence)
  )
}

function isAmountSequencePotentiallyCoherent(sequence: DetectableTransaction[]) {
  return (
    isAmountSequenceCoherent(sequence) ||
    sequence.length < HIGH_CONFIDENCE_OCCURRENCES
  )
}

function isAmountSequenceCoherent(sequence: DetectableTransaction[]) {
  const sortedSequence = [...sequence].sort(
    (first, second) => toDate(first.date).getTime() - toDate(second.date).getTime()
  )
  const amounts = sortedSequence.map((transaction) => transaction.amount)

  if (isAmountWithinRecurringTolerance(amounts)) {
    return true
  }

  if (sortedSequence.length < HIGH_CONFIDENCE_OCCURRENCES) {
    return false
  }

  const [firstAmount, ...remainingAmounts] = amounts

  return (
    isAmountWithinRecurringTolerance(remainingAmounts) &&
    isIntroductoryAmountWithinTolerance(firstAmount, remainingAmounts)
  )
}

function isIntroductoryAmountWithinTolerance(
  amount: number,
  recurringAmounts: number[]
) {
  const average = averageNumber(recurringAmounts)
  const tolerance = Math.max(
    AMOUNT_MINIMUM_TOLERANCE,
    Math.min(AMOUNT_ABSOLUTE_TOLERANCE_CAP, Math.abs(average) * 0.25)
  )

  return Math.abs(amount - average) <= tolerance
}

function isDateSequencePotentiallyCoherent(sequence: DetectableTransaction[]) {
  return (
    isDateCoherentWithSequence(sequence) ||
    sequence.length < HIGH_CONFIDENCE_OCCURRENCES
  )
}

function isDateCoherentWithSequence(sequence: DetectableTransaction[]) {
  const sortedSequence = [...sequence].sort(
    (first, second) => toDate(first.date).getTime() - toDate(second.date).getTime()
  )
  const hasMissingMonth = sortedSequence.some((transaction, index) => {
    if (index === 0) return false

    const previousTransaction = sortedSequence[index - 1]

    return (
      getMonthIndex(toDate(transaction.date)) -
        getMonthIndex(toDate(previousTransaction.date)) >
      1
    )
  })

  if (!hasMissingMonth) {
    const dates = sortedSequence.map((transaction) => toDate(transaction.date))
    const estimatedDay = estimateRecurringDayOfMonth(dates)

    if (dates.every(
      (date) =>
        Math.abs(date.getUTCDate() - estimatedDay) <= MONTHLY_DAY_TOLERANCE_DAYS
    )) {
      return true
    }

    return isSingleDateOutlierAllowed(sortedSequence)
  }

  const consecutivePairs = sortedSequence
    .slice(1)
    .map((transaction, index) => [sortedSequence[index], transaction] as const)
    .filter(
      ([previousTransaction, transaction]) =>
        getMonthIndex(toDate(transaction.date)) -
          getMonthIndex(toDate(previousTransaction.date)) ===
        1
    )

  return (
    sortedSequence.length >= HIGH_CONFIDENCE_OCCURRENCES &&
    consecutivePairs.length > 0 &&
    consecutivePairs.every(([previousTransaction, transaction]) => {
      const estimatedDay = estimateRecurringDayOfMonth([
        toDate(previousTransaction.date),
        toDate(transaction.date),
      ])

      return [previousTransaction, transaction].every(
        (item) =>
          Math.abs(toDate(item.date).getUTCDate() - estimatedDay) <=
          MONTHLY_DAY_TOLERANCE_DAYS
      )
    })
  )
}

function isSingleDateOutlierAllowed(sequence: DetectableTransaction[]) {
  if (sequence.length < HIGH_CONFIDENCE_OCCURRENCES) {
    return false
  }

  return sequence.some((_, indexToRemove) => {
    const remainingDates = sequence
      .filter((__, index) => index !== indexToRemove)
      .map((transaction) => toDate(transaction.date))
    const estimatedDay = estimateRecurringDayOfMonth(remainingDates)

    return remainingDates.every(
      (date) =>
        Math.abs(date.getUTCDate() - estimatedDay) <= MONTHLY_DAY_TOLERANCE_DAYS
    )
  })
}

function buildSuggestionFromSequence(
  sequence: DetectableTransaction[]
): RecurringTransactionSuggestion {
  const sortedSequence = [...sequence].sort(
    (first, second) => toDate(first.date).getTime() - toDate(second.date).getTime()
  )
  const firstTransaction = sortedSequence[0]
  const category = getMostFrequentCategory(sortedSequence)
  const dates = sortedSequence.map((transaction) => toDate(transaction.date))
  const amounts = sortedSequence.map((transaction) => transaction.amount)

  return {
    suggestionId: getSuggestionId(sortedSequence),
    title: getDisplayTitle(sortedSequence),
    type: firstTransaction.type as DetectableTransactionType,
    estimatedAmount: estimateRecurringAmount(amounts),
    frequency: "MONTHLY" as const,
    estimatedDayOfMonth: estimateRecurringDayOfMonth(dates),
    confidence:
      sortedSequence.length >= HIGH_CONFIDENCE_OCCURRENCES
        ? ("HIGH" as const)
        : ("POSSIBLE" as const),
    occurrenceCount: sortedSequence.length,
    categoryId: category?.id ?? null,
    category,
    accountId: firstTransaction.accountId,
    account: firstTransaction.account,
    occurrences: sortedSequence.map((transaction) => ({
      transactionId: transaction.id,
      date: toDate(transaction.date).toISOString(),
      amount: transaction.amount,
      title: transaction.title,
    })),
  }
}

function getSuggestionId(sequence: DetectableTransaction[]) {
  const firstTransaction = sequence[0]
  const occurrencePart = sequence
    .map((transaction) => transaction.id)
    .sort()
    .join(".")

  return [
    firstTransaction.type,
    normalizeRecurringTitle(firstTransaction.title),
    firstTransaction.accountId ?? "no-account",
    occurrencePart,
  ].join(":")
}

function isAlreadyConfirmedRecurringSuggestion(
  suggestion: RecurringTransactionSuggestion,
  recurringTransactions: DetectableRecurringTransaction[]
) {
  return recurringTransactions.some((recurringTransaction) => {
    if (recurringTransaction.type !== suggestion.type) return false
    if (recurringTransaction.accountId !== suggestion.accountId) return false
    if (
      normalizeRecurringTitle(recurringTransaction.title) !==
      normalizeRecurringTitle(suggestion.title)
    ) {
      return false
    }
    if (
      Math.abs(
        recurringTransaction.dayOfMonth - suggestion.estimatedDayOfMonth
      ) > MONTHLY_DAY_TOLERANCE_DAYS
    ) {
      return false
    }

    return isAmountWithinConfirmedRecurringTolerance(
      recurringTransaction.amount,
      suggestion.estimatedAmount
    )
  })
}

function isAmountWithinConfirmedRecurringTolerance(
  confirmedAmount: number,
  estimatedAmount: number
) {
  const average = averageNumber([confirmedAmount, estimatedAmount])
  const tolerance = Math.max(0.05, Math.min(1, Math.abs(average) * 0.01))

  return Math.abs(confirmedAmount - estimatedAmount) <= tolerance
}

function getMostFrequentCategory(transactions: DetectableTransaction[]) {
  const counts = new Map<
    string,
    { category: NonNullable<DetectableTransaction["category"]>; count: number }
  >()

  for (const transaction of transactions) {
    if (!transaction.categoryId || !transaction.category) continue

    const current = counts.get(transaction.categoryId) ?? {
      category: transaction.category,
      count: 0,
    }

    current.count += 1
    counts.set(transaction.categoryId, current)
  }

  return Array.from(counts.values()).sort(
    (first, second) => second.count - first.count
  )[0]?.category ?? null
}

function getDisplayTitle(transactions: DetectableTransaction[]) {
  return transactions
    .map((transaction) => transaction.title.trim())
    .sort((first, second) => first.length - second.length)[0]
}

function getSequenceKey(sequence: DetectableTransaction[]) {
  return sequence
    .map((transaction) => transaction.id)
    .sort()
    .join("|")
}

function getSequenceAmountSpread(sequence: DetectableTransaction[]) {
  const amounts = sequence.map((transaction) => transaction.amount)

  return Math.max(...amounts) - Math.min(...amounts)
}

function getMonthIndex(date: Date) {
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

function toDate(date: Date | string) {
  return date instanceof Date ? date : new Date(date)
}

function averageNumber(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100
}
