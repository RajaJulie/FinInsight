/**
 * Teste les activations, desactivations et reprises avec conservation des periodes
 * historiques, puis verifie leur traitement par les routes et les calculs budgetaires.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Decimal } from "@prisma/client/runtime/client"
import { loadTs } from "../testing/load-ts.mjs"

const { planRecurringActivityTransition: plan, RecurringActivityValidationError } = loadTs("lib/recurring/activity-transition.ts")
const { getRecurringCommittedTotal } = loadTs("lib/budgets/recurring-commitments.ts")
const { calculateBudgetSummary } = loadTs("lib/budgets/summary.ts")
const { reconcileRecurringPayments } = loadTs("lib/recurring/reconciliation.ts")
const day = value => new Date(`${value}T00:00:00Z`)
const total = (charge, month, year = 2026) => getRecurringCommittedTotal({ recurringTransactions: [charge], month, year })
const charge = (overrides = {}) => ({
  id: "pathe", userId: "test-user", title: "Pathé", active: true, amount: 34.9,
  startDate: day("2026-10-01"), endDate: null, type: "EXPENSE", frequency: "MONTHLY",
  dayOfMonth: 10, accountId: "main", categoryId: "leisure", detectionTitleNorm: null,
  sourceTransactions: [], activityPeriods: [], ...overrides,
})
function apply(current, patch, date) {
  const result = plan(current, patch, day(date))
  return { ...current, ...patch, ...result.record, activityPeriods: [
    ...current.activityPeriods.map(period => result.updates.find(update => update.id === period.id) ?? period),
    ...result.creates.map((period, index) => ({ ...period, id: `period-${current.activityPeriods.length + index}` })),
  ] }
}

describe("recurring activity history and monthly budgets", () => {
  it("withdraws Pathé from future commitments and recalculates available and free money in cents", () => {
    const before = charge()
    const after = apply(before, { active: false }, "2026-10-10")
    const summary = item => calculateBudgetSummary({ monthlyIncome: 465.9,
      recurringCommittedTotal: 214.31 + total(item, 11), budgetAmounts: [50, 180], spent: 15 })
    assert.equal(summary(before).recurringCommittedTotal, 249.21)
    assert.equal(summary(before).availableForBudgets, 216.69)
    assert.equal(summary(before).freeMoney, -13.31)
    assert.equal(summary(after).recurringCommittedTotal, 214.31)
    assert.equal(summary(after).availableForBudgets, 251.59)
    assert.equal(summary(after).freeMoney, 21.59)
    assert.equal(summary(after).variableBudgetAllocated, 230)
    assert.equal(summary(after).spent, 15)
    assert.equal(total(after, 10), 34.9)
  })

  it("preserves historical months and an inactive month when reactivated in December", () => {
    const stopped = apply(charge({ startDate: day("2026-08-01") }), { active: false }, "2026-10-10")
    const historicalPeriod = structuredClone(stopped.activityPeriods[0])
    const resumed = apply(stopped, { active: true }, "2026-12-15")
    assert.deepEqual(resumed.activityPeriods[0], historicalPeriod)
    assert.equal(resumed.activityPeriods[1].startDate.toISOString().slice(0, 10), "2026-12-15")
    for (const month of [8, 9, 10, 12]) assert.equal(total(resumed, month), 34.9)
    assert.equal(total(resumed, 11), 0)
    assert.equal(total(resumed, 7), 0)
    assert.equal(total(resumed, 1, 2027), 34.9)
  })

  it("respects a new end date and multiple inactive intervals across years", () => {
    let item = apply(charge(), { active: false }, "2026-10-10")
    item = apply(item, { active: true, endDate: day("2026-12-31") }, "2026-12-15")
    assert.equal(total(item, 1, 2027), 0)
    item = apply(item, { active: false }, "2027-01-10")
    item = apply(item, { active: true }, "2027-03-01")
    assert.equal(total(item, 11), 0)
    assert.equal(total(item, 12), 34.9)
    assert.equal(total(item, 1, 2027), 0)
    assert.equal(total(item, 2, 2027), 0)
    assert.equal(total(item, 3, 2027), 34.9)
  })

  it("counts a same-month restart only once and repeated PATCH requests are idempotent", () => {
    const stopped = apply(charge(), { active: false }, "2026-10-10")
    assert.deepEqual(apply(stopped, { active: false }, "2026-10-10"), stopped)
    const resumed = apply(stopped, { active: true }, "2026-10-10")
    assert.equal(resumed.activityPeriods[1].startDate.toISOString().slice(0, 10), "2026-10-11")
    assert.equal(total(resumed, 10), 34.9)
    assert.equal(total(resumed, 11), 34.9)
    assert.deepEqual(apply(resumed, { active: true }, "2026-10-10"), resumed)
  })

  it("cancels a charge before its start without inventing historical activity", () => {
    const stopped = apply(charge({ startDate: day("2026-12-01") }), { active: false }, "2026-10-10")
    assert.equal(stopped.activityPeriods[0].cancelled, true)
    assert.ok(stopped.endDate >= stopped.startDate)
    for (const month of [10, 11, 12]) assert.equal(total(stopped, month), 0)
    const resumed = apply(stopped, { active: true }, "2026-11-01")
    assert.equal(total(resumed, 11), 0)
    assert.equal(total(resumed, 12), 34.9)
  })

  it("rejects backdated reactivation and changes to closed dates", () => {
    const stopped = apply(charge(), { active: false }, "2026-10-10")
    assert.throws(() => apply(stopped, { active: true, startDate: day("2026-11-01") }, "2026-12-15"), RecurringActivityValidationError)
    assert.throws(() => apply(stopped, { endDate: null }, "2026-12-15"), RecurringActivityValidationError)
    assert.throws(() => apply(charge(), { active: false, endDate: day("2026-11-01") }, "2026-10-10"), RecurringActivityValidationError)
  })

  it("keeps closed amounts unchanged if the price changes on reactivation", () => {
    const stopped = apply(charge(), { active: false }, "2026-10-10")
    const resumed = apply(stopped, { active: true, amount: 39.9 }, "2026-12-15")
    assert.equal(total(resumed, 10), 34.9)
    assert.equal(total(resumed, 11), 0)
    assert.equal(total(resumed, 12), 39.9)
  })

  it("imports legacy closed periods without extending them on reactivation", () => {
    const item = apply(charge({ active: false, startDate: day("2026-06-01"), endDate: day("2026-09-30") }), { active: true }, "2026-12-15")
    assert.equal(item.activityPeriods.length, 2)
    assert.equal(total(item, 9), 34.9)
    assert.equal(total(item, 10), 0)
    assert.equal(total(item, 11), 0)
    assert.equal(total(item, 12), 34.9)
  })

  it("refuses to fabricate history for a legacy inactive charge with an unknown end", () => {
    assert.throws(() => apply(charge({ active: false }), { active: true }, "2026-12-15"), RecurringActivityValidationError)
  })

  it("keeps historical real payments matched, while a payment during the gap remains variable", () => {
    const stopped = apply(charge(), { active: false }, "2026-10-10")
    const resumed = apply(stopped, { active: true, amount: 39.9 }, "2026-12-01")
    const payments = [
      { id: "oct", date: "2026-10-10", amount: 34.9 },
      { id: "nov", date: "2026-11-10", amount: 34.9 },
      { id: "dec", date: "2026-12-10", amount: 39.9 },
    ].map(payment => ({ ...payment, title: "Pathé", type: "EXPENSE", accountId: "main", categoryId: "leisure" }))
    const snapshot = structuredClone(payments)
    const result = reconcileRecurringPayments(payments, [resumed])
    assert.deepEqual([...result.matched.keys()], ["oct", "dec"])
    assert.deepEqual(payments, snapshot)
  })

  it("uses the French civil day near midnight, including daylight-saving transitions", () => {
    const { getTodayUtcDayStart } = loadTs("lib/recurring/date-period.ts")
    const RealDate = globalThis.Date
    try {
      for (const [instant, expected] of [["2026-10-10T22:30:00Z", "2026-10-11"], ["2026-12-31T23:30:00Z", "2027-01-01"], ["2026-10-25T00:30:00Z", "2026-10-25"]]) {
        globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [instant])) } }
        assert.equal(getTodayUtcDayStart().toISOString().slice(0, 10), expected)
      }
    } finally { globalThis.Date = RealDate }
  })
})

function backend() {
  let current = charge(), now = day("2026-10-10"), authenticated = true, conflict = false
  const budgets = [{ id: "budget", userId: "test-user", amount: 230 }]
  const bankTransactions = [{ id: "payment", userId: "test-user", title: "Pathé", amount: 34.9, date: day("2026-10-10"), type: "EXPENSE", accountId: "main", categoryId: "leisure" }]
  const accounts = [{ id: "main", userId: "test-user", status: "ACTIVE", balance: 146.67 }]
  const snapshot = () => JSON.stringify({ budgets, bankTransactions, accounts })
  const tx = {
    recurringTransaction: {
      async findFirst({ where }) { return where.id === current.id && where.userId === current.userId ? structuredClone(current) : null },
      async update({ where, data }) {
        assert.equal(where.userId, "test-user")
        current = { ...current, ...data }
        assert.ok(!current.endDate || current.endDate >= current.startDate, "existing SQL date constraint")
        return structuredClone(current)
      },
      async findMany({ where }) { assert.equal(where.userId, "test-user"); return [structuredClone(current)] },
    },
    recurringActivityPeriod: {
      async create({ data }) { assert.equal(data.recurringTransactionId, "pathe"); current.activityPeriods.push({ ...data, amount: Number(data.amount), id: `p${current.activityPeriods.length}` }) },
      async update({ where, data }) { assert.equal(where.recurringTransactionId, "pathe"); Object.assign(current.activityPeriods.find(period => period.id === where.id), data, { amount: Number(data.amount) }) },
    },
    category: { async findFirst({ where }) { return where.userId === "test-user" && where.id === "leisure" && where.type === "EXPENSE" ? { id: "leisure" } : null } },
    account: { async findFirst({ where }) { return accounts.find(account => account.id === where.id && account.userId === where.userId && account.status === where.status) ?? null } },
    transaction: { async findMany({ where }) { assert.equal(where.userId, "test-user"); return bankTransactions.filter(transaction => transaction.date >= where.date.gte && transaction.date < where.date.lt) } },
  }
  const prisma = { ...tx,
    user: { async findUnique() { return { id: "test-user" } } },
    async $transaction(callback, options) {
      assert.equal(options.isolationLevel, "Serializable")
      if (conflict) throw { code: "P2034" }
      const saved = structuredClone(current)
      try { return await callback(tx) } catch (error) { current = saved; throw error }
    },
  }
  const dateModule = loadTs("lib/recurring/date-period.ts")
  const mocks = {
    "@/auth": { auth: async () => authenticated ? { user: { email: "isolated@example.test" } } : null },
    "@/lib/prisma": { prisma }, "@/lib/generated/prisma/client": { Prisma: { Decimal } },
    "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/lib/recurring/date-period": { ...dateModule, getTodayUtcDayStart: () => now },
  }
  const route = loadTs("app/api/recurring-transactions/[id]/route.ts", mocks)
  const activity = loadTs("lib/budgets/monthly-activity.ts", mocks)
  return {
    snapshot, get current() { return current }, set now(value) { now = day(value) },
    set startDate(value) { current.startDate = day(value) },
    set authenticated(value) { authenticated = value }, set conflict(value) { conflict = value },
    activity: month => activity.getMonthlyBudgetActivity("test-user", month, 2026),
    patch: (body, id = "pathe") => route.PATCH(new Request("http://test/api/recurring-transactions/pathe", { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id }) }),
  }
}

describe("secured recurring lifecycle PATCH and shared budget aggregation", () => {
  it("persists separate periods, refreshes calculations and never writes financial records", async () => {
    const app = backend(), initial = app.snapshot()
    assert.equal((await app.activity(11)).recurringCommittedTotal, 34.9)
    let response = await app.patch({ active: false })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).recurringTransaction.active, false)
    assert.equal((await app.activity(10)).recurringCommittedTotal, 34.9)
    assert.equal((await app.activity(10)).spentByCategory.get("leisure"), undefined)
    assert.equal((await app.activity(11)).recurringCommittedTotal, 0)
    app.now = "2026-12-15"
    response = await app.patch({ active: true })
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.recurringTransaction.activityPeriods.length, 2)
    assert.equal(data.recurringTransaction.activityPeriods[0].amount, 34.9)
    assert.equal((await app.activity(11)).recurringCommittedTotal, 0)
    assert.equal((await app.activity(12)).recurringCommittedTotal, 34.9)
    assert.equal(app.snapshot(), initial)
  })

  it("rejects unauthenticated and foreign charge requests without writes", async () => {
    const app = backend(), before = structuredClone(app.current)
    app.authenticated = false
    assert.equal((await app.patch({ active: false })).status, 401)
    app.authenticated = true
    assert.equal((await app.patch({ active: false }, "foreign-charge")).status, 404)
    assert.deepEqual(app.current, before)
  })

  it("can deactivate before the start while respecting the existing SQL date constraint", async () => {
    const app = backend()
    app.startDate = "2026-12-01"
    const response = await app.patch({ active: false })
    assert.equal(response.status, 200)
    assert.equal(app.current.activityPeriods[0].cancelled, true)
    assert.equal((await app.activity(12)).recurringCommittedTotal, 0)
    app.now = "2026-11-01"
    assert.equal((await app.patch({ active: true })).status, 200)
    assert.equal((await app.activity(11)).recurringCommittedTotal, 0)
    assert.equal((await app.activity(12)).recurringCommittedTotal, 34.9)
  })

  it("validates owner account/category and immutable closed periods", async () => {
    const app = backend()
    assert.equal((await app.patch({ active: true, accountId: "foreign-account" })).status, 400)
    assert.equal((await app.patch({ active: true, categoryId: "foreign-category" })).status, 400)
    assert.equal((await app.patch({ active: "false" })).status, 400)
    assert.equal((await app.patch({ active: false })).status, 200)
    app.now = "2026-12-15"
    assert.equal((await app.patch({ active: true, startDate: "2026-11-01" })).status, 400)
    assert.equal((await app.patch({ endDate: null })).status, 400)
    assert.equal(app.current.active, false)
  })

  it("returns a useful 409 for concurrent changes and leaves state unchanged", async () => {
    const app = backend(), before = structuredClone(app.current)
    app.conflict = true
    const response = await app.patch({ active: false })
    assert.equal(response.status, 409)
    assert.match((await response.json()).message, /simultanément/)
    assert.deepEqual(app.current, before)
  })
})
