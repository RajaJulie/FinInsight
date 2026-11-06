/**
 * Suite d'integration optionnelle pour verifier les verrous et les operations
 * concurrentes sur PostgreSQL. Exige FININSIGHT_GOALS_TEST_DATABASE_URL vers
 * une base de test dediee ; cree puis nettoie uniquement un schema aleatoire.
 * Sans cette variable, aucun test PostgreSQL ni aucune connexion n'est lance.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { after, before, describe, it } from "node:test"
import { loadTs } from "../testing/load-ts.mjs"

// Never falls back to DATABASE_URL or loads .env. Explicit opt-in requires a dedicated test database.
const connectionString = process.env.FININSIGHT_GOALS_TEST_DATABASE_URL
describe("goals services on real PostgreSQL (explicit isolated test database required)", { skip: !connectionString }, () => {
  const schema = `fininsight_goals_test_${randomUUID().replaceAll("-", "")}`
  let admin, pool, prisma, service, locking, created = false, sequence = 0

  before(async () => {
    const database = decodeURIComponent(new URL(connectionString).pathname.slice(1))
    assert.match(database, /(?:^|[_-])test(?:$|[_-])/i, "Database name must contain a separate test segment")
    const { default: pg } = await import("pg")
    const { PrismaPg } = await import("@prisma/adapter-pg")
    const { createJiti } = await import("jiti")
    const frontend = fileURLToPath(new URL("../../", import.meta.url))
    // Jiti is already installed with Prisma; the existing test loader isolates the service's database import.
    const { PrismaClient } = await createJiti(import.meta.url).import(resolve(frontend, "lib/generated/prisma/client.ts"))
    admin = new pg.Pool({ connectionString })
    await admin.query(`CREATE SCHEMA "${schema}"`)
    created = true
    pool = new pg.Pool({ connectionString, options: `-c search_path=${schema} -c timezone=UTC` })
    await pool.query(`
      CREATE TYPE "AccountType" AS ENUM ('CHECKING','SAVINGS','CASH','INVESTMENT','CREDIT','OTHER');
      CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE','ARCHIVED');
      CREATE TYPE "TransactionType" AS ENUM ('INCOME','EXPENSE','TRANSFER');
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "Account" (
        "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id"), "name" TEXT NOT NULL,
        "type" "AccountType" NOT NULL DEFAULT 'CHECKING', "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
        "initialBalance" DOUBLE PRECISION NOT NULL, "currency" TEXT NOT NULL DEFAULT 'EUR',
        "icon" TEXT NOT NULL DEFAULT 'wallet', "color" TEXT NOT NULL DEFAULT '#000000', "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE "Transaction" (
        "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id"),
        "accountId" TEXT REFERENCES "Account"("id"), "destinationAccountId" TEXT REFERENCES "Account"("id"),
        "type" "TransactionType" NOT NULL, "amount" DOUBLE PRECISION NOT NULL
      );
      INSERT INTO "User" ("id") VALUES ('test-owner');
    `)
    // Apply the goals migration only inside the fresh random test schema, never to the application schema.
    await pool.query(readFileSync(new URL("../../prisma/migrations/20261101090000_add_savings_goals/migration.sql", import.meta.url), "utf8"))
    prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) })
    const cache = new Map(), mocks = { "@/lib/prisma": { prisma } }
    service = loadTs("lib/goals/service.ts", mocks, cache)
    locking = loadTs("lib/goals/locking.ts", mocks, cache)
  })

  after(async () => {
    try { await prisma?.$disconnect() } finally {
      try { await pool?.end() } finally {
        // Cleanup is restricted to the random schema created above; no application rows are deleted.
        try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`) } finally { await admin?.end() }
      }
    }
  })

  async function makeGoal(balance = 100, accountId) {
    const id = accountId ?? `account-${++sequence}`
    if (!accountId) await pool.query('INSERT INTO "Account" ("id","userId","name","initialBalance") VALUES ($1,$2,$1,$3)', [id, "test-owner", balance])
    const result = await service.createGoalForUser("test-owner", { title: "Isolated test goal", accountId: id, targetAmount: 500 })
    return { accountId: id, goalId: result.goal.id }
  }
  const input = (amount, idempotencyKey, type = "ALLOCATION") => ({ amount, idempotencyKey, type, note: null })

  it("serializes real simultaneous reservations across two goals sharing one account", async () => {
    const first = await makeGoal()
    const second = await makeGoal(100, first.accountId)
    const results = await Promise.allSettled([
      service.createGoalEntryForUser("test-owner", first.goalId, input(70, "first")),
      service.createGoalEntryForUser("test-owner", second.goalId, input(70, "second")),
    ])
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
    assert.equal(results.find(result => result.status === "rejected").reason.code, "INSUFFICIENT_UNRESERVED_FUNDS")
    const result = await pool.query('SELECT SUM(e."amount")::text AS total FROM "GoalEntry" e JOIN "SavingsGoal" g ON g."id"=e."goalId" WHERE g."accountId"=$1', [first.accountId])
    assert.equal(Number(result.rows[0].total), 70)
    assert.equal((await pool.query('SELECT "initialBalance" FROM "Account" WHERE "id"=$1', [first.accountId])).rows[0].initialBalance, 100)
  })

  it("replays a real simultaneous identical key once and rejects changed content", async () => {
    const { goalId } = await makeGoal()
    const results = await Promise.all([
      service.createGoalEntryForUser("test-owner", goalId, input(70, "same")),
      service.createGoalEntryForUser("test-owner", goalId, input(70, "same")),
    ])
    assert.deepEqual(results.map(result => result.replayed).sort(), [false, true])
    assert.equal(new Set(results.map(result => result.entry.id)).size, 1)
    await assert.rejects(service.createGoalEntryForUser("test-owner", goalId, input(71, "same")), error => error.code === "IDEMPOTENCY_CONFLICT")
  })

  it("prevents real competing releases from overdrawing the virtual journal", async () => {
    const { goalId } = await makeGoal()
    await service.createGoalEntryForUser("test-owner", goalId, input(70, "fund"))
    const results = await Promise.allSettled([
      service.createGoalEntryForUser("test-owner", goalId, input(60, "release-a", "RELEASE")),
      service.createGoalEntryForUser("test-owner", goalId, input(60, "release-b", "RELEASE")),
    ])
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
    assert.equal(results.find(result => result.status === "rejected").reason.code, "EXCESSIVE_RELEASE")
    assert.equal((await service.getGoalForUser("test-owner", goalId)).goal.accumulatedAmount, 10)
  })

  it("blocks bank-row updates/deletes, new FK movements and opening-balance edits while locked", async () => {
    const { accountId } = await makeGoal()
    const transactionId = `movement-${++sequence}`
    await pool.query('INSERT INTO "Transaction" ("id","userId","accountId","type","amount") VALUES ($1,$2,$3,$4,$5)', [transactionId, "test-owner", accountId, "EXPENSE", 1])
    let unlock, ready
    const held = new Promise(resolve => { ready = resolve })
    const release = new Promise(resolve => { unlock = resolve })
    const holding = prisma.$transaction(async tx => {
      await locking.lockGoalAccounts(tx, "test-owner", [accountId])
      await locking.lockGoalBankMovements(tx, "test-owner", accountId)
      ready()
      await release
    }, { isolationLevel: "ReadCommitted", timeout: 10000 })
    // A setup failure must not leave the test waiting forever for the signal.
    await Promise.race([held, holding.then(() => { throw new Error("Lock transaction ended before ready") })])
    let client
    try {
      client = await pool.connect()
      for (const [sql, values] of [
        ['UPDATE "Transaction" SET "amount"=2 WHERE "id"=$1', [transactionId]],
        ['DELETE FROM "Transaction" WHERE "id"=$1', [transactionId]],
        ['INSERT INTO "Transaction" ("id","userId","accountId","type","amount") VALUES ($1,$2,$3,$4,$5)', [`new-${sequence}`, "test-owner", accountId, "EXPENSE", 1]],
        ['UPDATE "Account" SET "initialBalance"=1 WHERE "id"=$1', [accountId]],
      ]) {
        await client.query("BEGIN")
        try {
          await client.query("SET LOCAL lock_timeout = '150ms'")
          await assert.rejects(client.query(sql, values), error => error.code === "55P03")
        } finally { await client.query("ROLLBACK") }
      }
    } finally { client?.release(); unlock(); await holding }
    assert.equal((await pool.query('SELECT "amount" FROM "Transaction" WHERE "id"=$1', [transactionId])).rows[0].amount, 1)
  })
})
