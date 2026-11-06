/**
 * Teste l'enregistrement de la reserve mensuelle avec des dependances simulees.
 * Controle les validations, l'authentification et l'absence de mouvement bancaire.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

// Execute the real route modules with Auth.js and Prisma replaced by in-memory mocks.
function loadTs(path, mocks, cache = new Map()) {
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

function fixture() {
  let email = "u1@example.invalid"
  const reserves = new Map([["u2:2026:10", 80]])
  const upserts = []
  const financialWrites = []
  const forbidWrite = () => { financialWrites.push("write"); throw new Error("Financial write forbidden") }
  const transactions = [
    { userId: "u1", type: "INCOME", amount: 465.90, date: new Date("2026-10-01"), categoryId: "salary" },
    { userId: "u1", type: "EXPENSE", amount: 83.63, date: new Date("2026-10-05"), categoryId: "telecom" },
    { userId: "u1", type: "INCOME", amount: 100, date: new Date("2026-11-01"), categoryId: "salary" },
    { userId: "u2", type: "INCOME", amount: 9999, date: new Date("2026-10-01"), categoryId: "salary" },
  ]
  const budgets = [
    { id: "b1", userId: "u1", month: 10, year: 2026, categoryId: "telecom", amount: 20 },
    { id: "b2", userId: "u1", month: 11, year: 2026, categoryId: "telecom", amount: 10 },
    { id: "b3", userId: "u2", month: 10, year: 2026, categoryId: "telecom", amount: 999 },
  ]
  for (const [index, transaction] of transactions.entries()) {
    Object.assign(transaction, { id: `t${index}`, title: "Transaction réelle", accountId: "main" })
  }
  const recurring = [
    { userId: "u1", type: "EXPENSE", frequency: "MONTHLY", amount: 63.64, startDate: "2026-10-01", endDate: null },
    { userId: "u1", type: "EXPENSE", frequency: "MONTHLY", amount: 19.99, startDate: "2026-10-01", endDate: null },
    { userId: "u2", type: "EXPENSE", frequency: "MONTHLY", amount: 999, startDate: "2026-10-01", endDate: null },
    { userId: "u1", type: "INCOME", frequency: "MONTHLY", amount: 1000, startDate: "2026-10-01", endDate: null },
  ].map((charge, index) => ({ ...charge, id: `r${index}`, title: "Charge prévue", accountId: "main", dayOfMonth: 1, detectionTitleNorm: null, sourceTransactions: [] }))
  const matchingTransactions = (where) => transactions.filter(t =>
    t.userId === where.userId && t.type === where.type &&
    t.date >= where.date.gte && t.date < where.date.lt &&
    (!where.categoryId || where.categoryId.in.includes(t.categoryId))
  )
  const reserveKey = ({ userId, year, month }) => `${userId}:${year}:${month}`
  const prisma = {
    user: { findUnique: async ({ where }) => where.email === "u1@example.invalid" ? { id: "u1" } : null },
    budget: { findMany: async ({ where }) => budgets.filter(b => b.userId === where.userId && b.month === where.month && b.year === where.year), create: forbidWrite },
    recurringTransaction: { findMany: async ({ where }) => recurring.filter(r => r.userId === where.userId && r.type === where.type && r.frequency === where.frequency) },
    monthlyEmergencyReserve: {
      findUnique: async ({ where }) => reserves.has(reserveKey(where.userId_year_month)) ? { amount: reserves.get(reserveKey(where.userId_year_month)) } : null,
      upsert: async (query) => {
        upserts.push(query)
        const key = reserveKey(query.where.userId_year_month)
        const amount = reserves.has(key) ? query.update.amount : query.create.amount
        reserves.set(key, amount)
        return { id: "reserve", ...query.where.userId_year_month, amount }
      },
    },
    transaction: {
      findMany: async ({ where }) => transactions.filter(t => t.userId === where.userId && where.type.in.includes(t.type) && (!where.date.gte || t.date >= where.date.gte) && t.date < where.date.lt),
      aggregate: async ({ where }) => ({ _sum: { amount: matchingTransactions(where).reduce((sum, t) => sum + t.amount, 0) } }),
      groupBy: async ({ where }) => {
        const groups = new Map()
        for (const t of matchingTransactions(where)) groups.set(t.categoryId, (groups.get(t.categoryId) ?? 0) + t.amount)
        return [...groups].map(([categoryId, amount]) => ({ categoryId, _sum: { amount } }))
      },
      create: forbidWrite, update: forbidWrite, delete: forbidWrite,
    },
    account: { findMany: async () => [], update: forbidWrite, updateMany: forbidWrite },
  }
  const mocks = {
    "@/auth": { auth: async () => email ? { user: { email } } : null },
    "@/lib/prisma": { prisma },
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/categories/ensure-defaults": { synchronizeLegacyTransactionCategories: forbidWrite },
  }
  return {
    put: loadTs("app/api/budgets/emergency-reserve/route.ts", mocks).PUT,
    get: loadTs("app/api/budgets/route.ts", mocks).GET,
    reserves, upserts, financialWrites,
    setEmail: (value) => { email = value },
  }
}

function request(body) {
  return new Request("http://localhost/api/budgets/emergency-reserve", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
}

describe("emergency reserve routes with isolated mocks", () => {
  it("upserts only the authenticated user and selected month without financial writes", async () => {
    const f = fixture()
    assert.equal((await f.put(request({ month: 10, year: 2026, amount: 50 }))).status, 200)
    assert.equal(f.reserves.get("u1:2026:10"), 50)
    assert.equal(f.reserves.get("u2:2026:10"), 80)
    assert.equal(f.reserves.has("u1:2026:11"), false)
    assert.deepEqual(f.upserts[0].where, { userId_year_month: { userId: "u1", year: 2026, month: 10 } })
    assert.deepEqual(f.financialWrites, [])
    await f.put(request({ month: 10, year: 2026, amount: 0 }))
    assert.equal(f.reserves.get("u1:2026:10"), 0)
    assert.equal(f.reserves.size, 2)
  })

  it("rejects client userId and invalid periods and amounts before writing", async () => {
    const f = fixture()
    for (const patch of [
      { userId: "u2" }, { month: 0 }, { month: 13 }, { month: 1.5 },
      { year: 0 }, { year: 10000 }, { year: 2026.5 },
      { amount: -1 }, { amount: 1.001 }, { amount: 10000000000 },
      { amount: "50" }, { amount: null },
    ]) {
      const response = await f.put(request({ month: 10, year: 2026, amount: 50, ...patch }))
      assert.equal(response.status, 400, JSON.stringify(patch))
    }
    assert.equal(f.upserts.length, 0)
  })

  it("returns 401 for no session or an unknown session user", async () => {
    const f = fixture()
    for (const email of [null, "missing@example.invalid"]) {
      f.setEmail(email)
      assert.equal((await f.put(request({ month: 10, year: 2026, amount: 50 }))).status, 401)
      assert.equal((await f.get(new Request("http://localhost/api/budgets?month=10&year=2026"))).status, 401)
    }
    assert.equal(f.upserts.length, 0)
  })

  it("returns 400 for malformed JSON", async () => {
    const f = fixture()
    assert.equal((await f.put(new Request("http://localhost/api/budgets/emergency-reserve", { method: "PUT", body: "{" }))).status, 400)
    assert.equal(f.upserts.length, 0)
  })

  it("keeps monthly data isolated, counts charges once even with a budget, and keeps spent real", async () => {
    const f = fixture()
    const getMonth = async (month) => (await f.get(new Request(`http://localhost/api/budgets?month=${month}&year=2026`))).json()
    const before = await getMonth(10)
    assert.equal(before.summary.emergencyReserve, 0)
    assert.equal(f.upserts.length, 0)
    await f.put(request({ month: 10, year: 2026, amount: 50 }))
    const october = await getMonth(10)
    assert.deepEqual(october.summary, {
      monthlyIncome: 465.90, recurringCommittedTotal: 83.63, emergencyReserve: 50,
      availableForBudgets: 332.27, variableBudgetAllocated: 20, spent: 83.63, freeMoney: 312.27,
    })
    assert.equal(october.budgets[0].amount, 20)
    assert.equal(october.budgets[0].spent, 83.63)
    assert.equal("percentage" in october.budgets[0], false)
    assert.equal("recurringOutsideBudgets" in october.summary, false)
    const november = await getMonth(11)
    assert.equal(november.summary.monthlyIncome, 100)
    assert.equal(november.summary.emergencyReserve, 0)
    assert.equal(november.summary.variableBudgetAllocated, 10)
    assert.equal(november.summary.spent, 0)
    assert.equal(october.summary.spent, before.summary.spent)
    assert.deepEqual(f.financialWrites, [])
  })
})
