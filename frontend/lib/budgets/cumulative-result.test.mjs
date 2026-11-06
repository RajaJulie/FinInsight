/**
 * Teste les reports de resultat entre mois, les ouvertures et les historiques
 * incomplets, ainsi que les filtres utilisateur et le perimetre bancaire.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loadTs } from "../testing/load-ts.mjs"

const { calculateCumulativeMonthlyResult } = loadTs("lib/budgets/cumulative-result.ts", { "@/lib/prisma": { prisma: {} } })
const date = value => new Date(`${value}T00:00:00Z`)
const transaction = (id, amount, day, type = "EXPENSE", extra = {}) => ({
  id, amount, date: date(day), type, userId: "u1", title: id, accountId: "main", categoryId: "leisure",
  category: "Loisirs", categoryRelation: { name: "Loisirs" }, ...extra,
})
const examples = () => [
  transaction("june-income", 500, "2026-06-01", "INCOME"),
  transaction("payment", 34.9, "2026-06-07"),
  transaction("june-variable", 298.29, "2026-06-15"),
  transaction("july-income", 200, "2026-07-01", "INCOME"),
  transaction("july-variable", 373.44, "2026-07-15"),
  transaction("august-income", 500, "2026-08-01", "INCOME"),
  transaction("august-variable", 40.65, "2026-08-15"),
]

function fixture({ transactions = examples(), accounts = [{ userId: "u1", initialBalance: 0 }], recurring = [] } = {}) {
  accounts = accounts.map((account, index) => ({ id: index === 0 ? "main" : `account${index}`, name: "Compte isolé", type: "CHECKING", status: "ACTIVE", currency: "EUR", ...account }))
  let email = "u1@example.invalid"
  const reads = []
  const before = JSON.stringify({ transactions, accounts, recurring })
  const prisma = {
    user: { findUnique: async ({ where }) => where.email === "u1@example.invalid" ? { id: "u1" } : null },
    transaction: { findMany: async ({ where }) => {
      reads.push({ model: "transaction", where })
      return transactions.filter(item => item.userId === where.userId && where.type.in.includes(item.type) &&
        (!where.date.gte || item.date >= where.date.gte) && item.date < where.date.lt)
    } },
    account: { findMany: async ({ where }) => {
      reads.push({ model: "account", where })
      return accounts.filter(item => item.userId === where.userId)
    } },
    budget: { findMany: async () => [{ categoryId: "leisure", amount: 999, category: { name: "Loisirs" } }] },
    monthlyEmergencyReserve: { findUnique: async () => ({ amount: 999 }) },
    recurringTransaction: { findMany: async ({ where }) => recurring.filter(item => item.userId === where.userId) },
  }
  const { GET } = loadTs("app/api/budgets/route.ts", {
    "@/lib/prisma": { prisma },
    "@/auth": { auth: async () => email ? { user: { email } } : null },
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/categories/ensure-defaults": { synchronizeLegacyTransactionCategories: () => { throw new Error("Unexpected write") } },
  })
  return {
    reads, before, snapshot: () => JSON.stringify({ transactions, accounts, recurring }),
    setEmail: value => { email = value },
    response: (month, year = 2026, selection = "") => GET(new Request(`http://isolated.invalid/api/budgets?month=${month}&year=${year}${selection}`)),
    get: async (month, year = 2026, selection = "") => (await GET(new Request(`http://isolated.invalid/api/budgets?month=${month}&year=${year}${selection}`))).json(),
  }
}

describe("cumulative recorded monthly results", () => {
  it("carries June, July and August results in cents using only isolated example transactions", async () => {
    const f = fixture()
    for (const [month, result, carry, closing] of [[6, 166.81, 0, 166.81], [7, -173.44, 166.81, -6.63], [8, 459.35, -6.63, 452.72]]) {
      const data = await f.get(month)
      assert.equal(data.actualSummary.remaining, result)
      assert.equal(data.cumulativeResult.previousMonthsResult, carry)
      assert.equal(data.cumulativeResult.closingResult, closing)
      assert.equal(data.cumulativeResult.bankBalance, null)
    }
    assert.equal(f.snapshot(), f.before)
  })

  it("keeps recorded opening balances separate, even when nonzero or negative", async () => {
    const f = fixture({ accounts: [{ userId: "u1", initialBalance: 250.37 }, { userId: "u1", initialBalance: -50.02 }] })
    const data = await f.get(8)
    assert.equal(data.cumulativeResult.recordedOpeningBalance, 200.35)
    assert.equal(data.cumulativeResult.closingResult, 452.72)
    assert.equal(data.cumulativeResult.bankBalance, null)
  })

  it("does not assume a zero bank opening when history is incomplete or starts mid-month", async () => {
    for (const accounts of [[], [{ userId: "u1", initialBalance: 0 }], [{ userId: "u1", initialBalance: 500 }]]) {
      const f = fixture({ accounts, transactions: [transaction("first-known", 12.34, "2026-08-17")] })
      const data = await f.get(8)
      assert.equal(data.cumulativeResult.previousMonthsResult, 0)
      assert.equal(data.cumulativeResult.closingResult, -12.34)
      assert.equal(data.cumulativeResult.bankBalance, null)
    }
  })

  it("excludes transfers, future months and another user's transactions and accounts", async () => {
    const f = fixture({
      transactions: [...examples(), transaction("transfer", 999, "2026-07-10", "TRANSFER"),
        transaction("future", 999, "2026-09-01", "INCOME"),
        transaction("foreign", 999, "2026-06-01", "INCOME", { userId: "u2" })],
      accounts: [{ userId: "u1", initialBalance: 100 }, { userId: "u2", initialBalance: 999 }],
    })
    const data = await f.get(8)
    assert.equal(data.cumulativeResult.closingResult, 452.72)
    assert.equal(data.cumulativeResult.recordedOpeningBalance, 100)
    for (const { where } of f.reads) assert.equal(where.userId, "u1")
    const historicalRead = f.reads.find(item => item.model === "transaction" && !item.where.date.gte)
    assert.deepEqual(historicalRead.where.type.in, ["INCOME", "EXPENSE", "TRANSFER"])
    assert.equal(historicalRead.where.date.lt.toISOString(), "2026-09-01T00:00:00.000Z")
  })

  it("counts a reconciled payment once and ignores allocated budgets and planned reserves", async () => {
    const f = fixture({ recurring: [{
      id: "pathe", userId: "u1", title: "Pathé", type: "EXPENSE", frequency: "MONTHLY", amount: 34.9,
      accountId: "main", dayOfMonth: 7, startDate: date("2026-06-01"), endDate: null, detectionTitleNorm: null,
      sourceTransactions: [{ transactionId: "payment" }], activityPeriods: [],
    }] })
    const data = await f.get(6)
    assert.equal(data.actualSummary.recurringPaidTotal, 34.9)
    assert.equal(data.actualSummary.totalExpenses, 333.19)
    assert.equal(data.actualSummary.remaining, 166.81)
    assert.equal(data.cumulativeResult.closingResult, 166.81)
    assert.equal(data.summary.emergencyReserve, 999)
    assert.equal(data.summary.variableBudgetAllocated, 999)
  })

  it("preserves carry in empty months, across years and when revisiting a previous month", async () => {
    const f = fixture({ transactions: [transaction("december", 0.3, "2025-12-31", "INCOME"), ...examples()] })
    const january = await f.get(1)
    assert.equal(january.actualSummary.remaining, 0)
    assert.equal(january.cumulativeResult.previousMonthsResult, 0.3)
    assert.equal(january.cumulativeResult.closingResult, 0.3)
    const june = await f.get(6)
    await f.get(8)
    assert.deepEqual((await f.get(6)).cumulativeResult, june.cumulativeResult)
    const september = await f.get(9)
    assert.equal(september.actualSummary.remaining, 0)
    assert.equal(september.cumulativeResult.closingResult, 453.02)
  })

  it("does not round accumulated floating sums or count duplicated transaction rows twice", () => {
    const a = { id: "a", type: "INCOME", amount: 0.1 }
    const data = calculateCumulativeMonthlyResult({
      previousTransactions: [a, a, { id: "b", type: "INCOME", amount: 0.2 }, { id: "transfer", type: "TRANSFER", amount: 999 }],
      monthlyResult: -0.3, accounts: [{ initialBalance: 0.1 }, { initialBalance: 0.2 }],
    })
    assert.equal(data.previousMonthsResult, 0.3)
    assert.equal(data.closingResult, 0)
    assert.equal(data.recordedOpeningBalance, 0.3)
  })

  it("rejects unauthenticated, unknown users and invalid periods without reading financial data", async () => {
    const f = fixture()
    f.setEmail(null)
    assert.equal((await f.response(8)).status, 401)
    f.setEmail("unknown@example.invalid")
    assert.equal((await f.response(8)).status, 401)
    f.setEmail("u1@example.invalid")
    assert.equal((await f.response(13)).status, 400)
    assert.deepEqual(f.reads, [])
  })
  it("selects only owned accounts and keeps scope changes separate from the monthly financial result", async () => {
    const f = fixture({ accounts: [
      { id: "main", userId: "u1", initialBalance: 0 },
      { id: "life", userId: "u1", type: "SAVINGS", initialBalance: 100 },
      { id: "foreign", userId: "u2", initialBalance: 999 },
    ], transactions: [...examples(), transaction("savings", 100, "2026-06-18", "TRANSFER", { destinationAccountId: "life" })] })
    const current = await f.get(8)
    assert.deepEqual(current.cumulativeResult.accountScope.selectedAccountIds, ["main"])
    assert.equal(current.cumulativeResult.accountScope.closingVariation, 352.72)
    assert.equal(current.cumulativeResult.accountScope.cumulativeTransferredToSavings, 100)
    const all = await f.get(8, 2026, "&accountIds=main,life")
    assert.equal(all.cumulativeResult.accountScope.closingVariation, 452.72)
    assert.equal(all.actualSummary.remaining, current.actualSummary.remaining)
    assert.equal(all.cumulativeResult.accountScope.recordedOpeningBalance, 100)
    assert.equal(all.cumulativeResult.accountScope.bankBalance, null)
    const empty = await f.get(8, 2026, "&accountIds=")
    assert.deepEqual(empty.cumulativeResult.accountScope.selectedAccountIds, [])
    assert.equal(empty.cumulativeResult.accountScope.closingVariation, 0)
    assert.equal((await f.response(8, 2026, "&accountIds=foreign")).status, 400)
    assert.equal((await f.response(8, 2026, "&accountIds=unknown")).status, 400)
    assert.equal((await f.response(8, 2026, "&accountIds=main,,life")).status, 400)
    assert.equal((await f.response(8, 2026, "&accountIds=" + "x".repeat(129))).status, 400)
    assert.equal(f.snapshot(), f.before)
  })
})
