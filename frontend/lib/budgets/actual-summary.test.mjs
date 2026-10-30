import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loadTs } from "../testing/load-ts.mjs"

const { calculateMonthlyActualSummary } = loadTs("lib/budgets/actual-summary.ts")
const day = value => new Date(`${value}T00:00:00Z`)
const transaction = (id, amount, overrides = {}) => ({
  id, amount, userId: "u1", title: "Sortie", type: "EXPENSE", date: day("2026-10-07"),
  accountId: "main", categoryId: "leisure", category: "Ancien libellé", categoryRelation: { name: "Loisirs" }, ...overrides,
})
const charge = (overrides = {}) => ({
  id: "pathe", userId: "u1", title: "Pathé", amount: 34.9, type: "EXPENSE", frequency: "MONTHLY", active: true,
  accountId: "main", categoryId: "leisure", dayOfMonth: 7, startDate: day("2026-06-01"), endDate: null,
  detectionTitleNorm: null, sourceTransactions: [{ transactionId: "payment" }], activityPeriods: [], ...overrides,
})

function fixture({ transactions = [], charges = [], budgetAmount = 100, reserve = 50 } = {}) {
  let email = "isolated@example.invalid"
  const budgets = [{ id: "budget", userId: "u1", month: 10, year: 2026, categoryId: "leisure", amount: budgetAmount, category: { id: "leisure", name: "Loisirs", icon: "film", color: "#14b8a6" } }]
  const financial = { transactions, charges, budgets }
  const before = JSON.stringify(financial)
  const reads = []
  const prisma = {
    user: { async findUnique({ where }) { return where.email === "isolated@example.invalid" ? { id: "u1" } : null } },
    transaction: { async findMany({ where }) {
      reads.push(where)
      return transactions.filter(t => t.userId === where.userId && where.type.in.includes(t.type) && (!where.date.gte || t.date >= where.date.gte) && t.date < where.date.lt)
    } },
    recurringTransaction: { async findMany({ where }) { return charges.filter(c => c.userId === where.userId && c.type === where.type && c.frequency === where.frequency) } },
    budget: { async findMany({ where }) { return budgets.filter(b => b.userId === where.userId && b.month === where.month && b.year === where.year) } },
    monthlyEmergencyReserve: { async findUnique() { return { amount: reserve } } },
    account: { async findMany() { return [] } },
  }
  const { GET } = loadTs("app/api/budgets/route.ts", {
    "@/auth": { auth: async () => email ? { user: { email } } : null },
    "@/lib/prisma": { prisma },
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/categories/ensure-defaults": { synchronizeLegacyTransactionCategories: () => { throw new Error("Unexpected financial write") } },
  })
  return {
    transactions, charges, budgets, reads, before, snapshot: () => JSON.stringify(financial),
    setEmail: value => { email = value },
    response: (month = 10, year = 2026) => GET(new Request(`http://isolated.invalid/api/budgets?month=${month}&year=${year}`)),
    get: async (month = 10, year = 2026) => (await GET(new Request(`http://isolated.invalid/api/budgets?month=${month}&year=${year}`))).json(),
  }
}

describe("monthly actual summary in cents", () => {
  it("reproduces a completed September without subtracting matched payments twice", () => {
    const result = calculateMonthlyActualSummary([
      transaction("income", 938.07, { type: "INCOME" }), transaction("paid", 96.45),
      transaction("transport", 189.74, { categoryId: "transport", categoryRelation: { name: "Transport" } }),
      transaction("food", 113.81, { categoryId: "food", categoryRelation: { name: "Alimentation" } }),
      transaction("leisure", 112.75),
      transaction("other", 95, { categoryId: "other", categoryRelation: { name: "Autres" } }),
      transaction("shopping", 78.99, { categoryId: "shopping", categoryRelation: { name: "Shopping" } }),
      transaction("subscription", 75.3, { categoryId: "subscription", categoryRelation: { name: "Abonnements" } }),
      transaction("telecom", 65.48, { categoryId: "telecom", categoryRelation: { name: "Télécommunication" } }),
    ], new Set(["paid"]))
    assert.equal(result.remainingAfterRecurringPayments, 841.62)
    assert.equal(result.otherExpensesTotal, 731.07)
    assert.equal(result.remaining, 110.55)
    assert.equal(result.totalExpenses, 827.52)
    assert.equal(result.otherExpenses.length, 7)
  })
  it("uses every actual expense exactly once, including categories without a budget", () => {
    const result = calculateMonthlyActualSummary([
      transaction("salary", 625.9, { type: "INCOME" }), transaction("pathe", 34.9), transaction("outing", 15),
      transaction("groceries", 52.37, { categoryId: "food", categoryRelation: { name: "Alimentation" } }),
    ], new Set(["pathe"]))
    assert.deepEqual(result, {
      transactionCount: 4, income: 625.9, recurringPaidTotal: 34.9, remainingAfterRecurringPayments: 591,
      otherExpenses: [{ categoryId: "food", category: "Alimentation", amount: 52.37 }, { categoryId: "leisure", category: "Loisirs", amount: 15 }],
      otherExpensesTotal: 67.37, totalExpenses: 102.27, remaining: 523.63,
    })
  })

  it("deduplicates real transactions, including repeated income and payment rows", () => {
    const income = transaction("salary", 100, { type: "INCOME" })
    const payment = transaction("payment", 34.9)
    const result = calculateMonthlyActualSummary([income, income, payment, payment, transaction("extra", 34.9)], new Set(["payment"]))
    assert.equal(result.transactionCount, 3)
    assert.equal(result.recurringPaidTotal, 34.9)
    assert.equal(result.otherExpensesTotal, 34.9)
    assert.equal(result.remaining, 30.2)
  })

  it("excludes transfers and never treats an income as a recurring expense", () => {
    const result = calculateMonthlyActualSummary([
      transaction("salary", 100, { type: "INCOME" }), transaction("transfer", 999, { type: "TRANSFER" }),
      transaction("internal", 999, { type: "INTERNAL_TRANSFER" }),
    ], new Set(["salary", "transfer"]))
    assert.equal(result.income, 100)
    assert.equal(result.recurringPaidTotal, 0)
    assert.equal(result.remaining, 100)
    assert.equal(result.transactionCount, 1)
  })

  it("keeps uncategorized and legacy-category expenses rather than dropping them", () => {
    const result = calculateMonthlyActualSummary([
      transaction("a", 10, { categoryId: null, category: " Voyage ", categoryRelation: null }),
      transaction("b", 0.1, { categoryId: null, category: "Voyage", categoryRelation: null }),
      transaction("c", 0.2, { categoryId: null, category: "", categoryRelation: null }),
      transaction("d", 0.3, { categoryId: "real", category: "Voyage", categoryRelation: { name: "Voyage" } }),
    ], new Set())
    assert.equal(result.otherExpensesTotal, 10.6)
    assert.equal(result.remaining, -10.6)
    assert.deepEqual(result.otherExpenses, [
      { categoryId: null, category: "Voyage", amount: 10.1 },
      { categoryId: "real", category: "Voyage", amount: 0.3 },
      { categoryId: null, category: "Sans catégorie", amount: 0.2 },
    ])
  })

  it("returns an explicit empty month and keeps negative balances", () => {
    const empty = calculateMonthlyActualSummary([], new Set(["missing"]))
    assert.equal(empty.transactionCount, 0)
    assert.equal(empty.remaining, 0)
    assert.deepEqual(empty.otherExpenses, [])
    const negative = calculateMonthlyActualSummary([transaction("a", 0.1), transaction("b", 0.2)], new Set(["a"]))
    assert.equal(negative.remaining, -0.3)
    assert.equal(negative.totalExpenses, 0.3)
  })
})

describe("actual budget balance through the existing authenticated API", () => {
  it("keeps planning separate from actual spending and includes a category without an envelope", async () => {
    const f = fixture({
      transactions: [transaction("income", 500, { type: "INCOME" }), transaction("payment", 34.9, { title: "Pathé" }),
        transaction("outing", 15), transaction("food", 100, { categoryId: "food", categoryRelation: { name: "Alimentation" } })],
      charges: [charge(), charge({ id: "unpaid", title: "Sans paiement", amount: 20, sourceTransactions: [] })],
    })
    const result = await f.get()
    assert.equal(result.summary.recurringCommittedTotal, 54.9)
    assert.equal(result.summary.freeMoney, 295.1)
    assert.equal(result.budgets[0].spent, 15)
    assert.equal(result.actualSummary.recurringPaidTotal, 34.9)
    assert.equal(result.actualSummary.otherExpensesTotal, 115)
    assert.equal(result.actualSummary.remaining, 350.1)
    assert.ok(result.actualSummary.otherExpenses.some(category => category.categoryId === "food"))
    assert.equal(f.snapshot(), f.before)
  })

  it("leaves unpaid recurring charges out of the real balance even with no actual transaction", async () => {
    const f = fixture({ charges: [charge({ sourceTransactions: [] })] })
    const result = await f.get()
    assert.equal(result.summary.recurringCommittedTotal, 34.9)
    assert.equal(result.actualSummary.recurringPaidTotal, 0)
    assert.equal(result.actualSummary.transactionCount, 0)
    assert.equal(result.actualSummary.remaining, 0)
  })

  it("includes uncertain subscription-like payments in other expenses until linked", async () => {
    const f = fixture({ transactions: [transaction("payment", 35.22, { title: "Pathé" })], charges: [charge({ sourceTransactions: [] })] })
    const before = await f.get()
    assert.equal(before.actualSummary.recurringPaidTotal, 0)
    assert.equal(before.actualSummary.otherExpensesTotal, 35.22)
    assert.equal(before.pendingPayments.length, 1)
    f.charges[0].sourceTransactions.push({ transactionId: "payment" })
    const after = await f.get()
    assert.equal(after.actualSummary.recurringPaidTotal, 35.22)
    assert.equal(after.actualSummary.otherExpensesTotal, 0)
    assert.equal(after.actualSummary.remaining, before.actualSummary.remaining)
    assert.equal(after.pendingPayments.length, 0)
  })

  it("does not match ambiguous similar payments or count a confirmed payment twice", async () => {
    const f = fixture({ transactions: [transaction("payment", 34.9, { title: "Pathé" }), transaction("extra", 34.9, { title: "Pathé" })], charges: [charge({ sourceTransactions: [] })] })
    const before = await f.get()
    assert.equal(before.actualSummary.recurringPaidTotal, 0)
    assert.equal(before.actualSummary.otherExpensesTotal, 69.8)
    f.charges[0].sourceTransactions.push({ transactionId: "payment" })
    f.transactions.push(f.transactions[0])
    const after = await f.get()
    assert.equal(after.actualSummary.recurringPaidTotal, 34.9)
    assert.equal(after.actualSummary.otherExpensesTotal, 34.9)
    assert.equal(after.actualSummary.totalExpenses, 69.8)
    assert.equal(after.actualSummary.remaining, -69.8)
  })

  it("preserves the actual payments of historical months when a charge is inactive", async () => {
    const f = fixture({
      transactions: [transaction("income", 100, { type: "INCOME", date: day("2026-09-01") }),
        transaction("payment", 34.9, { title: "Pathé", date: day("2026-09-07") }),
        transaction("october", 15), transaction("earlier", 999, { date: day("2026-08-31") })],
      charges: [charge({ active: false, endDate: day("2026-09-30") })],
    })
    const september = await f.get(9)
    assert.equal(september.actualSummary.remaining, 65.1)
    assert.equal(september.actualSummary.recurringPaidTotal, 34.9)
    const october = await f.get()
    assert.equal(october.actualSummary.remaining, -15)
    assert.equal(october.actualSummary.recurringPaidTotal, 0)
    const november = await f.get(11)
    assert.equal(november.actualSummary.transactionCount, 0)
    assert.deepEqual((await f.get(9)).actualSummary, september.actualSummary)
    assert.equal(f.snapshot(), f.before)
  })

  it("keeps calendar-month UTC boundaries and the selected year", async () => {
    const f = fixture({ transactions: [
      transaction("before", 999, { date: new Date("2026-09-30T23:59:59Z") }),
      transaction("start", 0.1, { date: new Date("2026-10-01T00:00:00Z") }),
      transaction("end", 0.2, { date: new Date("2026-10-31T23:59:59Z") }),
      transaction("after", 999, { date: new Date("2026-11-01T00:00:00Z") }),
      transaction("otherYear", 999, { date: day("2025-10-07") }),
    ] })
    assert.equal((await f.get()).actualSummary.totalExpenses, 0.3)
    assert.equal((await f.get(10, 2025)).actualSummary.totalExpenses, 999)
  })

  it("isolates users and excludes transfers, unrelated associations and future transactions", async () => {
    const f = fixture({
      transactions: [transaction("own", 12.34), transaction("foreign", 999, { userId: "u2" }),
        transaction("transfer", 999, { type: "TRANSFER" }), transaction("future", 999, { date: day("2026-11-07") })],
      charges: [charge({ userId: "u2", sourceTransactions: [{ transactionId: "own" }] })],
    })
    const result = await f.get()
    assert.equal(result.actualSummary.totalExpenses, 12.34)
    assert.equal(result.actualSummary.recurringPaidTotal, 0)
    assert.equal(result.actualSummary.transactionCount, 1)
    assert.equal(f.reads[0].userId, "u1")
    assert.deepEqual(f.reads[0].type.in, ["INCOME", "EXPENSE"])
  })

  it("rejects unauthenticated requests and unknown users without reading transactions", async () => {
    const f = fixture()
    f.setEmail(null)
    assert.equal((await f.response()).status, 401)
    f.setEmail("unknown@example.invalid")
    assert.equal((await f.response()).status, 401)
    assert.deepEqual(f.reads, [])
  })

  it("includes all expenses when there are no variable budgets", async () => {
    const f = fixture({ transactions: [transaction("payment", 21.45)], budgetAmount: 999, reserve: 999 })
    f.budgets.splice(0)
    const result = await f.get()
    assert.equal(result.budgets.length, 0)
    assert.equal(result.actualSummary.otherExpensesTotal, 21.45)
    assert.equal(result.actualSummary.remaining, -21.45)
  })
})
