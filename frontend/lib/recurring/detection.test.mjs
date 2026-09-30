import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { detectRecurringTransactionSuggestions } from "./detection.ts"

const category = {
  id: "cat-phone",
  name: "Telecommunication",
  type: "EXPENSE",
}
const account = {
  id: "acc-main",
  name: "Compte principal",
}

function transaction(id, title, amount, date) {
  return {
    id,
    title,
    amount,
    type: "EXPENSE",
    date: `${date}T00:00:00.000Z`,
    categoryId: category.id,
    category,
    accountId: account.id,
    account,
  }
}

function occurrenceIds(suggestion) {
  return suggestion.occurrences
    .map((occurrence) => occurrence.transactionId)
    .sort()
}

function recurringFromSuggestion(suggestion, title) {
  return {
    title,
    amount: suggestion.estimatedAmount,
    type: suggestion.type,
    frequency: suggestion.frequency,
    dayOfMonth: suggestion.estimatedDayOfMonth,
    active: true,
    accountId: suggestion.accountId,
    detectionTitleNorm: suggestion.title.trim().toLowerCase(),
    detectionAccountId: suggestion.accountId,
    detectionType: suggestion.type,
    sourceTransactionIds: suggestion.occurrences.map(
      (occurrence) => occurrence.transactionId
    ),
    sourceTransactions: suggestion.occurrences.map((occurrence) => ({
      transactionId: occurrence.transactionId,
      date: occurrence.date,
      amount: occurrence.amount,
      title: occurrence.title,
    })),
  }
}

function findSuggestionByOccurrences(suggestions, expectedOccurrenceIds) {
  const sortedExpectedOccurrenceIds = [...expectedOccurrenceIds].sort()

  return suggestions.find(
    (suggestion) =>
      JSON.stringify(occurrenceIds(suggestion)) ===
      JSON.stringify(sortedExpectedOccurrenceIds)
  )
}

describe("detectRecurringTransactionSuggestions", () => {
  it("keeps Apple A and Apple B distinct after confirmation and rename", () => {
    const appleAIds = ["apple-a-jun", "apple-a-jul", "apple-a-aug", "apple-a-sep"]
    const appleBIds = ["apple-b-jun", "apple-b-jul", "apple-b-aug", "apple-b-sep"]
    const appleTransactions = [
      transaction("apple-a-jun", "Apple", 2.99, "2026-06-15"),
      transaction("apple-b-jun", "Apple", 2.99, "2026-06-21"),
      transaction("apple-a-jul", "Apple", 2.99, "2026-07-15"),
      transaction("apple-b-jul", "Apple", 2.99, "2026-07-20"),
      transaction("apple-a-aug", "Apple", 2.99, "2026-08-16"),
      transaction("apple-b-aug", "Apple", 2.99, "2026-08-20"),
      transaction("apple-a-sep", "Apple", 2.99, "2026-09-24"),
      transaction("apple-b-sep", "Apple", 2.99, "2026-09-25"),
    ]
    const initialSuggestions = detectRecurringTransactionSuggestions({
      transactions: appleTransactions,
      recurringTransactions: [],
    })
    const appleA = findSuggestionByOccurrences(initialSuggestions, appleAIds)
    const appleB = findSuggestionByOccurrences(initialSuggestions, appleBIds)

    assert.equal(initialSuggestions.length, 2)
    assert.ok(appleA)
    assert.ok(appleB)

    const confirmedAppleA = recurringFromSuggestion(appleA, "iCloud Apple")
    const afterAppleAConfirmation = detectRecurringTransactionSuggestions({
      transactions: appleTransactions,
      recurringTransactions: [confirmedAppleA],
    })

    assert.equal(afterAppleAConfirmation.length, 1)
    assert.deepEqual(occurrenceIds(afterAppleAConfirmation[0]), [
      ...appleBIds,
    ].sort())

    const confirmedAppleB = recurringFromSuggestion(appleB, "Gmail Apple")
    const afterBothConfirmations = detectRecurringTransactionSuggestions({
      transactions: appleTransactions,
      recurringTransactions: [confirmedAppleA, confirmedAppleB],
    })

    assert.equal(afterBothConfirmations.length, 0)

    const renamedAppleA = {
      ...confirmedAppleA,
      title: "iCloud Julie",
    }
    const afterRename = detectRecurringTransactionSuggestions({
      transactions: appleTransactions,
      recurringTransactions: [renamedAppleA, confirmedAppleB],
    })

    assert.equal(afterRename.length, 0)

    const withOctober = [
      ...appleTransactions,
      transaction("apple-a-oct", "Apple", 2.99, "2026-10-15"),
    ]
    const afterOctober = detectRecurringTransactionSuggestions({
      transactions: withOctober,
      recurringTransactions: [renamedAppleA],
    })

    assert.equal(afterOctober.length, 1)
    assert.deepEqual(occurrenceIds(afterOctober[0]), [...appleBIds].sort())
  })

  it("detects two non-overlapping Free Mobile monthly series", () => {
    const freeMobileTransactions = [
      transaction("fm-a-jun", "Free Mobile", 19.99, "2026-06-05"),
      transaction("fm-a-jul", "Free Mobile", 19.99, "2026-07-08"),
      transaction("fm-b-jul", "Free Mobile", 15.99, "2026-07-16"),
      transaction("fm-a-aug", "Free Mobile", 19.99, "2026-08-05"),
      transaction("fm-b-aug", "Free Mobile", 20.27, "2026-08-19"),
      transaction("fm-a-sep", "Free Mobile", 19.99, "2026-09-06"),
      transaction("fm-b-sep", "Free Mobile", 20.51, "2026-09-07"),
      transaction("fm-isolated", "Free Mobile", 24.98, "2026-09-16"),
    ]
    const suggestions = detectRecurringTransactionSuggestions({
      transactions: freeMobileTransactions,
      recurringTransactions: [],
    })

    assert.equal(suggestions.length, 2)

    const stableSeries = suggestions.find(
      (suggestion) =>
        suggestion.estimatedAmount === 19.99 && suggestion.occurrenceCount === 4
    )
    assert.ok(stableSeries)
    assert.equal(stableSeries.confidence, "HIGH")
    assert.deepEqual(occurrenceIds(stableSeries), [
      "fm-a-aug",
      "fm-a-jul",
      "fm-a-jun",
      "fm-a-sep",
    ])

    const variableSeries = suggestions.find(
      (suggestion) =>
        suggestion.estimatedAmount === 18.92 && suggestion.occurrenceCount === 3
    )
    assert.ok(variableSeries)
    assert.equal(variableSeries.confidence, "HIGH")
    assert.deepEqual(occurrenceIds(variableSeries), [
      "fm-b-aug",
      "fm-b-jul",
      "fm-b-sep",
    ])

    assert.equal(
      suggestions.some((suggestion) =>
        suggestion.occurrences.some(
          (occurrence) => occurrence.transactionId === "fm-isolated"
        )
      ),
      false
    )

    const confirmedStableSeries = recurringFromSuggestion(
      stableSeries,
      "Forfait Free Julie"
    )
    const afterStableConfirmation = detectRecurringTransactionSuggestions({
      transactions: freeMobileTransactions,
      recurringTransactions: [confirmedStableSeries],
    })

    assert.equal(afterStableConfirmation.length, 1)
    assert.deepEqual(occurrenceIds(afterStableConfirmation[0]), [
      "fm-b-aug",
      "fm-b-jul",
      "fm-b-sep",
    ])
  })

  it("keeps Adobe monthly despite one missing calendar month", () => {
    const suggestions = detectRecurringTransactionSuggestions({
      transactions: [
        transaction("adobe-jun", "Adobe", 40.32, "2026-06-25"),
        transaction("adobe-jul", "Adobe", 40.32, "2026-07-24"),
        transaction("adobe-sep", "Adobe", 40.32, "2026-09-07"),
      ],
      recurringTransactions: [],
    })

    assert.equal(suggestions.length, 1)
    assert.equal(suggestions[0].estimatedAmount, 40.32)
    assert.equal(suggestions[0].occurrenceCount, 3)
    assert.equal(suggestions[0].confidence, "HIGH")
    assert.deepEqual(occurrenceIds(suggestions[0]), [
      "adobe-jul",
      "adobe-jun",
      "adobe-sep",
    ])
  })
})
