/**
 * Teste les rapprochements automatiques et manuels, leur securite et leur effet
 * sur les enveloppes variables, sans double comptage ni creation de paiement bancaire.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
function loadTs(path, mocks = {}, cache = new Map()) {
  const filename = resolve(frontend, path)
  if (cache.has(filename)) return cache.get(filename).exports
  const loadedModule = { exports: {} }
  cache.set(filename, loadedModule)
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const externalRequire = createRequire(filename)
  const requireModule = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name === "@/auth" || name === "@/lib/prisma") throw new Error("Missing isolated mock")
    if (name.startsWith("@/")) return loadTs(`${name.slice(2)}.ts`, mocks, cache)
    if (name.startsWith(".")) return loadTs(`${resolve(dirname(filename), name)}.ts`, mocks, cache)
    return externalRequire(name)
  }
  new Function("require", "module", "exports", code)(requireModule, loadedModule, loadedModule.exports)
  return loadedModule.exports
}

const { reconcileRecurringPayments } = loadTs("lib/recurring/reconciliation.ts")
const { calculateBudgetSummary } = loadTs("lib/budgets/summary.ts")
const { getEnvelopeRemaining } = loadTs("lib/budgets/money.ts")
const payment = (id, overrides = {}) => ({ id, userId: "u1", title: "Pathé", amount: 34.9, type: "EXPENSE", date: new Date("2026-10-10T00:00:00Z"), accountId: "a1", categoryId: "leisure", ...overrides })
const charge = (id = "pathe", overrides = {}) => ({ id, userId: "u1", title: "Pathé", amount: 34.9, type: "EXPENSE", frequency: "MONTHLY", active: true, accountId: "a1", categoryId: "leisure", dayOfMonth: 10, startDate: new Date("2026-10-01"), endDate: null, detectionTitleNorm: null, sourceTransactions: [], ...overrides })

describe("conservative recurring payment reconciliation", () => {
  it("matches manual Pathé without creating a bank transaction", () => {
    const transactions = [payment("pathe-payment"), payment("outing", { title: "Sortie", amount: 15 })]
    const snapshot = JSON.stringify(transactions)
    const result = reconcileRecurringPayments(transactions, [charge()])
    assert.deepEqual([...result.matched], [["pathe-payment", "pathe"]])
    assert.equal(result.pending.length, 0)
    assert.equal(JSON.stringify(transactions), snapshot)
    assert.equal(getEnvelopeRemaining(50, 0), 50)
    assert.equal(getEnvelopeRemaining(50, 15), 35)
  })
  it("keeps multiple plausible payments in the same month variable", () => {
    const result = reconcileRecurringPayments([payment("a"), payment("b")], [charge()])
    assert.equal(result.matched.size, 0)
    assert.deepEqual(result.pending.map(p => p.transactionId), ["a", "b"])
  })
  it("keeps a payment variable when two charges could explain it", () => {
    const result = reconcileRecurringPayments([payment("a")], [charge("r1"), charge("r2")])
    assert.equal(result.matched.size, 0)
    assert.equal(result.pending[0].candidates.length, 2)
  })
  it("never matches on category alone or across accounts, amounts or transfer types", () => {
    for (const patch of [{ title: "Sortie", amount: 15 }, { accountId: "a2" }, { type: "TRANSFER" }, { amount: 35 }]) {
      assert.equal(reconcileRecurringPayments([payment("a", patch)], [charge()]).matched.size, 0)
    }
  })
  it("uses detection identity after renaming a confirmed recurring title", () => {
    const result = reconcileRecurringPayments([payment("a", { title: "APPLE", amount: 2.99 })], [charge("r", { title: "iCloud", detectionTitleNorm: "apple", amount: 2.99 })])
    assert.equal(result.matched.get("a"), "r")
  })
  it("separates Apple A and B with the same title, amount and account by their usual days", () => {
    const transactions = [payment("apple-a", { title: "Apple", amount: 2.99, date: new Date("2026-10-13") }), payment("apple-b", { title: "Apple", amount: 2.99, date: new Date("2026-10-27") })]
    const charges = [charge("a", { title: "iCloud", detectionTitleNorm: "apple", amount: 2.99, dayOfMonth: 13 }), charge("b", { title: "Gmail", detectionTitleNorm: "apple", amount: 2.99, dayOfMonth: 27 })]
    assert.deepEqual([...reconcileRecurringPayments(transactions, charges).matched], [["apple-a", "a"], ["apple-b", "b"]])
  })
  it("keeps a changed amount uncertain and re-evaluates it on the next calculation", () => {
    const transactions = [payment("a", { amount: 35 })]
    const recurring = charge()
    assert.equal(reconcileRecurringPayments(transactions, [recurring]).pending.length, 1)
    recurring.amount = 35
    assert.equal(reconcileRecurringPayments(transactions, [recurring]).matched.size, 1)
  })
  it("respects persisted payment associations and leaves extra payments variable", () => {
    const result = reconcileRecurringPayments([payment("a"), payment("b")], [charge("r", { sourceTransactions: [{ transactionId: "a" }] })])
    assert.deepEqual([...result.matched], [["a", "r"]])
    assert.equal(result.pending.length, 0)
  })
  it("invalidates incompatible persisted links after transaction edits without deleting anything", () => {
    for (const patch of [{ accountId: "another" }, { type: "TRANSFER" }, { date: new Date("2026-12-10") }]) {
      const recurring = charge("r", { endDate: new Date("2026-10-31"), sourceTransactions: [{ transactionId: "a" }] })
      assert.equal(reconcileRecurringPayments([payment("a", patch)], [recurring]).matched.size, 0)
      assert.equal(recurring.sourceTransactions.length, 1)
    }
  })
  it("respects inclusive dates and historical coverage after deactivation", () => {
    const recurring = charge("r", { active: false, startDate: new Date("2026-10-10"), endDate: new Date("2026-10-10") })
    assert.equal(reconcileRecurringPayments([payment("a")], [recurring]).matched.size, 1)
    for (const date of ["2026-10-09", "2026-10-11", "2026-11-10"]) {
      assert.equal(reconcileRecurringPayments([payment("a", { date: new Date(date) })], [recurring]).matched.size, 0)
    }
  })
  it("handles day 31 at the end of February and does not shift civil UTC days", () => {
    const recurring = charge("r", { startDate: new Date("2026-01-01"), dayOfMonth: 31 })
    assert.equal(reconcileRecurringPayments([payment("a", { date: new Date("2026-02-28T00:00:00Z") })], [recurring]).matched.size, 1)
  })
  it("keeps the exact October example and negative envelopes using cents", () => {
    assert.deepEqual(calculateBudgetSummary({ monthlyIncome: 465.90, recurringCommittedTotal: 249.21, emergencyReserve: 0, budgetAmounts: [50, 180], spent: 0 }), {
      monthlyIncome: 465.90, recurringCommittedTotal: 249.21, emergencyReserve: 0, availableForBudgets: 216.69, variableBudgetAllocated: 230, spent: 0, freeMoney: -13.31,
    })
    assert.equal(getEnvelopeRemaining(50, 65.01), -15.01)
    assert.equal(getEnvelopeRemaining(0.3, 0.1 + 0.2), 0)
  })
})

function fixture() {
  let email = "u1@example.invalid"
  const transactions = [payment("payment"), payment("income", { type: "INCOME", title: "Revenu", amount: 465.90 }), payment("foreign", { userId: "u2", accountId: "a2" })]
  const charges = [charge(), charge("foreign-charge", { userId: "u2", accountId: "a2" })]
  const sources = []
  const financialWrites = []
  const forbidWrite = () => { financialWrites.push("write"); throw new Error("Financial write forbidden") }
  const prisma = {
    user: { findUnique: async ({ where }) => where.email === "u1@example.invalid" ? { id: "u1" } : null },
    transaction: {
      findMany: async ({ where }) => transactions.filter(t => t.userId === where.userId && where.type.in.includes(t.type) && (!where.date.gte || t.date >= where.date.gte) && t.date < where.date.lt),
      findFirst: async ({ where }) => transactions.find(t => t.id === where.id && t.userId === where.userId && t.type === where.type) ?? null,
      create: forbidWrite, update: forbidWrite, delete: forbidWrite,
    },
    recurringTransaction: {
      findMany: async ({ where }) => charges.filter(r => r.userId === where.userId && r.type === where.type && r.frequency === where.frequency).map(r => ({ ...r, sourceTransactions: sources.filter(s => s.recurringTransactionId === r.id) })),
      findFirst: async ({ where }) => charges.find(r => r.id === where.id && r.userId === where.userId && r.type === where.type) ?? null,
    },
    recurringTransactionSource: {
      findFirst: async ({ where }) => sources.find(s => where.OR.some(filter => {
        if (filter.transactionId) return filter.transactionId === s.transactionId
        const transaction = transactions.find(t => t.id === s.transactionId)
        return s.recurringTransactionId === filter.recurringTransactionId && transaction.date >= filter.transaction.date.gte && transaction.date < filter.transaction.date.lt
      })) ?? null,
      create: async ({ data }) => { sources.push({ id: `source-${sources.length}`, ...data }); return sources.at(-1) },
    },
    budget: { findMany: async ({ where }) => where.userId === "u1" ? [{ id: "b", categoryId: "leisure", amount: 50, month: where.month, year: where.year, category: { id: "leisure", name: "Loisirs" } }] : [], create: forbidWrite },
    monthlyEmergencyReserve: { findUnique: async () => ({ amount: 20 }) },
    account: { findMany: async () => [], update: forbidWrite, updateMany: forbidWrite },
    $transaction: async (callback, options) => { assert.equal(options.isolationLevel, "Serializable"); return callback(prisma) },
  }
  const mocks = {
    "@/auth": { auth: async () => email ? { user: { email } } : null },
    "@/lib/prisma": { prisma },
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/categories/ensure-defaults": { synchronizeLegacyTransactionCategories: forbidWrite },
  }
  return { transactions, charges, sources, financialWrites, prisma,
    post: loadTs("app/api/recurring-transactions/[id]/payments/route.ts", mocks).POST,
    get: loadTs("app/api/budgets/route.ts", mocks).GET,
    setEmail: value => { email = value },
  }
}
const request = (transactionId = "payment", extra = {}) => new Request("http://localhost/api/recurring-transactions/pathe/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId, ...extra }) })
const context = (id = "pathe") => ({ params: Promise.resolve({ id }) })
const getMonth = async (f, month = 10) => (await f.get(new Request(`http://localhost/api/budgets?month=${month}&year=2026`))).json()

describe("budget and payment routes with isolated mocks", () => {
  it("returns Pathé planned, zero spent, then automatically counts an outing of 15", async () => {
    const f = fixture()
    const before = await getMonth(f)
    assert.equal(before.summary.recurringCommittedTotal, 34.90)
    assert.equal(before.summary.availableForBudgets, 411)
    assert.equal(before.summary.freeMoney, 361)
    assert.equal(before.budgets[0].spent, 0)
    assert.equal(before.budgets[0].remaining, 50)
    f.transactions.push(payment("outing", { title: "Sortie", amount: 15 }))
    const after = await getMonth(f)
    assert.equal(after.budgets[0].spent, 15)
    assert.equal(after.budgets[0].remaining, 35)
    assert.equal(f.sources.length, 0)
    assert.deepEqual(f.financialWrites, [])
  })
  it("keeps planned charges without a real payment and selects only the requested month", async () => {
    const f = fixture()
    f.transactions.splice(0, 1)
    const october = await getMonth(f)
    assert.equal(october.summary.recurringCommittedTotal, 34.9)
    assert.equal(october.budgets[0].spent, 0)
    f.charges[0].active = false
    f.charges[0].endDate = new Date("2026-10-31")
    const november = await getMonth(f, 11)
    assert.equal(november.summary.recurringCommittedTotal, 0)
    assert.equal(november.summary.monthlyIncome, 0)
  })
  it("asks for confirmation for similar payments, then excludes only the confirmed payment", async () => {
    const f = fixture()
    f.transactions.push(payment("duplicate"))
    const before = await getMonth(f)
    assert.equal(before.budgets[0].spent, 69.8)
    assert.equal(before.budgets[0].remaining, -19.8)
    assert.equal(before.pendingPayments.length, 2)
    const snapshot = JSON.stringify(f.transactions)
    assert.equal((await f.post(request(), context())).status, 201)
    const after = await getMonth(f)
    assert.equal(after.budgets[0].spent, 34.9)
    assert.equal(after.budgets[0].remaining, 15.1)
    assert.equal(f.sources.length, 1)
    assert.equal(JSON.stringify(f.transactions), snapshot)
    assert.deepEqual(f.financialWrites, [])
    assert.equal((await f.post(request(), context())).status, 409)
    assert.equal((await f.post(request("duplicate"), context())).status, 409)
  })
  it("enforces auth, user isolation and strict request validation", async () => {
    const f = fixture()
    f.setEmail(null)
    assert.equal((await f.post(request(), context())).status, 401)
    f.setEmail("unknown@example.invalid")
    assert.equal((await f.post(request(), context())).status, 401)
    f.setEmail("u1@example.invalid")
    assert.equal((await f.post(request("foreign"), context())).status, 404)
    assert.equal((await f.post(request(), context("foreign-charge"))).status, 404)
    assert.equal((await f.post(request("payment", { userId: "u2" }), context())).status, 400)
    assert.equal((await f.post(new Request("http://localhost", { method: "POST", body: "{" }), context())).status, 400)
    assert.equal(f.sources.length, 0)
    assert.equal((await getMonth(f)).summary.recurringCommittedTotal, 34.9)
  })
  it("rejects another account, an inapplicable date, and transfers", async () => {
    for (const patch of [{ accountId: "a2" }, { date: new Date("2026-09-10") }, { type: "TRANSFER" }]) {
      const f = fixture()
      Object.assign(f.transactions[0], patch)
      assert.ok([400, 404].includes((await f.post(request(), context())).status))
      assert.equal(f.sources.length, 0)
    }
  })
  it("returns 409 for a concurrent association without touching financial records", async () => {
    const f = fixture()
    f.prisma.$transaction = async () => { throw { code: "P2034" } }
    assert.equal((await f.post(request(), context())).status, 409)
    assert.deepEqual(f.financialWrites, [])
  })
  it("returns the same variable spending and remaining amount on budget POST, PATCH and GET", async () => {
    const f = fixture()
    const category = { id: "leisure", name: "Loisirs", color: "#14b8a6", icon: "film" }
    const budget = { id: "b", amount: 50, categoryId: category.id, month: 10, year: 2026, userId: "u1" }
    f.prisma.category = { findFirst: async ({ where }) => where.userId === "u1" && where.id === category.id && where.type === "EXPENSE" ? category : null }
    f.prisma.budget.findFirst = async ({ where }) => where.id === "b" && where.userId === "u1" ? budget : null
    f.prisma.budget.create = async ({ data }) => ({ id: "b", ...data })
    f.prisma.budget.update = async ({ data }) => ({ ...budget, ...data })
    const mocks = {
      "@/auth": { auth: async () => ({ user: { email: "u1@example.invalid" } }) },
      "@/lib/prisma": { prisma: f.prisma },
      "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
      "@/lib/categories/ensure-defaults": { synchronizeLegacyTransactionCategories: async () => {} },
    }
    const post = loadTs("app/api/budgets/route.ts", mocks).POST
    const patch = loadTs("app/api/budgets/[id]/route.ts", mocks).PATCH
    const body = { amount: 50, categoryId: "leisure", month: 10, year: 2026 }
    const request = (method, payload) => new Request("http://localhost/api/budgets", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    assert.equal((await post(request("POST", body))).status, 201)
    const created = await (await post(request("POST", body))).json()
    const updated = await (await patch(request("PATCH", { amount: 50 }), { params: Promise.resolve({ id: "b" }) })).json()
    const loaded = await getMonth(f)
    for (const result of [created.budget, updated.budget, loaded.budgets[0]]) {
      assert.equal(result.spent, 0)
      assert.equal(result.remaining, 50)
    }
    assert.deepEqual(f.financialWrites, [])
  })
})
