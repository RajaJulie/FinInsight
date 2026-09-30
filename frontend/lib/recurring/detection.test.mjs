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

describe("detectRecurringTransactionSuggestions", () => {
  it("detects two non-overlapping Free Mobile monthly series", () => {
    const suggestions = detectRecurringTransactionSuggestions({
      transactions: [
        transaction("fm-a-jun", "Free Mobile", 19.99, "2026-06-05"),
        transaction("fm-a-jul", "Free Mobile", 19.99, "2026-07-08"),
        transaction("fm-b-jul", "Free Mobile", 15.99, "2026-07-16"),
        transaction("fm-a-aug", "Free Mobile", 19.99, "2026-08-05"),
        transaction("fm-b-aug", "Free Mobile", 20.27, "2026-08-19"),
        transaction("fm-a-sep", "Free Mobile", 19.99, "2026-09-06"),
        transaction("fm-b-sep", "Free Mobile", 20.51, "2026-09-07"),
        transaction("fm-isolated", "Free Mobile", 24.98, "2026-09-16"),
      ],
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
