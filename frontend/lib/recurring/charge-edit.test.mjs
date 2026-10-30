import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Decimal } from "@prisma/client/runtime/client"
import { loadTs } from "../testing/load-ts.mjs"

const { getRecurringChargeFormValues, getRecurringChargeEditPayload, needsRecurringPeriodCorrection } = loadTs("lib/recurring/charge-form.ts")
const { getRecurringCommittedTotal } = loadTs("lib/budgets/recurring-commitments.ts")
const { calculateBudgetSummary } = loadTs("lib/budgets/summary.ts")
const date = value => new Date(`${value}T00:00:00Z`)
const category = { id: "software", name: "Logiciels", type: "EXPENSE" }
const account = { id: "main", name: "Compte isolé", status: "ACTIVE" }
function recurring(overrides = {}) {
  return { id: "adobe", userId: "u1", title: "Adobe", amount: 40.32, type: "EXPENSE", frequency: "MONTHLY", active: false,
    dayOfMonth: 5, startDate: date("2026-06-25"), endDate: date("2026-10-02"), accountId: "main", categoryId: "software",
    category, account, detectionTitleNorm: "adobe", detectionAccountId: "main", activityPeriods: [], ...overrides }
}
const jsonCharge = value => JSON.parse(JSON.stringify(value))

describe("shared recurring creation and edit form", () => {
  it("prefills all fields from the selected charge, without confusing payment and contract end dates", () => {
    const item = jsonCharge(recurring({ lastPaymentDate: date("2026-09-05") }))
    assert.deepEqual(getRecurringChargeFormValues(item, 11, 2026), {
      title: "Adobe", amount: "40,32", categoryId: "software", accountId: "main", dayOfMonth: "5", startDate: "2026-06-25", endDate: "2026-10-02",
    })
    const values = { ...getRecurringChargeFormValues(item, 11, 2026), endDate: "2026-09-30" }
    assert.deepEqual(getRecurringChargeEditPayload(values, item), { endDate: "2026-09-30" })
    assert.equal(needsRecurringPeriodCorrection(values, item, "2026-10-10"), true)
  })

  it("edits only changed fields and never sends active, identity or real banking data", () => {
    const item = jsonCharge(recurring())
    const values = { ...getRecurringChargeFormValues(item, 10, 2026), title: "  Adobe photo  ", amount: "42,99", accountId: "other-owned", categoryId: "leisure", dayOfMonth: "6" }
    assert.deepEqual(getRecurringChargeEditPayload(values, item), { title: "Adobe photo", amount: 42.99, accountId: "other-owned", categoryId: "leisure", dayOfMonth: 6 })
    assert.deepEqual(getRecurringChargeEditPayload(getRecurringChargeFormValues(item, 10, 2026), item), {})
  })

  it("prefills the latest applicable period after reactivation, not the root historical start", () => {
    const item = jsonCharge(recurring({ active: true, endDate: null, activityPeriods: [
      { id: "old", startDate: date("2026-06-25"), endDate: date("2026-09-30"), cancelled: false },
      { id: "current", startDate: date("2026-12-15"), endDate: null, cancelled: false },
    ] }))
    assert.equal(getRecurringChargeFormValues(item, 12, 2026).startDate, "2026-12-15")
    assert.equal(getRecurringChargeFormValues(item, 12, 2026).endDate, "")
    const values = { ...getRecurringChargeFormValues(item, 12, 2026), title: "Adobe nouveau nom" }
    assert.equal(needsRecurringPeriodCorrection(values, item, "2026-12-20"), false)
  })

  it("keeps creation defaults and does not preselect an account", () => {
    const values = getRecurringChargeFormValues(undefined, 11, 2026)
    assert.equal(values.accountId, "")
    assert.equal(values.startDate, "2026-11-01")
  })
})

function fixture(overrides = {}) {
  let item = recurring(overrides), authenticated = true, concurrent = false
  const transactions = [{ id: "adobe-payment", userId: "u1", title: "Adobe", amount: 40.32, type: "EXPENSE", date: date("2026-09-05"), accountId: "main", categoryId: "software" }]
  const sources = [{ id: "source", transactionId: "adobe-payment", recurringTransactionId: "adobe" }]
  const budgets = [{ id: "b", amount: 50, categoryId: "software", month: 10, year: 2026 }]
  const accounts = [account, { ...account, id: "other-owned", name: "Autre compte isolé" }]
  const snapshot = () => JSON.stringify({ transactions, sources, budgets, accounts })
  const forbidden = () => { throw new Error("Financial or association writes forbidden") }
  const read = () => ({ ...structuredClone(item), sourceTransactions: sources.map(source => ({ transactionId: source.transactionId, transaction: { date: transactions.find(t => t.id === source.transactionId).date } })) })
  const tx = {
    recurringTransaction: {
      async findFirst({ where }) { return where.id === "adobe" && where.userId === "u1" ? read() : null },
      async findMany({ where }) { assert.equal(where.userId, "u1"); return [read()] },
      async update({ where, data }) {
        assert.equal(where.userId, "u1")
        assert.equal(Object.hasOwn(data, "confirmPeriodCorrection"), false)
        item = { ...item, ...data, amount: Number(data.amount ?? item.amount) }
        assert.ok(!item.endDate || item.endDate >= item.startDate)
        return read()
      },
    },
    recurringActivityPeriod: {
      async create({ data }) {
        if (!data.endDate && !data.cancelled) assert.equal(item.activityPeriods.some(p => !p.endDate && !p.cancelled), false, "only one open period SQL constraint")
        item.activityPeriods.push({ ...data, amount: Number(data.amount), id: `p${item.activityPeriods.length}` })
      },
      async update({ where, data }) { assert.equal(where.recurringTransactionId, "adobe"); Object.assign(item.activityPeriods.find(p => p.id === where.id), data, { amount: Number(data.amount) }) },
    },
    category: { async findFirst({ where }) { return where.userId === "u1" && where.type === "EXPENSE" && ["software", "leisure"].includes(where.id) ? { id: where.id } : null } },
    account: { async findFirst({ where }) { return where.userId === "u1" && where.status === "ACTIVE" ? accounts.find(a => a.id === where.id) ?? null : null }, update: forbidden, delete: forbidden },
    transaction: { async findMany({ where }) { assert.equal(where.userId, "u1"); return transactions.filter(t => t.date >= where.date.gte && t.date < where.date.lt) }, create: forbidden, update: forbidden, delete: forbidden },
    recurringTransactionSource: { create: forbidden, update: forbidden, delete: forbidden },
    budget: { create: forbidden, update: forbidden, delete: forbidden },
  }
  const prisma = { ...tx, user: { findUnique: async () => ({ id: "u1" }) }, async $transaction(callback, options) {
    assert.equal(options.isolationLevel, "Serializable")
    if (concurrent) throw { code: "P2034" }
    const saved = structuredClone(item)
    try { return await callback(tx) } catch (error) { item = saved; throw error }
  } }
  const dateModule = loadTs("lib/recurring/date-period.ts")
  const mocks = { "@/auth": { auth: async () => authenticated ? { user: { email: "isolated@example.invalid" } } : null }, "@/lib/prisma": { prisma },
    "@/lib/generated/prisma/client": { Prisma: { Decimal } }, "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/lib/recurring/date-period": { ...dateModule, getTodayUtcDayStart: () => date("2026-10-10") } }
  const { PATCH } = loadTs("app/api/recurring-transactions/[id]/route.ts", mocks)
  const { getMonthlyBudgetActivity } = loadTs("lib/budgets/monthly-activity.ts", mocks)
  return {
    get item() { return item }, transactions, sources, snapshot,
    set authenticated(value) { authenticated = value }, set concurrent(value) { concurrent = value },
    patch: (payload, id = "adobe") => PATCH(new Request("http://test/api/recurring-transactions/adobe", { method: "PATCH", body: JSON.stringify(payload) }), { params: Promise.resolve({ id }) }),
    total: month => getRecurringCommittedTotal({ recurringTransactions: [item], month, year: 2026 }),
    activity: month => getMonthlyBudgetActivity("u1", month, 2026),
  }
}

describe("secured charge editing and budget recalculation", () => {
  it("corrects Adobe's effective termination into September and retains its actual September payment", async () => {
    const f = fixture(), before = f.snapshot()
    assert.equal(f.total(10), 40.32)
    const response = await f.patch({ endDate: "2026-09-30", confirmPeriodCorrection: true })
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.recurringTransaction.active, false)
    assert.equal(data.recurringTransaction.endDate.slice(0, 10), "2026-09-30")
    assert.equal(data.recurringTransaction.lastPaymentDate.slice(0, 10), "2026-09-05")
    assert.equal(f.total(9), 40.32)
    assert.equal(f.total(10), 0)
    assert.equal((await f.activity(9)).spentByCategory.get("software"), undefined)
    const summary = calculateBudgetSummary({ monthlyIncome: 465.9, recurringCommittedTotal: (await f.activity(10)).recurringCommittedTotal, budgetAmounts: [50], spent: 0 })
    assert.equal(summary.availableForBudgets, 465.9)
    assert.equal(summary.freeMoney, 415.9)
    assert.equal(f.snapshot(), before)
  })

  it("corrects an existing closed period, not only legacy root dates", async () => {
    const f = fixture({ activityPeriods: [{ id: "closed", startDate: date("2026-06-25"), endDate: date("2026-10-02"), amount: 40.32, cancelled: false, accountId: "main", dayOfMonth: 5 }] })
    assert.equal((await f.patch({ endDate: "2026-09-30", confirmPeriodCorrection: true })).status, 200)
    assert.equal(f.item.activityPeriods.length, 1)
    assert.equal(f.item.activityPeriods[0].endDate.toISOString().slice(0, 10), "2026-09-30")
    assert.equal(f.total(9), 40.32)
    assert.equal(f.total(10), 0)
  })

  it("requires confirmation for historical dates and refuses inverted, empty inactive and invalid dates", async () => {
    const f = fixture(), before = structuredClone(f.item)
    for (const body of [{ endDate: "2026-09-30" }, { endDate: null, confirmPeriodCorrection: true }, { endDate: "2026-05-01", confirmPeriodCorrection: true }, { endDate: "2026-02-31", confirmPeriodCorrection: true }, { confirmPeriodCorrection: true }]) {
      assert.equal((await f.patch(body)).status, 400)
      assert.deepEqual(f.item, before)
    }
  })

  it("does not infer the effective end from the last bank payment", async () => {
    const f = fixture()
    const response = await f.patch({ title: "Adobe photo" })
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.recurringTransaction.endDate.slice(0, 10), "2026-10-02")
    assert.equal(data.recurringTransaction.lastPaymentDate.slice(0, 10), "2026-09-05")
    assert.equal(f.total(10), 40.32)
  })

  it("changes the active monthly price from the current month without rewriting earlier months", async () => {
    const f = fixture({ active: true, endDate: null })
    assert.equal((await f.patch({ amount: 45.99 })).status, 200)
    assert.equal(f.item.activityPeriods.length, 2)
    assert.equal(f.total(9), 40.32)
    assert.equal(f.total(10), 45.99)
    assert.equal(f.total(11), 45.99)
    assert.equal((await f.activity(9)).spentByCategory.get("software"), undefined)
  })

  it("closes an existing open period before creating the new price period", async () => {
    const f = fixture({ active: true, endDate: null, activityPeriods: [{ id: "open", startDate: date("2026-06-25"), endDate: null, amount: 40.32, cancelled: false }] })
    assert.equal((await f.patch({ amount: 42.99 })).status, 200)
    assert.equal(f.total(9), 40.32)
    assert.equal(f.total(10), 42.99)
    assert.equal(f.item.activityPeriods.filter(p => p.endDate === null).length, 1)
  })

  it("updates an inactive charge's future amount but freezes its previous committed amounts", async () => {
    const f = fixture()
    assert.equal((await f.patch({ amount: 45.99 })).status, 200)
    assert.equal(f.item.amount, 45.99)
    assert.equal(f.total(9), 40.32)
    assert.equal(f.total(10), 40.32)
    assert.equal(f.total(11), 0)
  })

  it("keeps actual associations and historical matching after editing the account and scheduled day", async () => {
    const f = fixture({ active: true, endDate: null }), before = f.snapshot()
    assert.equal((await f.patch({ accountId: "other-owned", dayOfMonth: 20 })).status, 200)
    assert.equal(f.item.accountId, "other-owned")
    assert.equal(f.item.dayOfMonth, 20)
    assert.equal(f.item.activityPeriods[0].accountId, "main")
    assert.equal(f.item.activityPeriods[0].dayOfMonth, 5)
    assert.equal((await f.activity(9)).spentByCategory.get("software"), undefined)
    assert.equal(f.snapshot(), before)
  })

  it("preserves the detection identity when renaming an automatically confirmed charge", async () => {
    const f = fixture(), before = f.snapshot()
    assert.equal((await f.patch({ title: "Adobe photographie" })).status, 200)
    assert.equal(f.item.detectionTitleNorm, "adobe")
    assert.equal(f.item.detectionAccountId, "main")
    assert.equal(f.snapshot(), before)
  })

  it("keeps manual charge historical title matching on rename", async () => {
    const f = fixture({ detectionTitleNorm: null })
    assert.equal((await f.patch({ title: "Adobe photographie" })).status, 200)
    assert.equal(f.item.detectionTitleNorm, "adobe")
  })

  it("rejects cross-user edits, invalid amounts and invalid schedules", async () => {
    const f = fixture(), before = structuredClone(f.item)
    f.authenticated = false
    assert.equal((await f.patch({ title: "Nom" })).status, 401)
    f.authenticated = true
    assert.equal((await f.patch({ title: "Nom" }, "other-users-charge")).status, 404)
    for (const body of [{ accountId: "foreign" }, { categoryId: "foreign" }, { amount: 0 }, { amount: -1 }, { amount: 0.001 }, { dayOfMonth: 32 }, { dayOfMonth: 0 }, { frequency: "YEARLY" }, { userId: "other" }, { title: " " }]) assert.equal((await f.patch(body)).status, 400)
    assert.deepEqual(f.item, before)
  })

  it("rejects a correction overlapping a previous activity period and preserves closed history", async () => {
    const f = fixture({ startDate: date("2026-06-01"), endDate: date("2026-10-02"), activityPeriods: [
      { id: "old", startDate: date("2026-06-01"), endDate: date("2026-07-31"), amount: 35, cancelled: false },
      { id: "last", startDate: date("2026-09-01"), endDate: date("2026-10-02"), amount: 40.32, cancelled: false },
    ] })
    const old = structuredClone(f.item.activityPeriods[0])
    assert.equal((await f.patch({ startDate: "2026-07-20", confirmPeriodCorrection: true })).status, 400)
    assert.equal((await f.patch({ endDate: "2026-09-30", confirmPeriodCorrection: true })).status, 200)
    assert.deepEqual(f.item.activityPeriods[0], old)
    assert.equal(f.total(7), 35)
    assert.equal(f.total(8), 0)
    assert.equal(f.total(9), 40.32)
    assert.equal(f.total(10), 0)
  })

  it("returns 409 for concurrent modifications without changing financial records", async () => {
    const f = fixture(), before = f.snapshot()
    f.concurrent = true
    assert.equal((await f.patch({ title: "Nom" })).status, 409)
    assert.equal(f.snapshot(), before)
  })
})
