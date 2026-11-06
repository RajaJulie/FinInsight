/**
 * Verifie l'ajustement des charges prevues par les paiements rapproches du mois
 * et l'exclusion prudente des suggestions correspondant deja a une recurrence confirmee.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loadTs } from "../testing/load-ts.mjs"

const { calculateBudgetSummary } = loadTs("lib/budgets/summary.ts")
const { getRecurringCommittedTotal } = loadTs("lib/budgets/recurring-commitments.ts")
const { detectRecurringTransactionSuggestions } = loadTs("lib/recurring/detection.ts")
const date = value => new Date(`${value}T00:00:00Z`)
const transaction = (id, amount, overrides = {}) => ({ id, userId: "u1", title: "Free Mobile", amount, type: "EXPENSE", date: date("2026-10-07"), accountId: "main", categoryId: "telecom", category: null, account: null, ...overrides })
const charge = (overrides = {}) => ({ id: "free", userId: "u1", title: "Forfait Free", amount: 19.99, type: "EXPENSE", frequency: "MONTHLY", active: true, accountId: "main", categoryId: "telecom", dayOfMonth: 6, startDate: date("2026-06-01"), endDate: null, detectionTitleNorm: "free mobile", detectionAccountId: "main", detectionType: "EXPENSE", activityPeriods: [], sourceTransactions: [{ transactionId: "payment" }], ...overrides })

function fixture({ charges = [charge()], transactions = [transaction("payment", 20.31)] } = {}) {
  const bank = [...transactions, transaction("income", 625.9, { title: "Salaire", type: "INCOME" }), transaction("foreign", 999, { userId: "u2", type: "INCOME" })]
  const before = JSON.stringify({ bank, charges })
  const prisma = {
    transaction: { async findMany({ where }) { return bank.filter(t => t.userId === where.userId && where.type.in.includes(t.type) && t.date >= where.date.gte && t.date < where.date.lt) } },
    recurringTransaction: { async findMany({ where }) { return charges.filter(r => r.userId === where.userId && r.type === where.type && r.frequency === where.frequency) } },
  }
  const { getMonthlyBudgetActivity } = loadTs("lib/budgets/monthly-activity.ts", { "@/lib/prisma": { prisma } })
  return { bank, charges, before, snapshot: () => JSON.stringify({ bank, charges }), activity: (month = 10, year = 2026, userId = "u1") => getMonthlyBudgetActivity(userId, month, year) }
}

describe("actual recurring payments replace only the selected month's forecast", () => {
  for (const amount of [19.99, 20.31, 18.99]) {
    it(`uses the confirmed actual ${amount} and preserves the next monthly price`, async () => {
      const f = fixture({ transactions: [transaction("payment", amount)] })
      const activity = await f.activity()
      assert.equal(activity.recurringCommittedTotal, amount)
      assert.equal(activity.spentByCategory.get("telecom"), undefined)
      assert.equal(activity.pendingPayments.length, 0)
      assert.deepEqual(activity.recurringPayments[0], { recurringTransactionId: "free", title: "Forfait Free", plannedAmount: 19.99, actualAmount: amount, retainedAmount: amount, difference: Math.round((amount - 19.99) * 100) / 100, transactionIds: ["payment"] })
      assert.equal((await f.activity(11)).recurringCommittedTotal, 19.99)
      assert.equal(f.snapshot(), f.before)
    })
  }

  it("matches the exact Free Mobile October example in cents", async () => {
    const f = fixture({ charges: [charge(), charge({ id: "other", title: "Autres charges", detectionTitleNorm: "other", amount: 154, sourceTransactions: [] })] })
    const activity = await f.activity()
    const summary = calculateBudgetSummary({ ...activity, emergencyReserve: 50, budgetAmounts: [100, 200], spent: 0 })
    assert.equal(summary.monthlyIncome, 625.9)
    assert.equal(summary.recurringCommittedTotal, 174.31)
    assert.equal(summary.availableForBudgets, 401.59)
    assert.equal(summary.freeMoney, 101.59)
    assert.equal(f.charges[0].amount, 19.99)
  })

  it("uses the forecast without any real matched payment", async () => {
    const f = fixture({ transactions: [], charges: [charge({ sourceTransactions: [] })] })
    const activity = await f.activity()
    assert.equal(activity.recurringCommittedTotal, 19.99)
    assert.equal(activity.recurringPayments[0].actualAmount, null)
    assert.equal(activity.recurringPayments[0].difference, null)
  })

  it("keeps a variable amount uncertain until manually confirmed", async () => {
    const f = fixture({ charges: [charge({ sourceTransactions: [] })] })
    const activity = await f.activity()
    assert.equal(activity.recurringCommittedTotal, 19.99)
    assert.equal(activity.spentByCategory.get("telecom"), 20.31)
    assert.equal(activity.pendingPayments.length, 1)
    f.charges[0].sourceTransactions.push({ transactionId: "payment" })
    const refreshed = await f.activity()
    assert.equal(refreshed.recurringCommittedTotal, 20.31)
    assert.equal(refreshed.spentByCategory.get("telecom"), undefined)
    assert.equal(refreshed.pendingPayments.length, 0)
  })

  it("does not choose between similar payments and leaves the extra payment variable after confirmation", async () => {
    const f = fixture({ transactions: [transaction("a", 19.99), transaction("b", 19.99)], charges: [charge({ sourceTransactions: [] })] })
    assert.equal((await f.activity()).spentByCategory.get("telecom"), 39.98)
    f.charges[0].sourceTransactions.push({ transactionId: "a" })
    const activity = await f.activity()
    assert.equal(activity.recurringCommittedTotal, 19.99)
    assert.equal(activity.spentByCategory.get("telecom"), 19.99)
    assert.deepEqual(activity.recurringPayments[0].transactionIds, ["a"])
  })

  it("sums multiple valid persisted associations once per unique bank transaction", async () => {
    const f = fixture({ transactions: [transaction("a", 10), transaction("b", 10.31), transaction("a", 10)], charges: [charge({ sourceTransactions: [{ transactionId: "a" }, { transactionId: "a" }, { transactionId: "b" }] })] })
    const activity = await f.activity()
    assert.equal(activity.recurringCommittedTotal, 20.31)
    assert.deepEqual(activity.recurringPayments[0].transactionIds, ["a", "b"])
    assert.equal(activity.spentByCategory.get("telecom"), undefined)
  })

  it("does not count a conflicting transaction for two charges", async () => {
    const f = fixture({ charges: [charge(), charge({ id: "conflicting" })] })
    const activity = await f.activity()
    assert.equal(activity.recurringCommittedTotal, 39.98)
    assert.equal(activity.spentByCategory.get("telecom"), 20.31)
    assert.equal(activity.recurringPayments.every(p => p.actualAmount === null), true)
  })

  it("removes Pathé from the variable leisure envelope, without removing the bank transaction", async () => {
    const f = fixture({ transactions: [transaction("payment", 34.9, { title: "Pathé", categoryId: "leisure" })], charges: [charge({ title: "Pathé", detectionTitleNorm: null, amount: 34.9, categoryId: "leisure", dayOfMonth: 7 })] })
    const activity = await f.activity()
    assert.equal(activity.recurringCommittedTotal, 34.9)
    assert.equal(100 - (activity.spentByCategory.get("leisure") ?? 0), 100)
    assert.equal(f.bank.find(t => t.id === "payment").amount, 34.9)
    assert.equal(f.snapshot(), f.before)
  })

  it("uses actual historical payment amounts for an inactive charge but nothing after its end", async () => {
    const f = fixture({ charges: [charge({ active: false, endDate: date("2026-10-31") })] })
    assert.equal((await f.activity()).recurringCommittedTotal, 20.31)
    assert.equal((await f.activity(11)).recurringCommittedTotal, 0)
  })

  it("ignores invalid associations outside the account or activity period", async () => {
    for (const overrides of [{ accountId: "other" }, { startDate: date("2026-11-01") }, { endDate: date("2026-09-30") }]) {
      const f = fixture({ charges: [charge(overrides)] })
      assert.equal((await f.activity()).spentByCategory.get("telecom"), 20.31)
      assert.equal((await f.activity()).recurringPayments.every(p => p.actualAmount === null), true)
    }
  })

  it("keeps data isolated between users and preserves negative budgets", async () => {
    const f = fixture({ charges: [charge(), charge({ id: "foreign", userId: "u2", amount: 999 })] })
    const activity = await f.activity()
    assert.equal(activity.monthlyIncome, 625.9)
    assert.equal(activity.recurringCommittedTotal, 20.31)
    assert.equal((await f.activity(10, 2026, "u2")).recurringCommittedTotal, 999)
    const summary = calculateBudgetSummary({ ...activity, emergencyReserve: 50, budgetAmounts: [600], spent: 0 })
    assert.equal(summary.freeMoney, -44.41)
  })

  it("never trusts actual overrides for charges outside their applicable month", () => {
    assert.equal(getRecurringCommittedTotal({ recurringTransactions: [charge({ endDate: date("2026-09-30") })], month: 10, year: 2026, actualAmountsByRecurringId: new Map([["free", 20.31]]) }), 0)
  })
})

describe("conservative duplicate suggestions for confirmed subscriptions", () => {
  it("does not repropose a known subscription for a small amount variation", () => {
    const transactions = [transaction("sep", 20.51, { date: date("2026-09-07") }), transaction("oct", 20.31)]
    assert.deepEqual(detectRecurringTransactionSuggestions({ transactions, recurringTransactions: [charge({ sourceTransactions: [] })] }), [])
  })

  it("keeps a temporally distinct OpenAI series despite identical titles and amounts", () => {
    const a = transaction("a-jun", 23, { title: "OpenAI", date: date("2026-06-15") })
    const b = transaction("a-jul", 23, { title: "OpenAI", date: date("2026-07-13") })
    const transactions = [a, b, transaction("b-jun", 23, { title: "OpenAI", date: date("2026-06-22") }), transaction("b-jul", 23, { title: "OpenAI", date: date("2026-07-21") })]
    const suggestions = detectRecurringTransactionSuggestions({ transactions, recurringTransactions: [charge({ title: "OpenAI", detectionTitleNorm: "openai", amount: 23, dayOfMonth: 14, sourceTransactions: [a, b].map(t => ({ transactionId: t.id, date: t.date, amount: t.amount, title: t.title })) })] })
    assert.equal(suggestions.length, 1)
    assert.deepEqual(suggestions[0].occurrences.map(o => o.transactionId), ["b-jun", "b-jul"])
  })

  it("does not hide a different account, a merely similar title or a different amount", () => {
    for (const changes of [{ accountId: "other" }, { title: "Free Mobile Pro" }, { amount: 18.92 }]) {
      const transactions = [transaction("sep", 19.99, { date: date("2026-09-07"), ...changes }), transaction("oct", 19.99, changes)]
      assert.equal(detectRecurringTransactionSuggestions({ transactions, recurringTransactions: [charge({ sourceTransactions: [] })] }).length, 1)
    }
  })

  it("does not hide an ambiguous second payment around the same billing day", () => {
    const transactions = [transaction("a-sep", 19.99, { date: date("2026-09-05") }), transaction("b-sep", 19.99, { date: date("2026-09-07") }), transaction("a-oct", 19.99, { date: date("2026-10-05") }), transaction("b-oct", 19.99)]
    assert.ok(detectRecurringTransactionSuggestions({ transactions, recurringTransactions: [charge({ sourceTransactions: [] })] }).length > 0)
  })

  it("respects inactive gaps instead of suppressing a resumed subscription", () => {
    const transactions = [transaction("nov", 20.31, { date: date("2026-11-07") }), transaction("dec", 20.31, { date: date("2026-12-07") })]
    assert.equal(detectRecurringTransactionSuggestions({ transactions, recurringTransactions: [charge({ active: false, endDate: date("2026-10-31"), sourceTransactions: [] })] }).length, 1)
  })
})
