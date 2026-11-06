/**
 * Inspecte le SQL de la migration Objectifs et le schema sans connexion a la base.
 * Verifie son caractere additif, les contraintes monetaires, relations et cles uniques.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const sql = readFileSync(new URL("../../prisma/migrations/20261101090000_add_savings_goals/migration.sql", import.meta.url), "utf8")
const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")

describe("additive savings goal migration (static checks only)", () => {
  it("creates only the two new enums, tables and their indexes and constraints", () => {
    const statements = sql.split(";").map(statement => statement.trim()).filter(Boolean)
    assert.equal(statements[0], "BEGIN")
    assert.equal(statements.at(-1), "COMMIT")
    const allowed = [
      /^CREATE TYPE "(?:SavingsGoalStatus|GoalEntryType)" AS ENUM \(/,
      /^CREATE TABLE "(?:SavingsGoal|GoalEntry)" \(/,
      /^CREATE (?:UNIQUE )?INDEX "[^"]+" ON "(?:SavingsGoal|GoalEntry)"\(/,
      /^ALTER TABLE "(?:SavingsGoal|GoalEntry)" ADD CONSTRAINT "[^"]+"\s+FOREIGN KEY \(/,
    ]
    for (const statement of statements.slice(1, -1)) {
      assert.ok(allowed.some(pattern => pattern.test(statement)), `Unexpected SQL operation: ${statement}`)
    }
    assert.deepEqual([...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map(match => match[1]), ["SavingsGoal", "GoalEntry"])
    assert.equal((sql.match(/CREATE TYPE /g) ?? []).length, 2)
    assert.equal((sql.match(/CREATE (?:UNIQUE )?INDEX /g) ?? []).length, 4)
    assert.equal((sql.match(/ALTER TABLE /g) ?? []).length, 3)
    assert.equal(/\b(?:DROP|TRUNCATE|INSERT|UPDATE|DELETE)\b/.test(sql.replace(/ON (?:DELETE|UPDATE) (?:CASCADE|RESTRICT)/g, "")), false)
  })
  it("uses Decimal amounts, positive finite bounds, required ownership and no mutable accumulated amount", () => {
    for (const name of ["targetAmount", "amount"]) {
      assert.ok(sql.includes(`"${name}" DECIMAL(12,2) NOT NULL`))
      assert.ok(sql.includes(`CHECK ("${name}" > 0 AND "${name}" <= 9999999999.99)`))
    }
    for (const name of ["userId", "accountId", "goalId"]) assert.ok(sql.includes(`"${name}" TEXT NOT NULL`))
    assert.equal(/accumulatedAmount|currentAmount|currentBalance/.test(sql), false)
    assert.ok(schema.includes("enum SavingsGoalStatus {\n  ACTIVE\n  PAUSED\n  ARCHIVED\n}"))
    assert.equal(schema.includes("COMPLETED"), false)
  })
  it("scopes idempotency to a goal, retains its journal and restricts account deletion", () => {
    assert.ok(sql.includes('CREATE UNIQUE INDEX "GoalEntry_goalId_idempotencyKey_key" ON "GoalEntry"("goalId", "idempotencyKey")'))
    assert.ok(sql.includes('CHECK (length(btrim("idempotencyKey")) > 0)'))
    assert.ok(sql.includes('REFERENCES "Account"("id") ON DELETE RESTRICT'))
    assert.ok(sql.includes('REFERENCES "SavingsGoal"("id") ON DELETE RESTRICT'))
    assert.ok(sql.includes('"targetDate" TIMESTAMP(3),'))
    assert.ok(sql.includes('"effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'))
    assert.ok(sql.includes('"note" TEXT,'))
  })
})
