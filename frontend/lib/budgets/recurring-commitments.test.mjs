import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { loadTs } from "../testing/load-ts.mjs"
const { getRecurringCommittedTotal } = loadTs("lib/budgets/recurring-commitments.ts")
import { calculateBudgetSummary } from "./summary.ts"

function commitment(overrides = {}) {
  return {
    categoryId: "telecom", amount: 50, active: true, type: "EXPENSE",
    frequency: "MONTHLY", startDate: "2026-10-01", endDate: null, ...overrides,
  }
}

function total(recurringTransactions, month, year = 2026) {
  return getRecurringCommittedTotal({ recurringTransactions, month, year })
}

describe("monthly variable budget planning", () => {
  it("returns the exact expected available and free amounts in cents", () => {
    assert.deepEqual(calculateBudgetSummary({
      monthlyIncome: 465.90, recurringCommittedTotal: 179.41,
      emergencyReserve: 50, budgetAmounts: [200, 30], spent: 80,
    }), {
      monthlyIncome: 465.90, recurringCommittedTotal: 179.41,
      emergencyReserve: 50, availableForBudgets: 236.49,
      variableBudgetAllocated: 230, spent: 80, freeMoney: 6.49,
    })
  })

  it("treats a missing reserve and an explicit zero identically", () => {
    const base = { monthlyIncome: 100, recurringCommittedTotal: 10, budgetAmounts: [], spent: 0 }
    assert.equal(calculateBudgetSummary(base).emergencyReserve, 0)
    assert.deepEqual(calculateBudgetSummary(base), calculateBudgetSummary({ ...base, emergencyReserve: 0 }))
  })

  it("reserves recurring telecom charges separately from a variable envelope", () => {
    const recurringCommittedTotal = total([commitment({ amount: 63.64 }), commitment({ amount: 19.99 })], 10)
    assert.equal(recurringCommittedTotal, 83.63)
    const result = calculateBudgetSummary({ monthlyIncome: 150, recurringCommittedTotal, budgetAmounts: [20], spent: 83.63 })
    assert.equal(result.variableBudgetAllocated, 20)
    assert.equal(result.freeMoney, 46.37)
    assert.equal(result.spent, 83.63)
  })

  it("counts recurring expenses even with no budgets", () => {
    const result = calculateBudgetSummary({ monthlyIncome: 150, recurringCommittedTotal: total([commitment()], 10), budgetAmounts: [], spent: 0 })
    assert.equal(result.freeMoney, 100)
  })

  it("counts Pathé only from its start month onward", () => {
    assert.equal(total([commitment()], 9), 0)
    assert.equal(total([commitment()], 10), 50)
    assert.equal(total([commitment()], 11), 50)
  })

  it("counts inactive Adobe in covered historical months and not after its end", () => {
    const adobe = commitment({ active: false, amount: 40.32, startDate: "2026-06-25", endDate: "2026-10-31" })
    assert.equal(total([adobe], 5), 0)
    assert.equal(total([adobe], 6), 40.32)
    assert.equal(total([adobe], 9), 40.32)
    assert.equal(total([adobe], 10), 40.32)
    assert.equal(total([adobe], 11), 0)
  })

  it("includes an end date on the first day and excludes a start in the next month", () => {
    assert.equal(total([commitment({ startDate: "2026-09-01", endDate: "2026-10-01" })], 10), 50)
    assert.equal(total([commitment({ startDate: "2026-11-01" })], 10), 0)
  })

  it("adds all categories without any dependency on budget existence", () => {
    assert.equal(total([commitment({ amount: 2.99 }), commitment({ amount: 2.99, categoryId: "software" }), commitment({ amount: 19.99 })], 10), 25.97)
  })

  it("excludes INCOME, TRANSFER and non-monthly frequencies", () => {
    assert.equal(total([commitment({ type: "INCOME" }), commitment({ type: "TRANSFER" }), commitment({ frequency: "YEARLY" })], 10), 0)
  })

  it("keeps month boundaries in UTC without local day shifts", () => {
    const item = commitment({ startDate: "2026-10-01T00:00:00.000Z" })
    assert.equal(total([item], 9), 0)
    assert.equal(total([item], 10), 50)
  })

  it("preserves negative available and free amounts", () => {
    const result = calculateBudgetSummary({ monthlyIncome: 50, recurringCommittedTotal: 80, emergencyReserve: 10, budgetAmounts: [20], spent: 0 })
    assert.equal(result.availableForBudgets, -40)
    assert.equal(result.freeMoney, -60)
  })

  it("never adds planned charges or reserves to spent", () => {
    assert.equal(calculateBudgetSummary({ monthlyIncome: 100, recurringCommittedTotal: 50, emergencyReserve: 10, budgetAmounts: [20], spent: 7.99 }).spent, 7.99)
  })
})
