/** Teste les contrats des formulaires et les requetes virtuelles sans base de donnees. */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loadTs } from "../testing/load-ts.mjs"

const cache = new Map()
const forms = loadTs("lib/goals/forms.ts", {}, cache)
const { GoalRequestError, requestGoals } = loadTs("lib/goals/client.ts", {}, cache)
const { createGoalEntryIntent } = loadTs("lib/goals/entry-intent.ts", {}, cache)
const account = { id: "a", name: "Compte de test", status: "ACTIVE", currency: "EUR", unreservedAmount: 30.31, hasFutureEntries: false }
const goal = { id: "g", title: "Projet", accountId: "a", targetAmount: 100, targetDate: "2027-06-30T00:00:00.000Z", status: "ACTIVE", accumulatedAmount: 20.31, account }

describe("goals frontend forms use the actual backend schemas", () => {
  it("starts without a preselected account and does not allocate money when creating", () => {
    assert.equal(forms.goalFormDefaults().accountId, "")
    const input = { ...forms.goalFormDefaults(), title: " Vacances ", accountId: "a", targetAmount: "1000,29" }
    assert.deepEqual(forms.buildGoalFormPayload(input), { title: "Vacances", accountId: "a", targetAmount: 1000.29, targetDate: null })
  })
  it("prefills edits and sends no owner, account change, accumulated amount or journal", () => {
    const input = forms.goalFormDefaults(goal)
    assert.equal(input.targetDate, "2027-06-30")
    assert.deepEqual(forms.buildGoalFormPayload({ ...input, title: "Autre projet", accountId: "foreign", status: "PAUSED", targetDate: "" }, goal), {
      title: "Autre projet", targetAmount: 100, status: "PAUSED", targetDate: null,
    })
  })
  it("rejects empty titles, invalid dates and amounts instead of silently rounding", () => {
    const base = { ...forms.goalFormDefaults(), title: "Projet", accountId: "a", targetAmount: "100" }
    for (const patch of [{ title: " " }, { accountId: "" }, { targetAmount: "0" }, { targetAmount: "-1" }, { targetAmount: "1.001" }, { targetAmount: "1,001" }, { targetAmount: "Infinity" }, { targetDate: "2027-02-29" }]) assert.throws(() => forms.buildGoalFormPayload({ ...base, ...patch }))
  })
  it("offers only backend-allowed status transitions and eligible accounts", () => {
    assert.deepEqual(forms.goalStatusOptions("ARCHIVED"), ["ARCHIVED", "ACTIVE"])
    assert.throws(() => forms.buildGoalFormPayload({ ...forms.goalFormDefaults(goal), status: "PAUSED" }, { ...goal, status: "ARCHIVED" }))
    assert.equal(forms.isEligibleGoalAccount(account), true)
    assert.equal(forms.isEligibleGoalAccount({ ...account, currency: "USD" }), false)
    assert.equal(forms.isEligibleGoalAccount({ ...account, status: "ARCHIVED" }), false)
  })
  it("validates exact-cent allocations against the server-provided maximum", () => {
    assert.deepEqual(forms.buildGoalEntryInput("ALLOCATION", "30,31", " note ", goal), { type: "ALLOCATION", amount: 30.31, note: "note" })
    assert.throws(() => forms.buildGoalEntryInput("ALLOCATION", "30,32", "", goal), /insuffisants/)
    for (const value of ["0", "-1", "0.001", "NaN"]) assert.throws(() => forms.buildGoalEntryInput("ALLOCATION", value, "", goal))
    assert.throws(() => forms.buildGoalEntryInput("ALLOCATION", "1", "", { ...goal, status: "PAUSED" }), /actif/)
  })
  it("permits releases on paused/archived goals and accounts, but never above the journal balance", () => {
    for (const status of ["ACTIVE", "PAUSED", "ARCHIVED"]) {
      const archived = { ...goal, status, account: { ...account, status: "ARCHIVED" } }
      assert.equal(forms.buildGoalEntryInput("RELEASE", "20.31", "", archived).amount, 20.31)
      assert.throws(() => forms.buildGoalEntryInput("RELEASE", "20.32", "", archived), /libérable/)
    }
    assert.throws(() => forms.buildGoalEntryInput("RELEASE", "1", "", { ...goal, account: { ...account, hasFutureEntries: true } }), /futures/)
  })
})

describe("goals frontend HTTP errors", () => {
  it("accepts actual creation, modification and replay statuses and disables caching", async () => {
    for (const status of [200, 201]) {
      const result = await requestGoals("/api/goals", { method: "POST" }, async (url, init) => {
        assert.equal(url, "/api/goals"); assert.equal(init.cache, "no-store")
        return Response.json({ goal: { id: "g" } }, { status })
      })
      assert.equal(result.goal.id, "g")
    }
  })
  it("retains field-validation messages and financial conflict codes", async () => {
    await assert.rejects(requestGoals("/api/goals", undefined, async () => Response.json({ errors: { formErrors: [], fieldErrors: { amount: ["Montant invalide"] } } }, { status: 400 })), error => error.status === 400 && error.message === "Montant invalide")
    for (const code of ["INSUFFICIENT_UNRESERVED_FUNDS", "CONCURRENT_CHANGE", "IDEMPOTENCY_CONFLICT"]) {
      await assert.rejects(requestGoals("/api/goals", undefined, async () => Response.json({ message: "Conflit financier", code }, { status: 409 })), error => error.status === 409 && error.code === code)
    }
    for (const status of [401, 404, 500]) await assert.rejects(requestGoals("/api/goals", undefined, async () => new Response("unavailable", { status })), error => error.status === status)
  })
  it("distinguishes network/invalid-success responses from aborts", async () => {
    await assert.rejects(requestGoals("/api/goals", undefined, async () => { throw new TypeError("offline") }), error => error.status === 0)
    await assert.rejects(requestGoals("/api/goals", undefined, async () => new Response("not json")), error => error.status === 500)
    const abort = new DOMException("cancelled", "AbortError")
    await assert.rejects(requestGoals("/api/goals", undefined, async () => { throw abort }), error => error === abort)
  })
})

describe("goal entry intentions and duplicate submissions", () => {
  const input = { type: "ALLOCATION", amount: 10.29, note: null }
  it("blocks double clicks and prevents a completed intention from submitting twice", async () => {
    const intent = createGoalEntryIntent(() => "stable-key")
    let finish, calls = 0
    const send = async payload => { calls++; assert.equal(payload.idempotencyKey, "stable-key"); return new Promise(resolve => { finish = resolve }) }
    const first = intent.run("g", input, send)
    assert.equal(await intent.run("g", input, send), undefined)
    finish({ message: "ok" })
    await first
    assert.equal(await intent.run("g", input, send), undefined)
    assert.equal(calls, 1)
  })
  it("retries a lost response with the original key and freezes a potentially completed payload", async () => {
    const intent = createGoalEntryIntent(() => "same-intention")
    const payloads = []
    await assert.rejects(intent.run("g", input, async payload => { payloads.push(payload); throw new GoalRequestError("offline", 0) }))
    assert.equal(intent.uncertain, true)
    await assert.rejects(intent.run("g", { ...input, amount: 11 }, async () => {}), /même opération/)
    await intent.run("g", input, async payload => { payloads.push(payload); return { replayed: true } })
    assert.deepEqual(payloads[0], payloads[1])
    assert.equal(intent.uncertain, false)
  })
  it("keeps a key after a known failure but creates a new one for a changed/new intention", async () => {
    let sequence = 0
    const generate = () => `key-${++sequence}`
    const intent = createGoalEntryIntent(generate), keys = []
    const fail = async payload => { keys.push(payload.idempotencyKey); throw new GoalRequestError("funds", 409) }
    await assert.rejects(intent.run("g", input, fail))
    await assert.rejects(intent.run("g", input, fail))
    await assert.rejects(intent.run("g", { ...input, note: "new" }, fail))
    await createGoalEntryIntent(generate).run("g", input, async payload => keys.push(payload.idempotencyKey))
    assert.deepEqual(keys, ["key-1", "key-1", "key-2", "key-3"])
  })
})
