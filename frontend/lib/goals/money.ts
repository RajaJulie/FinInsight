/**
 * Valide les montants Objectifs et les convertit exactement entre euros et centimes.
 * Utilise Decimal et refuse la precision excessive ou les depassements sans arrondi silencieux.
 */
import { Decimal } from "@prisma/client/runtime/index-browser"
import { GoalRuleError } from "./errors"

export type GoalMoney = number | string | Decimal

const MAX_STORED_AMOUNT = new Decimal("9999999999.99")

export function toGoalCents(value: GoalMoney): number {
  if ((typeof value !== "number" && typeof value !== "string" && !Decimal.isDecimal(value)) ||
    (typeof value === "string" && (value !== value.trim() || !/^-?\d+(?:\.\d{1,2})?$/.test(value)))) {
    throw new GoalRuleError("INVALID_MONEY", "Le montant doit avoir au maximum deux decimales.")
  }
  const amount = new Decimal(value)
  if (!amount.isFinite() || amount.decimalPlaces() > 2) {
    throw new GoalRuleError("INVALID_MONEY", "Le montant doit etre fini et precis au centime.")
  }
  const cents = amount.times(100)
  if (!cents.abs().lte(Number.MAX_SAFE_INTEGER)) {
    throw new GoalRuleError("MONEY_OUT_OF_RANGE", "Le montant depasse la precision prise en charge.")
  }
  return cents.toNumber()
}

export function toPositiveGoalCents(value: GoalMoney): number {
  const cents = toGoalCents(value)
  if (cents <= 0) {
    throw new GoalRuleError("INVALID_MONEY", "Le montant doit etre strictement positif.")
  }
  if (new Decimal(value).gt(MAX_STORED_AMOUNT)) {
    throw new GoalRuleError("MONEY_OUT_OF_RANGE", "Le montant depasse Decimal(12,2).")
  }
  return cents
}

export function addGoalCents(first: number, second: number): number {
  const total = first + second
  if (![first, second, total].every(Number.isSafeInteger)) {
    throw new GoalRuleError("MONEY_OUT_OF_RANGE", "Le total depasse la precision prise en charge.")
  }
  return total
}

export function fromGoalCents(cents: number): number {
  const amount = cents / 100
  if (!Number.isSafeInteger(cents) || !new Decimal(amount).times(100).eq(cents)) {
    throw new GoalRuleError("MONEY_OUT_OF_RANGE", "Le montant ne peut pas etre expose sans perdre de centimes.")
  }
  return amount === 0 ? 0 : amount
}
