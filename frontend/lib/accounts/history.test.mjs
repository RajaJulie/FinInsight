/**
 * Teste la reconstruction des soldes par compte et combines : ordre stable,
 * transferts, doublons, soldes negatifs et independance vis-a-vis des filtres d'affichage.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loadTs } from "../testing/load-ts.mjs"

const { buildAccountBalanceHistory } = loadTs("lib/accounts/history.ts")
const { calculateAccountScopeSummary } = loadTs("lib/accounts/scope-summary.ts")
const { calculateRecordedAccountBalance } = loadTs("lib/accounts/balance.ts")
const accounts = [
  { id: "lcl", name: "Compte LCL", type: "CHECKING", currency: "EUR", status: "ACTIVE", initialBalance: 100.1 },
  { id: "revolut", name: "Revolut", type: "CHECKING", currency: "EUR", status: "ACTIVE", initialBalance: 50.2 },
  { id: "life", name: "Assurance-vie", type: "SAVINGS", currency: "EUR", status: "ACTIVE", initialBalance: 200 },
]
const transaction = (id, type, amount, accountId, destinationAccountId = null, day = "2026-06-01", createdAt = `${day}T12:00:00Z`) => ({
  id, type, amount, accountId, destinationAccountId, date: new Date(`${day}T00:00:00Z`), createdAt: new Date(createdAt),
})
const sample = () => [
  transaction("income", "INCOME", 1000, "lcl"),
  transaction("expense", "EXPENSE", 30.31, "revolut", null, "2026-06-02"),
  transaction("internal", "TRANSFER", 200, "lcl", "revolut", "2026-06-03"),
  transaction("savings", "TRANSFER", 100, "lcl", "life", "2026-06-04"),
  transaction("return", "TRANSFER", 20, "life", "lcl", "2026-06-05"),
]
const history = (transactions = sample(), selectedAccountIds) => buildAccountBalanceHistory({ accounts, transactions, selectedAccountIds })

describe("deterministic bank balance history", () => {
  it("replays LCL, Revolut and combined balances from the recorded openings in cents", () => {
    assert.deepEqual(history(sample(), ["lcl"]).entries.map(e => e.afterCents), [110010, 90010, 80010, 82010])
    assert.deepEqual(history(sample(), ["revolut"]).entries.map(e => e.afterCents), [1989, 21989])
    assert.deepEqual(history().entries.map(e => e.afterCents), [115030, 111999, 111999, 101999, 103999])
    assert.equal(history().initialCents, 15030)
    assert.equal(history().entries[2].movementCents, 0)
  })
  it("agrees with the existing single-account balance and keeps negative amounts", () => {
    const transactions = [...sample(), transaction("large", "EXPENSE", 2000, "lcl", null, "2026-06-06")]
    const entries = history(transactions, ["lcl"]).entries
    const current = calculateRecordedAccountBalance({
      initialBalance: accounts[0].initialBalance,
      transactions: transactions.filter(t => t.accountId === "lcl"),
      incomingTransfers: transactions.filter(t => t.type === "TRANSFER" && t.destinationAccountId === "lcl"),
    })
    assert.equal(entries.at(-1).afterCents / 100, current)
    assert.equal(current, -1179.9)
  })
  it("orders date ties by creation time then ID, regardless of input or display direction", () => {
    const early = transaction("z", "INCOME", 0.1, "lcl", null, "2026-06-01", "2026-06-02T08:00:00Z")
    const a = transaction("a", "EXPENSE", 0.2, "lcl", null, "2026-06-01", "2026-06-02T09:00:00Z")
    const b = transaction("b", "INCOME", 0.3, "lcl", null, "2026-06-01", "2026-06-02T09:00:00Z")
    const expected = history([b, early, a], ["lcl"])
    assert.deepEqual(expected.entries.map(e => e.transactionId), ["z", "a", "b"])
    assert.deepEqual(expected.entries.map(e => e.afterCents), [10020, 10000, 10030])
    assert.deepEqual(history([a, b, early], ["lcl"]), expected)
  })
  it("computes balances before search, category, type or date filters", () => {
    const complete = history().entries
    const filtered = complete.filter(entry => entry.transactionId === "expense")
    assert.equal(filtered[0].afterCents, 111999)
    assert.equal([...complete].reverse().find(entry => entry.transactionId === "expense").afterCents, 111999)
    assert.notEqual(history(sample().filter(t => t.id === "expense")).entries[0].afterCents, filtered[0].afterCents)
  })
  it("deduplicates rows and excludes unrelated or unassigned operations without mutating the inputs", () => {
    const rows = sample()
    rows.push(rows[0], transaction("other", "EXPENSE", 999, "life"), transaction("unassigned", "INCOME", 999, null))
    const before = JSON.stringify({ accounts, rows })
    assert.equal(history(rows).entries.length, 5)
    assert.equal(history(rows).entries.at(-1).afterCents, 103999)
    assert.equal(JSON.stringify({ accounts, rows }), before)
  })
  it("replays edited and removed historical movements instead of keeping obsolete balances", () => {
    const rows = sample()
    const edited = rows.map(t => t.id === "income" ? { ...t, amount: 900 } : t)
    assert.equal(history(edited).entries.at(-1).afterCents, 93999)
    assert.equal(history(rows.filter(t => t.id !== "savings")).entries.at(-1).afterCents, 113999)
    assert.equal(history(rows).entries.at(-1).afterCents, 103999)
  })
  it("uses the same closing and opening bank balances across months, including empty months", () => {
    const rows = [...sample(), transaction("july", "EXPENSE", 1100, "revolut", null, "2026-07-01")]
    const month = value => calculateAccountScopeSummary({ accounts, transactions: rows, month: value, year: 2026 })
    assert.equal(month(6).openingBalance, 150.3)
    assert.equal(month(6).monthlyResult, 969.69)
    assert.equal(month(6).closingBalance, 1039.99)
    assert.equal(month(7).openingBalance, month(6).closingBalance)
    assert.equal(month(7).closingBalance, -60.01)
    assert.equal(month(8).openingBalance, -60.01)
    assert.equal(month(8).closingBalance, -60.01)
    assert.equal(month(8).monthlyResult, 0)
  })
  it("does not invent balances before the first recorded movement or claim bank verification", () => {
    const rows = [transaction("first", "EXPENSE", 10, "lcl", null, "2026-06-15")]
    const period = month => calculateAccountScopeSummary({ accounts, transactions: rows, selectedAccountIds: ["lcl"], month, year: 2026 })
    assert.equal(period(5).openingBalance, null)
    assert.equal(period(5).closingBalance, null)
    assert.equal(period(6).openingBalance, null)
    assert.equal(period(6).closingBalance, 90.1)
    assert.equal(period(7).openingBalance, 90.1)
    assert.equal(period(7).bankBalance, null)
    assert.equal(period(7).recordedOpeningBalance, 100.1)
    assert.equal(history([], ["lcl"]).entries.length, 0)
  })
})
