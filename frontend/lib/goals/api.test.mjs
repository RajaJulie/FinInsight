/**
 * Teste les vrais handlers et services avec Auth.js et Prisma simules en memoire.
 * Couvre la validation, l'isolation utilisateur, les fonds, l'idempotence et
 * l'absence d'ecritures bancaires. La concurrence simulee ne valide pas a elle
 * seule le comportement reel de PostgreSQL.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Decimal } from "@prisma/client/runtime/client"
import { loadTs } from "../testing/load-ts.mjs"

function fixture() {
  const now = new Date("2026-01-01T00:00:00Z")
  const accounts = [
    { id: "bank", userId: "u1", name: "Compte test", status: "ACTIVE", currency: "EUR", type: "CHECKING", initialBalance: 100 },
    { id: "second", userId: "u1", name: "Autre compte test", status: "ACTIVE", currency: "EUR", type: "SAVINGS", initialBalance: 20 },
    { id: "archived", userId: "u1", name: "Archive", status: "ARCHIVED", currency: "EUR", type: "CHECKING", initialBalance: 80 },
    { id: "usd", userId: "u1", name: "USD", status: "ACTIVE", currency: "USD", type: "OTHER", initialBalance: 100 },
    { id: "foreign", userId: "u2", name: "Other user", status: "ACTIVE", currency: "EUR", type: "CHECKING", initialBalance: 1000 },
  ].map(account => ({ ...account, createdAt: now, updatedAt: now }))
  const goals = new Map()
  const entries = new Map()
  const movements = []
  const trace = [], financialWrites = [], pendingLocks = new Map()
  let sequence = 0, sessionUser = "u1", injectedConflicts = [], uniqueRace = null, beforeLock = null
  const ctx = id => ({ params: Promise.resolve({ id }) })
  const decorate = (goal, extra = []) => ({ ...goal, entries: [...entries.values(), ...extra].filter(entry => entry.goalId === goal.id)
    .sort((a, b) => a.effectiveAt - b.effectiveAt || a.createdAt - b.createdAt || a.id.localeCompare(b.id)) })
  const matchGoal = (goal, where) => (!where.id || goal.id === where.id) && (!where.userId || goal.userId === where.userId) &&
    (!where.account?.userId || accounts.some(account => account.id === goal.accountId && account.userId === where.account.userId))
  const bankView = (account, args) => ({ ...account,
    transactions: movements.filter(row => row.accountId === account.id && row.userId === args.include.transactions.where.userId),
    incomingTransfers: movements.filter(row => row.destinationAccountId === account.id && row.type === "TRANSFER" && row.userId === args.include.incomingTransfers.where.userId),
  })
  const forbidWrite = () => { financialWrites.push("forbidden"); throw new Error("Financial write forbidden") }
  const prisma = {
    user: { findUnique: async ({ where }) => ["u1", "u2"].some(id => where.email === `${id}@example.invalid`) ? { id: where.email.split("@")[0] } : null },
    async $transaction(callback, options) {
      trace.push({ operation: "transaction", options })
      if (options.isolationLevel === "ReadCommitted" && injectedConflicts.length) throw injectedConflicts.shift()
      const stagedGoals = new Map(), stagedEntries = [], held = new Map()
      const releaseLocks = []
      const allGoals = () => [...new Map([...goals, ...stagedGoals]).values()]
      const tx = {
        $queryRaw: async (strings, ...values) => {
          const sql = strings.join("?")
          trace.push({ operation: "lock", sql, values })
          if (sql.includes('FROM "Account"')) {
            const [id, userId] = values
            if (beforeLock) { const hook = beforeLock; beforeLock = null; hook() }
            if (!accounts.some(account => account.id === id && account.userId === userId)) return []
            if (!held.has(id)) {
              const previous = pendingLocks.get(id) ?? Promise.resolve()
              let unlock
              const next = new Promise(resolve => { unlock = resolve })
              pendingLocks.set(id, next)
              await previous
              held.set(id, true)
              releaseLocks.push(unlock)
            }
            return [{ id }]
          }
          assert.ok(sql.includes('FROM "Transaction"') && sql.includes("FOR SHARE"))
          assert.ok(held.has(values[1]))
          return movements.filter(row => row.userId === values[0] && (row.accountId === values[1] || row.destinationAccountId === values[2])).map(row => ({ id: row.id }))
        },
        account: {
          findMany: async args => accounts.filter(account => account.userId === args.where.userId).map(account => bankView(account, args)),
          create: forbidWrite, update: forbidWrite, delete: forbidWrite,
        },
        savingsGoal: {
          findFirst: async ({ where }) => { const goal = allGoals().find(item => matchGoal(item, where)); return goal ? decorate(goal, stagedEntries) : null },
          findMany: async ({ where }) => allGoals().filter(goal => matchGoal(goal, where)).map(goal => decorate(goal, stagedEntries)),
          create: async ({ data }) => {
            assert.ok(held.has(data.accountId))
            const goal = { id: `goal-${++sequence}`, status: "ACTIVE", targetDate: null, createdAt: new Date(), updatedAt: new Date(), ...data }
            stagedGoals.set(goal.id, goal)
            return decorate(goal, stagedEntries)
          },
          update: async ({ where, data }) => {
            const goal = allGoals().find(item => matchGoal(item, where))
            assert.ok(goal && held.has(goal.accountId))
            if (data.accountId) assert.ok(held.has(data.accountId))
            const updated = { ...goal, ...data, updatedAt: new Date() }
            stagedGoals.set(goal.id, updated)
            return decorate(updated, stagedEntries)
          },
          delete: forbidWrite,
        },
        goalEntry: {
          findUnique: async ({ where }) => [...entries.values(), ...stagedEntries].find(entry =>
            entry.goalId === where.goalId_idempotencyKey.goalId && entry.idempotencyKey === where.goalId_idempotencyKey.idempotencyKey) ?? null,
          create: async ({ data }) => {
            const goal = allGoals().find(item => item.id === data.goalId)
            assert.ok(held.has(goal.accountId))
            assert.ok(trace.some(item => item.operation === "lock" && item.sql.includes("FOR SHARE") && item.values[1] === goal.accountId))
            if (uniqueRace) {
              const override = uniqueRace
              uniqueRace = null
              if (override !== "no-row") entries.set("raced", { id: "raced", createdAt: new Date(), ...data, ...override })
              throw { code: "P2002", meta: { target: ["goalId", "idempotencyKey"] } }
            }
            if ([...entries.values(), ...stagedEntries].some(entry => entry.goalId === data.goalId && entry.idempotencyKey === data.idempotencyKey)) throw { code: "P2002" }
            const entry = { id: `entry-${++sequence}`, createdAt: new Date(), ...data }
            stagedEntries.push(entry)
            return entry
          },
          update: forbidWrite, delete: forbidWrite,
        },
        transaction: { create: forbidWrite, update: forbidWrite, delete: forbidWrite },
        budget: { create: forbidWrite, update: forbidWrite, delete: forbidWrite },
        monthlyEmergencyReserve: { upsert: forbidWrite, update: forbidWrite },
      }
      try {
        const result = await callback(tx)
        for (const [id, goal] of stagedGoals) goals.set(id, goal)
        for (const entry of stagedEntries) entries.set(entry.id, entry)
        return result
      } finally { releaseLocks.reverse().forEach(release => release()) }
    },
  }
  const mocks = {
    "@/auth": { auth: async () => sessionUser ? { user: { email: `${sessionUser}@example.invalid` } } : null },
    "@/lib/prisma": { prisma },
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
  }
  // One module cache is essential: shared error constructors must have identical runtime identity.
  const cache = new Map()
  const list = loadTs("app/api/goals/route.ts", mocks, cache)
  const detail = loadTs("app/api/goals/[id]/route.ts", mocks, cache)
  const journal = loadTs("app/api/goals/[id]/entries/route.ts", mocks, cache)
  const request = (body, method = "POST") => new Request("http://localhost/api/goals", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const create = overrides => list.POST(request({ title: "Projet test", targetAmount: 200, accountId: "bank", ...overrides }))
  const patch = (id, body) => detail.PATCH(request(body, "PATCH"), ctx(id))
  const postEntry = (id, body) => journal.POST(request({ type: "ALLOCATION", amount: 10, idempotencyKey: "key", ...body }), ctx(id))
  const seedGoal = (id = "g", accountId = "bank", userId = "u1", status = "ACTIVE") => {
    const goal = { id, accountId, userId, title: "Goal test", targetAmount: new Decimal(100), targetDate: null, status, createdAt: now, updatedAt: now }
    goals.set(id, goal)
    return goal
  }
  const seedEntry = (goalId, amount, type = "ALLOCATION", overrides = {}) => {
    const entry = { id: `seed-${++sequence}`, goalId, amount: new Decimal(amount), type, idempotencyKey: `seed-key-${sequence}`, note: null, effectiveAt: now, createdAt: now, ...overrides }
    entries.set(entry.id, entry)
    return entry
  }
  return { list, detail, journal, create, patch, postEntry, seedGoal, seedEntry, request, ctx, accounts, goals, entries, movements, trace, financialWrites,
    setUser: value => { sessionUser = value }, conflicts: values => { injectedConflicts = values }, race: value => { uniqueRace = value }, beforeLock: hook => { beforeLock = hook } }
}

describe("goals HTTP APIs with isolated Auth.js/Prisma mocks", () => {
  it("creates a validated owned goal with no automatic allocation", async () => {
    const f = fixture()
    const response = await f.create({ targetAmount: "123.45", targetDate: "2027-02-28" })
    assert.equal(response.status, 201)
    const { goal } = await response.json()
    assert.equal(goal.targetAmount, 123.45)
    assert.equal(goal.targetDate, "2027-02-28T00:00:00.000Z")
    assert.equal(goal.accumulatedAmount, 0)
    assert.equal(goal.remainingAmount, 123.45)
    assert.equal(goal.account.bankBalance, 100)
    assert.equal(f.entries.size, 0)
    assert.ok(f.goals.values().next().value.targetAmount instanceof Decimal)
    assert.deepEqual(f.financialWrites, [])
  })
  it("rejects invalid create payloads, immutable fields, precision and impossible dates", async () => {
    const f = fixture()
    for (const body of [{ title: " " }, { amount: 1 }, { targetAmount: 0 }, { targetAmount: -1 }, { targetAmount: 1.001 }, { targetAmount: true },
      { targetAmount: "10000000000.00" }, { targetDate: "2027-02-29" }, { targetDate: "2026-11-01\n" }, { targetDate: "01/11/2026" },
      { userId: "u2" }, { id: "forced" }, { status: "ARCHIVED" }, { accumulatedAmount: 1 }]) assert.equal((await f.create(body)).status, 400)
    assert.equal(f.goals.size, 0)
  })
  it("returns the same 404 for a missing or foreign account and checks account eligibility", async () => {
    const f = fixture()
    for (const accountId of ["absent", "foreign"]) {
      const response = await f.create({ accountId })
      assert.equal(response.status, 404)
      assert.equal((await response.json()).code, "ACCOUNT_NOT_FOUND")
    }
    assert.equal((await f.create({ accountId: "archived" })).status, 409)
    assert.equal((await f.create({ accountId: "usd" })).status, 400)
  })
  it("requires a real authenticated database user on every endpoint before accessing goals", async () => {
    const f = fixture()
    f.seedGoal()
    for (const user of [null, "unknown"]) {
      f.setUser(user)
      const responses = [await f.list.GET(), await f.create(), await f.detail.GET(f.request({}), f.ctx("g")), await f.patch("g", { title: "X" }), await f.postEntry("g", {})]
      assert.ok(responses.every(response => response.status === 401))
    }
    assert.equal(f.trace.length, 0)
    assert.equal(f.entries.size, 0)
  })
  it("lists only owned goals and accounts, with exact funding for all statuses", async () => {
    const f = fixture()
    f.seedGoal("a")
    f.seedGoal("b", "bank", "u1", "PAUSED")
    f.seedGoal("c", "bank", "u1", "ARCHIVED")
    f.seedGoal("foreign-goal", "foreign", "u2")
    f.seedEntry("a", 20)
    f.seedEntry("b", 30)
    f.seedEntry("c", 10)
    f.seedEntry("foreign-goal", 500)
    const response = await f.list.GET()
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.deepEqual(data.goals.map(goal => goal.id), ["a", "b", "c"])
    assert.equal(data.accounts.some(account => account.id === "foreign"), false)
    assert.equal(data.goals[0].account.reservedAmount, 60)
    assert.equal(data.goals[0].account.unreservedAmount, 40)
    assert.equal(data.goals[0].account.balanceVerified, false)
    assert.equal("entries" in data.goals[0], false)
  })
  it("returns detail with ordered history, progress and underfunding without erasing it", async () => {
    const f = fixture()
    f.seedGoal()
    f.seedEntry("g", 125, "ALLOCATION", { effectiveAt: new Date("2026-02-01") })
    f.seedEntry("g", 5, "RELEASE", { effectiveAt: new Date("2026-03-01") })
    f.accounts[0].initialBalance = 80
    const response = await f.detail.GET(f.request({}), f.ctx("g"))
    const { goal } = await response.json()
    assert.equal(response.status, 200)
    assert.equal(goal.accumulatedAmount, 120)
    assert.equal(goal.progressPercentage, 120)
    assert.equal(goal.excessAmount, 20)
    assert.equal(goal.reached, true)
    assert.equal(goal.account.unreservedAmount, -40)
    assert.equal(goal.account.shortfallAmount, 40)
    assert.ok(goal.warnings.some(warning => warning.code === "ACCOUNT_UNDERFUNDED"))
    assert.ok(goal.entries[0].effectiveAt < goal.entries[1].effectiveAt)
    assert.equal(f.entries.size, 2)
  })
  it("hides foreign/missing goals on GET, PATCH and entry creation without leaking account data", async () => {
    const f = fixture()
    f.seedGoal("foreign-goal", "foreign", "u2")
    for (const id of ["missing", "foreign-goal"]) {
      for (const response of [await f.detail.GET(f.request({}), f.ctx(id)), await f.patch(id, { title: "X" }), await f.postEntry(id, {})]) {
        assert.equal(response.status, 404)
        assert.equal((await response.json()).code, "GOAL_NOT_FOUND")
      }
    }
    assert.equal(f.entries.size, 0)
  })
  it("does not expose a malformed goal linked to another user's account", async () => {
    const f = fixture()
    f.seedGoal("malformed", "foreign", "u1")
    assert.deepEqual((await (await f.list.GET()).json()).goals, [])
    assert.equal((await f.postEntry("malformed", {})).status, 404)
  })
  it("creates a second user's goal exclusively on that user's account", async () => {
    const f = fixture()
    f.seedGoal()
    f.setUser("u2")
    const response = await f.create({ accountId: "foreign" })
    assert.equal(response.status, 201)
    const { goal } = await response.json()
    assert.equal(f.goals.get(goal.id).userId, "u2")
    const data = await (await f.list.GET()).json()
    assert.deepEqual(data.goals.map(item => item.id), [goal.id])
    assert.deepEqual(data.accounts.map(item => item.id), ["foreign"])
  })
  it("updates metadata, clears target date and archives without releasing money or history", async () => {
    const f = fixture()
    f.seedGoal()
    f.seedEntry("g", 20)
    const response = await f.patch("g", { title: "Nouveau nom", targetAmount: 10, targetDate: null, status: "ARCHIVED" })
    assert.equal(response.status, 200)
    const { goal } = await response.json()
    assert.equal(goal.title, "Nouveau nom")
    assert.equal(goal.status, "ARCHIVED")
    assert.equal(goal.reached, true)
    assert.equal(goal.account.reservedAmount, 20)
    assert.equal(f.entries.size, 1)
    assert.equal((await f.postEntry("g", {})).status, 409)
  })
  it("allows documented status transitions, requiring explicit restoration from archive", async () => {
    const f = fixture()
    f.seedGoal()
    for (const status of ["PAUSED", "ACTIVE", "ARCHIVED", "ARCHIVED"]) assert.equal((await f.patch("g", { status })).status, 200)
    assert.equal((await f.patch("g", { status: "PAUSED" })).status, 409)
    assert.equal((await f.patch("g", { status: "ACTIVE" })).status, 200)
    f.accounts[0].status = "ARCHIVED"
    assert.equal((await f.patch("g", { status: "PAUSED" })).status, 200)
    assert.equal((await f.patch("g", { status: "ACTIVE" })).status, 409)
  })
  it("changes accounts only while the journal is empty and locks both IDs in order", async () => {
    const f = fixture()
    f.seedGoal()
    assert.equal((await f.patch("g", { accountId: "second" })).status, 200)
    assert.deepEqual(f.trace.filter(item => item.operation === "lock").map(item => item.values[0]), ["bank", "second"])
    f.seedEntry("g", 10)
    assert.equal((await f.patch("g", { accountId: "bank" })).status, 409)
    assert.equal(f.goals.get("g").accountId, "second")
    assert.equal((await f.patch("g", { accountId: "foreign" })).status, 404)
  })
  it("rejects empty/unknown/immutable PATCH fields and invalid target amounts", async () => {
    const f = fixture()
    f.seedGoal()
    for (const body of [{}, { title: " " }, { targetAmount: 0 }, { targetAmount: 0.001 }, { userId: "u2" }, { id: "x" }, { entries: [] }, { status: "COMPLETED" }]) assert.equal((await f.patch("g", body)).status, 400)
  })
  it("allocates using the full recorded account ledger, including transfers", async () => {
    const f = fixture()
    f.seedGoal()
    f.movements.push({ id: "salary", userId: "u1", accountId: "bank", type: "INCOME", amount: 50 },
      { id: "expense", userId: "u1", accountId: "bank", type: "EXPENSE", amount: 10 },
      { id: "out", userId: "u1", accountId: "bank", destinationAccountId: "second", type: "TRANSFER", amount: 20 },
      { id: "in", userId: "u1", accountId: "second", destinationAccountId: "bank", type: "TRANSFER", amount: 5 })
    const before = JSON.stringify({ accounts: f.accounts, movements: f.movements })
    const response = await f.postEntry("g", { amount: 125 })
    const data = await response.json()
    assert.equal(response.status, 201)
    assert.equal(data.goal.account.bankBalance, 125)
    assert.equal(data.goal.account.unreservedAmount, 0)
    assert.equal(data.goal.accumulatedAmount, 125)
    assert.equal(JSON.stringify({ accounts: f.accounts, movements: f.movements }), before)
    assert.deepEqual(f.financialWrites, [])
  })
  it("counts reservations from other goals, including paused and archived goals", async () => {
    const f = fixture()
    f.seedGoal()
    f.seedGoal("paused", "bank", "u1", "PAUSED")
    f.seedGoal("archived-goal", "bank", "u1", "ARCHIVED")
    f.seedEntry("paused", 40)
    f.seedEntry("archived-goal", 50)
    assert.equal((await f.postEntry("g", { amount: 10.01 })).status, 409)
    assert.equal((await f.postEntry("g", { amount: 10 })).status, 201)
    assert.equal((await f.postEntry("paused", { amount: 0.01 })).status, 409)
  })
  it("rejects allocations on archived/non-EUR accounts without a journal write", async () => {
    const f = fixture()
    f.seedGoal("a", "archived")
    f.seedGoal("b", "usd")
    assert.equal((await f.postEntry("a", {})).status, 409)
    assert.equal((await f.postEntry("b", {})).status, 400)
    assert.equal(f.entries.size, 0)
  })
  it("releases from active, paused and archived goals without affecting the bank", async () => {
    for (const status of ["ACTIVE", "PAUSED", "ARCHIVED"]) {
      const f = fixture()
      f.seedGoal("g", "bank", "u1", status)
      f.seedEntry("g", 20)
      f.accounts[0].status = "ARCHIVED"
      const response = await f.postEntry("g", { type: "RELEASE", amount: 15 })
      assert.equal(response.status, 201)
      const data = await response.json()
      assert.equal(data.goal.accumulatedAmount, 5)
      assert.equal(data.goal.status, status)
      assert.equal(data.goal.account.bankBalance, 100)
      assert.equal((await f.postEntry("g", { type: "RELEASE", amount: 5.01, idempotencyKey: "excess" })).status, 409)
      assert.equal(f.entries.size, 2)
      assert.deepEqual(f.financialWrites, [])
    }
  })
  it("replays the same canonical operation without writing twice, even after archiving", async () => {
    const f = fixture()
    f.seedGoal()
    const first = await f.postEntry("g", { amount: "10.00", note: " test " })
    const original = (await first.json()).entry
    await f.patch("g", { status: "ARCHIVED" })
    f.accounts[0].initialBalance = 0
    const second = await f.postEntry("g", { amount: 10, note: "test" })
    const data = await second.json()
    assert.equal(first.status, 201)
    assert.equal(second.status, 200)
    assert.equal(data.replayed, true)
    assert.deepEqual(data.entry, original)
    assert.equal(f.entries.size, 1)
  })
  it("returns explicit conflicts when an idempotency key changes amount, type or note", async () => {
    const f = fixture()
    f.seedGoal()
    assert.equal((await f.postEntry("g", {})).status, 201)
    for (const body of [{ amount: 11 }, { type: "RELEASE" }, { note: "different" }]) {
      const response = await f.postEntry("g", body)
      assert.equal(response.status, 409)
      assert.equal((await response.json()).code, "IDEMPOTENCY_CONFLICT")
    }
    f.seedGoal("other-goal")
    assert.equal((await f.postEntry("other-goal", {})).status, 201)
  })
  it("handles a unique race only by rereading and comparing the persisted operation", async () => {
    const f = fixture()
    f.seedGoal()
    f.race({})
    const response = await f.postEntry("g", {})
    assert.equal(response.status, 200)
    assert.equal((await response.json()).entry.id, "raced")
    const other = fixture()
    other.seedGoal()
    other.race({ amount: new Decimal(11) })
    const conflict = await other.postEntry("g", {})
    assert.equal(conflict.status, 409)
    assert.equal((await conflict.json()).code, "IDEMPOTENCY_CONFLICT")
  })
  it("never declares success for persistent unique violations without an existing row", async () => {
    const f = fixture()
    f.seedGoal()
    f.conflicts([{ code: "P2002" }, { code: "P2002" }, { code: "P2002" }])
    assert.equal((await f.postEntry("g", {})).status, 409)
    assert.equal(f.entries.size, 0)
  })
  it("serializes same-account simulated allocations, so only one competing 70 allocation fits", async () => {
    const f = fixture()
    f.seedGoal("a")
    f.seedGoal("b")
    const responses = await Promise.all([f.postEntry("a", { amount: 70 }), f.postEntry("b", { amount: 70 })])
    assert.deepEqual(responses.map(response => response.status).sort(), [201, 409])
    assert.equal(f.entries.size, 1)
    assert.equal(f.accounts[0].initialBalance, 100)
  })
  it("serializes duplicate submissions and excessive concurrent releases in the in-memory mock", async () => {
    const f = fixture()
    f.seedGoal()
    assert.deepEqual((await Promise.all([f.postEntry("g", { amount: 70 }), f.postEntry("g", { amount: 70 })])).map(response => response.status).sort(), [200, 201])
    assert.equal(f.entries.size, 1)
    assert.deepEqual((await Promise.all([f.postEntry("g", { amount: 60, type: "RELEASE", idempotencyKey: "r1" }), f.postEntry("g", { amount: 60, type: "RELEASE", idempotencyKey: "r2" })])).map(response => response.status).sort(), [201, 409])
  })
  it("bounds retries for serialization failures and raw PostgreSQL deadlocks", async () => {
    const f = fixture()
    f.seedGoal()
    f.conflicts([{ code: "P2034" }, { code: "P2010", meta: { code: "40P01" } }])
    assert.equal((await f.postEntry("g", {})).status, 201)
    assert.equal(f.trace.filter(item => item.operation === "transaction").length, 3)
    f.conflicts([{ code: "P2034" }, { code: "P2034" }, { code: "P2034" }])
    const response = await f.postEntry("g", { idempotencyKey: "second" })
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, "CONCURRENT_CHANGE")
    assert.equal(f.entries.size, 1)
  })
  it("does not use stale account or status metadata read before acquiring the account lock", async () => {
    const f = fixture()
    f.seedGoal()
    f.beforeLock(() => { f.goals.get("g").accountId = "second" })
    assert.equal((await f.postEntry("g", { amount: 30 })).status, 409)
    assert.equal(f.trace.filter(item => item.operation === "transaction").length, 2)
    assert.equal(f.entries.size, 0)
    f.beforeLock(() => { f.goals.get("g").status = "PAUSED" })
    assert.equal((await f.postEntry("g", {})).status, 409)
    assert.equal(f.entries.size, 0)
  })
  it("handles adapter-wrapped conflicts and lock timeouts without treating them as success", async () => {
    const f = fixture()
    f.seedGoal()
    f.conflicts([{ code: "P2002", meta: { driverAdapterError: { cause: { originalCode: "23505" } } } }])
    assert.equal((await f.postEntry("g", {})).status, 201)
    f.conflicts([{ code: "P2028" }])
    assert.equal((await f.postEntry("g", { idempotencyKey: "timeout" })).status, 409)
    f.conflicts([{ code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "40P01" } } } }])
    assert.equal((await f.postEntry("g", { idempotencyKey: "deadlock" })).status, 201)
    assert.equal(f.entries.size, 2)
  })
  it("keeps cent precision and rejects invalid entry types, dates and immutable fields", async () => {
    const f = fixture()
    f.seedGoal()
    f.accounts[0].initialBalance = 0.3
    assert.equal((await f.postEntry("g", { amount: "0.10" })).status, 201)
    const response = await f.postEntry("g", { amount: 0.2, idempotencyKey: "two" })
    assert.equal(response.status, 201)
    assert.equal((await response.json()).goal.accumulatedAmount, 0.3)
    for (const body of [{ amount: 0 }, { amount: -1 }, { amount: 0.001 }, { amount: true }, { type: "TRANSFER" }, { idempotencyKey: " " },
      { effectiveAt: "2026-01-01" }, { userId: "u2" }, { goalId: "other" }, { accountId: "foreign" }]) assert.equal((await f.postEntry("g", body)).status, 400)
  })
  it("does not count future entries as accumulated or allow an unsafe new entry around them", async () => {
    const f = fixture()
    f.seedGoal()
    f.seedEntry("g", 50, "ALLOCATION", { effectiveAt: new Date("2999-01-01") })
    const { goal } = await (await f.detail.GET(f.request({}), f.ctx("g"))).json()
    assert.equal(goal.accumulatedAmount, 0)
    assert.equal(goal.entries.length, 1)
    assert.ok(goal.warnings.some(warning => warning.code === "FUTURE_ENTRIES"))
    assert.equal((await f.postEntry("g", {})).status, 409)
  })
  it("handles malformed JSON and unexpected backend errors without exposing internals", async () => {
    const f = fixture()
    const response = await f.list.POST(new Request("http://localhost/api/goals", { method: "POST", body: "{" }))
    assert.equal(response.status, 400)
    f.conflicts([new Error("private database details")])
    const log = console.error
    console.error = () => {}
    try {
      const failure = await f.create()
      assert.equal(failure.status, 500)
      assert.equal((await failure.text()).includes("private database details"), false)
    } finally { console.error = log }
  })
})
