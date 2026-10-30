import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  getRecurringConfirmErrorMessage,
  getRecurringConfirmationDefaults,
  validateRecurringConfirmation,
} from "./confirmation-form.ts"

function suggestion(overrides = {}) {
  return {
    suggestionId: "EXPENSE:apple:acc-main:apple-a-jun.apple-a-jul",
    title: "Apple",
    type: "EXPENSE",
    estimatedAmount: 2.99,
    frequency: "MONTHLY",
    estimatedDayOfMonth: 15,
    categoryId: "cat-software",
    accountId: "acc-main",
    occurrences: [
      {
        transactionId: "apple-a-jun",
        date: "2026-06-15T00:00:00.000Z",
        amount: 2.99,
        title: "Apple",
      },
      {
        transactionId: "apple-a-jul",
        date: "2026-07-15T00:00:00.000Z",
        amount: 2.99,
        title: "Apple",
      },
    ],
    ...overrides,
  }
}

describe("recurring confirmation form helpers", () => {
  it("prefills the form from the selected suggestion", () => {
    assert.deepEqual(getRecurringConfirmationDefaults(suggestion()), {
      title: "Apple",
      amount: 2.99,
      categoryId: "cat-software",
      accountId: "acc-main",
      frequency: "MONTHLY",
      dayOfMonth: 15,
      active: true,
      startDate: "2026-06-15",
      endDate: "",
    })
  })

  it("keeps the exact suggestionId and sends only backend accepted fields", () => {
    const result = validateRecurringConfirmation({
      suggestionId: "EXPENSE:apple:acc-main:apple-a-jun.apple-a-jul",
      values: {
        title: "gmail apple",
        amount: 2.99,
        categoryId: "cat-software",
        accountId: "acc-main",
        frequency: "MONTHLY",
        dayOfMonth: 15,
        active: true,
        startDate: "2026-06-15",
        endDate: "",
      },
    })

    assert.equal(result.success, true)
    assert.deepEqual(Object.keys(result.payload).sort(), [
      "accountId",
      "active",
      "amount",
      "categoryId",
      "dayOfMonth",
      "endDate",
      "frequency",
      "startDate",
      "suggestionId",
      "title",
      "type",
    ])
    assert.equal(
      result.payload.suggestionId,
      "EXPENSE:apple:acc-main:apple-a-jun.apple-a-jul"
    )
    assert.equal(result.payload.title, "gmail apple")
    assert.equal(result.payload.type, "EXPENSE")
    assert.equal(result.payload.startDate, "2026-06-15")
    assert.equal(result.payload.endDate, null)
  })

  it("allows Apple A and Apple B to be confirmed independently", () => {
    const appleA = validateRecurringConfirmation({
      suggestionId: "EXPENSE:apple:acc-main:apple-a-jun.apple-a-jul",
      values: getRecurringConfirmationDefaults(
        suggestion({
          suggestionId: "EXPENSE:apple:acc-main:apple-a-jun.apple-a-jul",
        })
      ),
    })
    const appleB = validateRecurringConfirmation({
      suggestionId: "EXPENSE:apple:acc-main:apple-b-jun.apple-b-jul",
      values: getRecurringConfirmationDefaults(
        suggestion({
          suggestionId: "EXPENSE:apple:acc-main:apple-b-jun.apple-b-jul",
        })
      ),
    })

    assert.equal(appleA.success, true)
    assert.equal(appleB.success, true)
    assert.notEqual(appleA.payload.suggestionId, appleB.payload.suggestionId)
  })

  it("keeps Free Mobile distinct by suggestionId and estimated amount", () => {
    const stable = validateRecurringConfirmation({
      suggestionId: "EXPENSE:free mobile:acc-main:fm-a-jun.fm-a-jul",
      values: getRecurringConfirmationDefaults(
        suggestion({
          suggestionId: "EXPENSE:free mobile:acc-main:fm-a-jun.fm-a-jul",
          title: "Free Mobile",
          estimatedAmount: 19.99,
        })
      ),
    })
    const variable = validateRecurringConfirmation({
      suggestionId: "EXPENSE:free mobile:acc-main:fm-b-jul.fm-b-aug",
      values: getRecurringConfirmationDefaults(
        suggestion({
          suggestionId: "EXPENSE:free mobile:acc-main:fm-b-jul.fm-b-aug",
          title: "Free Mobile",
          estimatedAmount: 18.92,
        })
      ),
    })

    assert.equal(stable.success, true)
    assert.equal(variable.success, true)
    assert.equal(stable.payload.amount, 19.99)
    assert.equal(variable.payload.amount, 18.92)
    assert.notEqual(stable.payload.suggestionId, variable.payload.suggestionId)
  })

  it("rejects missing and invalid fields before writing", () => {
    assert.equal(
      validateRecurringConfirmation({
        suggestionId: "suggestion",
        values: {
          title: "",
          amount: 2.99,
          categoryId: "cat",
          accountId: "acc",
          frequency: "MONTHLY",
          dayOfMonth: 15,
          active: true,
          startDate: "2026-06-15",
          endDate: "",
        },
      }).success,
      false
    )
    assert.equal(
      validateRecurringConfirmation({
        suggestionId: "suggestion",
        values: {
          title: "Apple",
          amount: 0,
          categoryId: "cat",
          accountId: "acc",
          frequency: "MONTHLY",
          dayOfMonth: 15,
          active: true,
          startDate: "2026-06-15",
          endDate: "",
        },
      }).success,
      false
    )
    assert.equal(
      validateRecurringConfirmation({
        suggestionId: "suggestion",
        values: {
          title: "Apple",
          amount: 2.99,
          categoryId: "",
          accountId: "acc",
          frequency: "MONTHLY",
          dayOfMonth: 15,
          active: true,
          startDate: "2026-06-15",
          endDate: "",
        },
      }).success,
      false
    )
    assert.equal(
      validateRecurringConfirmation({
        suggestionId: "suggestion",
        values: {
          title: "Apple",
          amount: 2.99,
          categoryId: "cat",
          accountId: "",
          frequency: "MONTHLY",
          dayOfMonth: 15,
          active: true,
          startDate: "2026-06-15",
          endDate: "",
        },
      }).success,
      false
    )
    assert.equal(
      validateRecurringConfirmation({
        suggestionId: "suggestion",
        values: {
          title: "Apple",
          amount: 2.99,
          categoryId: "cat",
          accountId: "acc",
          frequency: "MONTHLY",
          dayOfMonth: 32,
          active: true,
          startDate: "2026-06-15",
          endDate: "",
        },
      }).success,
      false
    )
  })

  it("rejects an end date before the start date", () => {
    const result = validateRecurringConfirmation({
      suggestionId: "suggestion",
      values: {
        title: "Apple",
        amount: 2.99,
        categoryId: "cat",
        accountId: "acc",
        frequency: "MONTHLY",
        dayOfMonth: 15,
        active: true,
        startDate: "2026-10-01",
        endDate: "2026-09-30",
      },
    })

    assert.equal(result.success, false)
  })

  it("formats useful API error messages", () => {
    assert.equal(
      getRecurringConfirmErrorMessage(400, {
        message: "Données invalides.",
        errors: {
          fieldErrors: {
            amount: ["Le montant doit être supérieur à 0."],
          },
        },
      }),
      "Le montant doit être supérieur à 0."
    )
    assert.equal(
      getRecurringConfirmErrorMessage(404, {
        message: "Suggestion introuvable ou déjà confirmée.",
      }),
      "Suggestion introuvable ou déjà confirmée."
    )
    assert.equal(
      getRecurringConfirmErrorMessage(409, {
        message: "Suggestion déjà confirmée.",
      }),
      "Suggestion déjà confirmée."
    )
    assert.equal(
      getRecurringConfirmErrorMessage(500, { message: "Erreur serveur." }),
      "Erreur serveur."
    )
  })
})
