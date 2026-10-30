import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loadTs } from "../testing/load-ts.mjs"

const { calculateAccountScopeSummary, InvalidAccountScopeError } = loadTs("lib/accounts/scope-summary.ts")
const { calculateRecordedAccountBalance } = loadTs("lib/accounts/balance.ts")
const { serializeAccount } = loadTs("lib/accounts/serialize.ts")
const { calculateMonthlyActualSummary } = loadTs("lib/budgets/actual-summary.ts")
const accounts = [
  { id: "lcl", name: "Compte LCL", type: "CHECKING", status: "ACTIVE", currency: "EUR", initialBalance: 0 },
  { id: "revolut", name: "Revolut", type: "CHECKING", status: "ACTIVE", currency: "EUR", initialBalance: 0 },
  { id: "life", name: "Assurance-vie", type: "SAVINGS", status: "ACTIVE", currency: "EUR", initialBalance: 0 },
  { id: "invest", name: "Investissement", type: "INVESTMENT", status: "ACTIVE", currency: "EUR", initialBalance: 0 },
  { id: "excluded", name: "Autre", type: "OTHER", status: "ACTIVE", currency: "EUR", initialBalance: 0 },
]
const movement = (id, type, amount, accountId, destinationAccountId = null, day = "2026-10-10") => ({ id, type, amount, accountId, destinationAccountId, date: new Date(`${day}T00:00:00Z`), categoryId: null })
const summarize = (transactions, overrides = {}) => calculateAccountScopeSummary({ accounts, transactions, month: 10, year: 2026, ...overrides })

describe("account scope movements in cents", () => {
  for (const [source, destination] of [["lcl", "revolut"], ["revolut", "lcl"]]) {
    it(`cancels a transfer ${source} -> ${destination} within the default scope`, () => {
      const data = summarize([movement("transfer", "TRANSFER", 200, source, destination)])
      assert.equal(data.closingVariation, 0)
      assert.equal(data.transfersIn, 0)
      assert.equal(data.transfersOut, 0)
      assert.equal(data.income, 0)
      assert.equal(data.expenses, 0)
      assert.deepEqual(data.selectedAccountIds, ["lcl", "revolut"])
    })
  }
  it("counts transfers to savings once, without treating them as expenses", () => {
    const transfer = movement("transfer", "TRANSFER", 100, "lcl", "life")
    const data = summarize([transfer, transfer])
    assert.equal(data.closingVariation, -100)
    assert.equal(data.transfersOut, 100)
    assert.equal(data.transferredToSavings, 100)
    assert.equal(data.cumulativeTransferredToSavings, 100)
    assert.equal(data.expenses, 0)
    const all = summarize([transfer], { selectedAccountIds: ["lcl", "revolut", "life"] })
    assert.equal(all.closingVariation, 0)
    assert.equal(all.transferredToSavings, 0)
  })
  it("counts returns from savings as inbound movements, never income", () => {
    const data = summarize([movement("return", "TRANSFER", 100, "life", "lcl")])
    assert.equal(data.closingVariation, 100)
    assert.equal(data.transfersIn, 100)
    assert.equal(data.income, 0)
    assert.equal(data.transferredToSavings, 0)
  })
  it("distinguishes other excluded accounts from savings and supports a single-account scope", () => {
    const data = summarize([movement("excluded", "TRANSFER", 12.34, "lcl", "excluded"), movement("invest", "TRANSFER", 3.21, "lcl", "invest")])
    assert.equal(data.closingVariation, -15.55)
    assert.equal(data.transferredToSavings, 3.21)
    const single = summarize([movement("internal", "TRANSFER", 200, "lcl", "revolut")], { selectedAccountIds: ["revolut"] })
    assert.equal(single.closingVariation, 200)
    assert.equal(single.transfersIn, 200)
  })
  it("keeps the monthly financial result unchanged when transfers are added", () => {
    const actual = [movement("income", "INCOME", 625.9, "lcl"), movement("expense", "EXPENSE", 170.35, "revolut")]
    const transfers = [movement("toSavings", "TRANSFER", 100, "lcl", "life"), movement("internal", "TRANSFER", 200, "revolut", "lcl")]
    assert.equal(calculateMonthlyActualSummary(actual, new Set()).remaining, 455.55)
    assert.equal(calculateMonthlyActualSummary([...actual, ...transfers], new Set()).remaining, 455.55)
    assert.equal(summarize([...actual, ...transfers]).closingVariation, 355.55)
  })
  it("carries multiple months with savings transfers and preserves negative amounts", () => {
    const rows = [
      movement("june-income", "INCOME", 500, "lcl", null, "2026-06-01"), movement("june-expense", "EXPENSE", 333.19, "revolut", null, "2026-06-15"),
      movement("june-savings", "TRANSFER", 100, "lcl", "life", "2026-06-18"),
      movement("july-income", "INCOME", 200, "lcl", null, "2026-07-01"), movement("july-expense", "EXPENSE", 373.44, "revolut", null, "2026-07-15"),
      movement("july-savings", "TRANSFER", 100, "lcl", "life", "2026-07-20"),
      movement("aug-income", "INCOME", 500, "lcl", null, "2026-08-01"), movement("aug-expense", "EXPENSE", 40.65, "revolut", null, "2026-08-15"),
      movement("aug-savings", "TRANSFER", 100, "lcl", "life", "2026-08-18"),
    ]
    const june = summarize(rows, { month: 6 })
    const july = summarize(rows, { month: 7 })
    const august = summarize(rows, { month: 8 })
    assert.equal(june.closingVariation, 66.81)
    assert.equal(july.previousVariation, 66.81)
    assert.equal(july.closingVariation, -206.63)
    assert.equal(august.previousVariation, -206.63)
    assert.equal(august.closingVariation, 152.72)
    assert.equal(august.cumulativeTransferredToSavings, 300)
    assert.equal(summarize(rows).previousVariation, 152.72)
    assert.equal(summarize(rows).closingVariation, 152.72)
  })
  it("excludes future movements and expenses on unselected or unassigned accounts", () => {
    const data = summarize([
      movement("future", "INCOME", 999, "lcl", null, "2026-11-01"),
      movement("savingsExpense", "EXPENSE", 12, "life"), movement("unassigned", "EXPENSE", 15, null),
    ])
    assert.equal(data.closingVariation, 0)
    assert.equal(data.unassignedTransactionCount, 1)
    assert.equal(data.expenses, 0)
  })
  it("does not assume a zero bank reference for default openings or incomplete histories", () => {
    for (const initialBalance of [0, 125.67, -25.31]) {
      const data = summarize([movement("first-known", "EXPENSE", 10.31, "lcl")], { accounts: [{ ...accounts[0], initialBalance }] })
      assert.equal(data.closingVariation, -10.31)
      assert.equal(data.recordedOpeningBalance, initialBalance)
      assert.equal(data.bankBalance, null)
    }
  })
  it("reuses the existing account balance calculation with nonzero openings in cents", () => {
    const account = { ...accounts[0], initialBalance: 25.31, transactions: [
      { amount: 0.1, type: "INCOME", date: new Date() }, { amount: 0.2, type: "INCOME", date: new Date() },
      { amount: 10.31, type: "EXPENSE", date: new Date() }, { amount: 100, type: "TRANSFER", date: new Date() },
    ], incomingTransfers: [{ amount: 200, date: new Date() }] }
    assert.equal(calculateRecordedAccountBalance(account), 115.3)
    assert.equal(serializeAccount(account).currentBalance, 115.3)
    assert.equal(serializeAccount(account).initialBalance, 25.31)
  })
  it("keeps cent arithmetic exact and deduplicates transactions", () => {
    const first = movement("a", "INCOME", 0.1, "lcl")
    const data = summarize([first, first, movement("b", "INCOME", 0.2, "lcl"), movement("c", "TRANSFER", 0.3, "lcl", "life")])
    assert.equal(data.income, 0.3)
    assert.equal(data.closingVariation, 0)
    assert.equal(data.transferredToSavings, 0.3)
  })
  it("rejects unknown and unsupported-currency accounts, never silently substitutes another scope", () => {
    assert.throws(() => summarize([], { selectedAccountIds: ["foreign"] }), InvalidAccountScopeError)
    assert.throws(() => summarize([], { accounts: [{ ...accounts[0], currency: "USD" }], selectedAccountIds: ["lcl"] }), InvalidAccountScopeError)
    assert.equal(summarize([], { selectedAccountIds: [] }).closingVariation, 0)
  })
})
