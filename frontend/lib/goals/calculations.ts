/**
 * Fournit les calculs purs des enveloppes virtuelles : accumulation, progression,
 * fonds reserves et couverture par compte. Les controles utilisent un instantane fourni
 * par l'appelant ; ils n'effectuent aucune ecriture et ne garantissent pas seuls la concurrence.
 */
import { Decimal } from "@prisma/client/runtime/client"
import type { GoalEntryType, SavingsGoalStatus } from "@/lib/generated/prisma/client"
import { GoalRuleError } from "./errors"
import { addGoalCents, fromGoalCents, toGoalCents, toPositiveGoalCents, type GoalMoney } from "./money"

export type GoalEntryValue = Readonly<{ type: GoalEntryType; amount: GoalMoney }>
// Snapshots include every status and only entries effective at the chosen cutoff, scoped by owner.
// The supplied bank balance must describe the same account/cutoff. No helper performs reads or writes.
export type GoalWithEntries = Readonly<{
  id: string
  accountId: string
  status: SavingsGoalStatus
  entries: readonly GoalEntryValue[]
}>

function accumulatedCents(entries: readonly GoalEntryValue[]) {
  const cents = entries.reduce((total, entry) => {
    if (entry.type !== "ALLOCATION" && entry.type !== "RELEASE") {
      throw new GoalRuleError("INVALID_ENTRY_TYPE", "Type d'ecriture inconnu.")
    }
    const amount = toPositiveGoalCents(entry.amount)
    return addGoalCents(total, entry.type === "ALLOCATION" ? amount : -amount)
  }, 0)
  if (cents < 0) {
    throw new GoalRuleError("NEGATIVE_GOAL_BALANCE", "Le journal contient plus de liberations que d'affectations.")
  }
  return cents
}

export function getGoalAccumulatedAmount(entries: readonly GoalEntryValue[]): number {
  return fromGoalCents(accumulatedCents(entries))
}

export function getGoalSummary({ targetAmount, entries }: { targetAmount: GoalMoney; entries: readonly GoalEntryValue[] }) {
  const target = toPositiveGoalCents(targetAmount)
  const accumulated = accumulatedCents(entries)
  const difference = addGoalCents(target, -accumulated)
  return {
    accumulatedAmount: fromGoalCents(accumulated),
    progressPercentage: new Decimal(accumulated).div(target).times(100).toDecimalPlaces(2).toNumber(),
    remainingAmount: fromGoalCents(Math.max(0, difference)),
    excessAmount: fromGoalCents(Math.max(0, -difference)),
    reached: accumulated >= target,
  }
}

function reservedCentsByAccount(goals: readonly GoalWithEntries[]) {
  const totals = new Map<string, number>()
  const seen = new Set<string>()
  // Status never releases money: paused and archived envelopes still reserve their entries.
  for (const goal of goals) {
    if (seen.has(goal.id)) {
      throw new GoalRuleError("DUPLICATE_GOAL", "Le meme objectif a ete fourni plusieurs fois.")
    }
    seen.add(goal.id)
    totals.set(goal.accountId, addGoalCents(totals.get(goal.accountId) ?? 0, accumulatedCents(goal.entries)))
  }
  return totals
}

export function getReservedByAccount(goals: readonly GoalWithEntries[]): Map<string, number> {
  return new Map([...reservedCentsByAccount(goals)].map(([id, cents]) => [id, fromGoalCents(cents)]))
}

export function getAccountFunding({ accountId, bankBalance, goals }: {
  accountId: string
  bankBalance: GoalMoney
  goals: readonly GoalWithEntries[]
}) {
  const reserved = reservedCentsByAccount(goals).get(accountId) ?? 0
  const unreserved = addGoalCents(toGoalCents(bankBalance), -reserved)
  return {
    reservedAmount: fromGoalCents(reserved),
    unreservedAmount: fromGoalCents(unreserved),
    underfunded: unreserved < 0,
    shortfallAmount: fromGoalCents(Math.max(0, -unreserved)),
  }
}

export function assertCanRelease({ amount, entries }: { amount: GoalMoney; entries: readonly GoalEntryValue[] }): void {
  if (toPositiveGoalCents(amount) > accumulatedCents(entries)) {
    throw new GoalRuleError("EXCESSIVE_RELEASE", "La liberation depasse le montant affecte a l'objectif.")
  }
}

// The caller must supply an owned, complete, effective-date snapshot and enforce concurrency/idempotency on writes.
export function assertCanAllocate({ goalId, amount, bankBalance, goals }: {
  goalId: string
  amount: GoalMoney
  bankBalance: GoalMoney
  goals: readonly GoalWithEntries[]
}): void {
  const cents = toPositiveGoalCents(amount)
  const goal = goals.find(item => item.id === goalId)
  if (!goal) throw new GoalRuleError("GOAL_NOT_FOUND", "Objectif absent de l'instantane fourni.")
  const reserved = reservedCentsByAccount(goals).get(goal.accountId) ?? 0
  const available = addGoalCents(toGoalCents(bankBalance), -reserved)
  if (cents > available) {
    throw new GoalRuleError("INSUFFICIENT_UNRESERVED_FUNDS", "Le solde non reserve du compte est insuffisant.")
  }
}
