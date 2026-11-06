/**
 * Teste les calculs purs des objectifs : affectations, liberations, progression,
 * reservations partagees et couverture insuffisante, sans modifier les donnees fournies.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Decimal } from "@prisma/client/runtime/client"
import { loadTs } from "../testing/load-ts.mjs"

const { getGoalAccumulatedAmount, getGoalSummary, getReservedByAccount, getAccountFunding, assertCanAllocate, assertCanRelease } = loadTs("lib/goals/calculations.ts")
const hasCode = code => error => error?.name === "GoalRuleError" && error.code === code
const allocation = amount => ({ type: "ALLOCATION", amount })
const release = amount => ({ type: "RELEASE", amount })
const goal = (id, accountId, entries = [], status = "ACTIVE") => ({ id, accountId, entries, status })
const summary = (entries, targetAmount = 100) => getGoalSummary({ targetAmount, entries })

describe("virtual savings goal journal", () => {
  it("returns an empty goal without inventing opening savings", () => {
    assert.equal(getGoalAccumulatedAmount([]), 0)
    assert.deepEqual(summary([]), { accumulatedAmount: 0, progressPercentage: 0, remainingAmount: 100, excessAmount: 0, reached: false })
  })
  it("accumulates successive allocations and releases using the journal only", () => {
    const entries = [allocation(10), allocation("20.31"), release(new Decimal("5.22"))]
    assert.equal(getGoalAccumulatedAmount(entries), 25.09)
    assert.deepEqual(summary(entries), { accumulatedAmount: 25.09, progressPercentage: 25.09, remainingAmount: 74.91, excessAmount: 0, reached: false })
  })
  it("allows an exact release, refuses excess, and does not insert any entry", () => {
    const entries = [allocation(20), release(5)]
    assert.doesNotThrow(() => assertCanRelease({ entries, amount: 15 }))
    assert.throws(() => assertCanRelease({ entries, amount: 15.01 }), hasCode("EXCESSIVE_RELEASE"))
    assert.equal(getGoalAccumulatedAmount([...entries, release(15)]), 0)
    assert.equal(entries.length, 2)
    assert.throws(() => assertCanRelease({ entries: [], amount: 0.01 }), hasCode("EXCESSIVE_RELEASE"))
  })
  it("rejects an invalid journal with a net negative balance or unknown movement type", () => {
    assert.throws(() => getGoalAccumulatedAmount([allocation(5), release(5.01)]), hasCode("NEGATIVE_GOAL_BALANCE"))
    assert.throws(() => getGoalAccumulatedAmount([{ type: "TRANSFER", amount: 1 }]), hasCode("INVALID_ENTRY_TYPE"))
  })
  it("derives reached status at the exact target and preserves amounts over the target", () => {
    assert.deepEqual(summary([allocation(100)]), { accumulatedAmount: 100, progressPercentage: 100, remainingAmount: 0, excessAmount: 0, reached: true })
    assert.deepEqual(summary([allocation(125)]), { accumulatedAmount: 125, progressPercentage: 125, remainingAmount: 0, excessAmount: 25, reached: true })
    assert.equal(summary([allocation(100), release(1)]).reached, false)
    assert.equal(summary([allocation(1)], 3).progressPercentage, 33.33)
  })
  it("bases reached status on cents, not a rounded progress percentage", () => {
    const result = summary([allocation("9999.99")], 10000)
    assert.equal(result.progressPercentage, 100)
    assert.equal(result.reached, false)
    assert.equal(result.remainingAmount, 0.01)
  })
  it("keeps exact cents through repeated allocations and releases", () => {
    const entries = [...Array.from({ length: 1000 }, () => allocation("0.01")), release("0.29"), release("0.01")]
    assert.equal(getGoalAccumulatedAmount(entries), 9.7)
    assert.equal(summary(entries, "10.00").remainingAmount, 0.3)
    assert.equal(summary([allocation(0.1), allocation(0.2)], 0.3).reached, true)
  })
  it("enforces positive two-decimal targets and entries at every public monetary operation", () => {
    for (const invalid of [0, -1, 1.001, NaN, Infinity, "1.000"]) {
      assert.throws(() => summary([], invalid), hasCode("INVALID_MONEY"))
      assert.throws(() => getGoalAccumulatedAmount([allocation(invalid)]), hasCode("INVALID_MONEY"))
      assert.throws(() => getGoalAccumulatedAmount([release(invalid)]), hasCode("INVALID_MONEY"))
      assert.throws(() => assertCanRelease({ entries: [allocation(100)], amount: invalid }), hasCode("INVALID_MONEY"))
    }
  })
})

describe("account-level reservations", () => {
  const goals = [
    goal("first", "lcl", [allocation(100), release(25)]),
    goal("second", "lcl", [allocation(50)], "PAUSED"),
    goal("third", "lcl", [allocation(25)], "ARCHIVED"),
    goal("other", "revolut", [allocation(400)]),
  ]
  it("aggregates several goals per account, including paused and archived money", () => {
    assert.deepEqual([...getReservedByAccount(goals)], [["lcl", 150], ["revolut", 400]])
    assert.equal(getGoalAccumulatedAmount(goals[1].entries), 50)
    assert.equal(getGoalAccumulatedAmount(goals[2].entries), 25)
    assert.deepEqual([...getReservedByAccount([])], [])
  })
  it("reports unreserved funds without modifying bank balances", () => {
    assert.deepEqual(getAccountFunding({ accountId: "lcl", bankBalance: 200, goals }), {
      reservedAmount: 150, unreservedAmount: 50, underfunded: false, shortfallAmount: 0,
    })
    assert.deepEqual(getAccountFunding({ accountId: "empty", bankBalance: 10.31, goals }), {
      reservedAmount: 0, unreservedAmount: 10.31, underfunded: false, shortfallAmount: 0,
    })
  })
  it("checks the additional allocation against all money already reserved on that account", () => {
    assert.doesNotThrow(() => assertCanAllocate({ goalId: "first", amount: 50, bankBalance: 200, goals }))
    assert.throws(() => assertCanAllocate({ goalId: "first", amount: 50.01, bankBalance: 200, goals }), hasCode("INSUFFICIENT_UNRESERVED_FUNDS"))
    assert.doesNotThrow(() => assertCanAllocate({ goalId: "other", amount: 0.01, bankBalance: 400.01, goals }))
  })
  it("permits exactly funded balances, but no further allocation", () => {
    assert.equal(getAccountFunding({ accountId: "lcl", bankBalance: 150, goals }).underfunded, false)
    assert.throws(() => assertCanAllocate({ goalId: "first", amount: 0.01, bankBalance: 150, goals }), hasCode("INSUFFICIENT_UNRESERVED_FUNDS"))
  })
  it("does not subtract a goal's existing balance twice when checking a new allocation", () => {
    const snapshot = [goal("g", "bank", [allocation(100)])]
    assert.doesNotThrow(() => assertCanAllocate({ goalId: "g", amount: 200, bankBalance: 300, goals: snapshot }))
    const after = [goal("g", "bank", [allocation(100), allocation(200)])]
    assert.equal(getAccountFunding({ accountId: "bank", bankBalance: 300, goals: after }).unreservedAmount, 0)
    assert.throws(() => assertCanAllocate({ goalId: "g", amount: 0.01, bankBalance: 300, goals: after }), hasCode("INSUFFICIENT_UNRESERVED_FUNDS"))
  })
  it("identifies underfunding after a bank balance falls without altering reservations", () => {
    assert.deepEqual(getAccountFunding({ accountId: "lcl", bankBalance: 120.31, goals }), {
      reservedAmount: 150, unreservedAmount: -29.69, underfunded: true, shortfallAmount: 29.69,
    })
    assert.throws(() => assertCanAllocate({ goalId: "first", amount: 0.01, bankBalance: 120.31, goals }), hasCode("INSUFFICIENT_UNRESERVED_FUNDS"))
    assert.equal(getReservedByAccount(goals).get("lcl"), 150)
  })
  it("keeps negative bank balances visible, including an account without goals", () => {
    assert.deepEqual(getAccountFunding({ accountId: "empty", bankBalance: -0.1, goals }), {
      reservedAmount: 0, unreservedAmount: -0.1, underfunded: true, shortfallAmount: 0.1,
    })
    assert.equal(getAccountFunding({ accountId: "lcl", bankBalance: -10, goals }).unreservedAmount, -160)
  })
  it("refuses duplicate goal snapshots rather than reserving them twice", () => {
    assert.throws(() => getReservedByAccount([goals[0], goals[0]]), hasCode("DUPLICATE_GOAL"))
    assert.throws(() => assertCanAllocate({ goalId: "missing", amount: 1, bankBalance: 200, goals }), hasCode("GOAL_NOT_FOUND"))
  })
  it("validates allocation inputs without silently rounding or clamping", () => {
    for (const amount of [0, -1, 0.001, NaN, Infinity]) {
      assert.throws(() => assertCanAllocate({ goalId: "first", amount, bankBalance: 200, goals }), hasCode("INVALID_MONEY"))
    }
    assert.throws(() => getAccountFunding({ accountId: "lcl", bankBalance: "200.001", goals }), hasCode("INVALID_MONEY"))
  })
  it("does not mutate frozen goals, entries, or surrounding financial records", () => {
    const entries = Object.freeze([Object.freeze(allocation(10))])
    const snapshot = Object.freeze([Object.freeze(goal("g", "bank", entries, "ARCHIVED"))])
    const financialData = Object.freeze({ bankBalance: 20, transactionCount: 4, transferCount: 1, income: 30, expense: 10, budget: 8, emergencyReserve: 2 })
    const before = JSON.stringify({ snapshot, financialData })
    getGoalSummary({ targetAmount: 20, entries })
    getReservedByAccount(snapshot)
    getAccountFunding({ accountId: "bank", bankBalance: financialData.bankBalance, goals: snapshot })
    assertCanRelease({ amount: 1, entries })
    assertCanAllocate({ goalId: "g", amount: 1, bankBalance: financialData.bankBalance, goals: snapshot })
    assert.equal(JSON.stringify({ snapshot, financialData }), before)
  })
  it("checks snapshots only: two calls do not simulate an atomic reservation", () => {
    const snapshot = [goal("g", "bank")]
    assert.doesNotThrow(() => assertCanAllocate({ goalId: "g", amount: 70, bankBalance: 100, goals: snapshot }))
    assert.doesNotThrow(() => assertCanAllocate({ goalId: "g", amount: 70, bankBalance: 100, goals: snapshot }))
    assert.equal(getReservedByAccount(snapshot).get("bank"), 0)
  })
})
