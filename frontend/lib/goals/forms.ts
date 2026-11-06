/** Prepare les formulaires avec les schemas backend ; aucun solde n'est recalcule ici. */
import { createGoalSchema, updateGoalSchema, createGoalEntrySchema } from "@/lib/validations/goal"
import { toGoalCents } from "./money"
import type { GoalAccount, GoalEntryType, GoalStatus, SavingsGoal } from "./contracts"

export const goalStatusLabels: Record<GoalStatus, string> = { ACTIVE: "Actif", PAUSED: "En pause", ARCHIVED: "Archivé" }
export const euroFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
export const goalDateFormatter = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" })

export type GoalFormValues = { title: string; accountId: string; targetAmount: string; targetDate: string; status: GoalStatus }
export function goalFormDefaults(goal?: SavingsGoal): GoalFormValues {
  return {
    title: goal?.title ?? "", accountId: goal?.accountId ?? "", targetAmount: goal ? String(goal.targetAmount).replace(".", ",") : "",
    targetDate: goal?.targetDate?.slice(0, 10) ?? "", status: goal?.status ?? "ACTIVE",
  }
}
export function isEligibleGoalAccount(account: GoalAccount) {
  return account.status === "ACTIVE" && account.currency === "EUR"
}
export function goalStatusOptions(status: GoalStatus): GoalStatus[] {
  return status === "ARCHIVED" ? ["ARCHIVED", "ACTIVE"] : ["ACTIVE", "PAUSED", "ARCHIVED"]
}
function validated<T>(result: { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }): T {
  if (!result.success) throw new Error(result.error.issues.map(issue => issue.message).join(" "))
  return result.data
}
export function buildGoalFormPayload(values: GoalFormValues, goal?: SavingsGoal) {
  const fields = { title: values.title, targetAmount: values.targetAmount.trim().replace(",", "."), targetDate: values.targetDate || null }
  if (goal) {
    if (!goalStatusOptions(goal.status).includes(values.status)) throw new Error("Restaurez d'abord l'objectif en actif avant de le mettre en pause.")
    const parsed = validated(updateGoalSchema.safeParse({ ...fields, status: values.status }))
    return { ...parsed, targetDate: parsed.targetDate?.toISOString().slice(0, 10) ?? null }
  }
  const parsed = validated(createGoalSchema.safeParse({ ...fields, accountId: values.accountId }))
  return { ...parsed, targetDate: parsed.targetDate?.toISOString().slice(0, 10) ?? null }
}

export function goalAllocationBlockReason(goal: SavingsGoal): string | null {
  if (goal.status !== "ACTIVE") return "Seul un objectif actif accepte une affectation."
  if (!isEligibleGoalAccount(goal.account)) return "Le compte doit être actif et en euros."
  if (goal.account.hasFutureEntries) return "Des écritures futures sur ce compte doivent être vérifiées."
  if (goal.account.unreservedAmount <= 0) return "Aucun fonds non réservé n'est disponible sur ce compte."
  return null
}
export function buildGoalEntryInput(type: GoalEntryType, amount: string, note: string, goal: SavingsGoal) {
  const parsed = validated(createGoalEntrySchema.safeParse({
    type, amount: amount.trim().replace(",", "."), note, idempotencyKey: "validation-only",
  }))
  const input = { type: parsed.type, amount: parsed.amount, note: parsed.note }
  if (goal.account.hasFutureEntries) throw new Error("Des écritures futures sur ce compte doivent être vérifiées.")
  const maximum = type === "ALLOCATION" ? goal.account.unreservedAmount : goal.accumulatedAmount
  if (type === "ALLOCATION") {
    const reason = goalAllocationBlockReason(goal)
    if (reason) throw new Error(reason)
  }
  if (toGoalCents(input.amount) > toGoalCents(maximum)) {
    throw new Error(type === "ALLOCATION" ? "Les fonds non réservés du compte sont insuffisants." : "Le montant dépasse la somme libérable de cet objectif.")
  }
  return input
}
