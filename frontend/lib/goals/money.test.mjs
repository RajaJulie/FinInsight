/**
 * Teste la precision des centimes, les limites Decimal et les conversions monetaires
 * des objectifs, notamment les valeurs invalides et les depassements de capacite.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Decimal } from "@prisma/client/runtime/client"
import { loadTs } from "../testing/load-ts.mjs"

const { toGoalCents, toPositiveGoalCents, fromGoalCents, addGoalCents } = loadTs("lib/goals/money.ts")
const hasCode = code => error => error?.name === "GoalRuleError" && error.code === code

describe("exact goal money", () => {
  it("converts numbers, decimal strings and Prisma decimals without floating multiplication", () => {
    for (const [input, expected] of [[0.29, 29], [0.1, 10], [0.2, 20], [34.9, 3490], ["0.01", 1], [new Decimal("123.45"), 12345]]) {
      assert.equal(toGoalCents(input), expected)
      assert.equal(toPositiveGoalCents(input), expected)
      assert.equal(fromGoalCents(expected), Number(input))
    }
    assert.equal(fromGoalCents(addGoalCents(toGoalCents(0.1), toGoalCents(0.2))), 0.3)
  })
  it("accepts zero and negative bank balances, but not zero/negative targets or entries", () => {
    for (const [value, cents] of [[0, 0], [-0, -0], [-1, -100], ["-0.01", -1], [new Decimal("-20.31"), -2031]]) {
      assert.equal(toGoalCents(value), cents)
      assert.throws(() => toPositiveGoalCents(value), hasCode("INVALID_MONEY"))
    }
    assert.equal(fromGoalCents(-2031), -20.31)
    assert.equal(Object.is(fromGoalCents(-0), -0), false)
  })
  it("rejects excess precision rather than silently rounding", () => {
    for (const value of [1.005, 0.1 + 0.2, "1.001", "1.000", new Decimal("1.009")]) {
      assert.throws(() => toGoalCents(value), hasCode("INVALID_MONEY"))
    }
  })
  it("rejects non-finite, malformed and non-monetary inputs", () => {
    for (const value of [NaN, Infinity, -Infinity, "", " 1.00 ", "1.00\n", "1,00", "0x10", "NaN", "Infinity", "1e2", null, undefined, true, {}, { toString: () => "1.00" }, new Decimal(NaN)]) {
      assert.throws(() => toGoalCents(value), hasCode("INVALID_MONEY"))
    }
  })
  it("respects Decimal(12,2) for stored targets and entries", () => {
    assert.equal(toPositiveGoalCents("9999999999.99"), 999999999999)
    assert.throws(() => toPositiveGoalCents("10000000000.00"), hasCode("MONEY_OUT_OF_RANGE"))
    // A calculated bank balance can exceed one individual stored amount.
    assert.equal(toGoalCents("10000000000.00"), 1000000000000)
  })
  it("fails explicitly when a sum or euro representation would lose cents", () => {
    assert.throws(() => toGoalCents("90071992547409.92"), hasCode("MONEY_OUT_OF_RANGE"))
    assert.throws(() => addGoalCents(Number.MAX_SAFE_INTEGER, 1), hasCode("MONEY_OUT_OF_RANGE"))
    assert.throws(() => addGoalCents(0.5, 0.5), hasCode("MONEY_OUT_OF_RANGE"))
    assert.throws(() => fromGoalCents(Number.MAX_SAFE_INTEGER), hasCode("MONEY_OUT_OF_RANGE"))
    assert.throws(() => fromGoalCents(1.5), hasCode("MONEY_OUT_OF_RANGE"))
  })
})
