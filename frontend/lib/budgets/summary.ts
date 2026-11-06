/**
 * Calcule en centimes le disponible pour les budgets et le reste a repartir
 * depuis les revenus, charges prevues, reserve et enveloppes allouees.
 */
export type BudgetSummary = {
  monthlyIncome: number
  recurringCommittedTotal: number
  emergencyReserve: number
  availableForBudgets: number
  variableBudgetAllocated: number
  spent: number
  freeMoney: number
}

export function calculateBudgetSummary({
  monthlyIncome,
  recurringCommittedTotal,
  emergencyReserve = 0,
  budgetAmounts,
  spent,
}: {
  monthlyIncome: number
  recurringCommittedTotal: number
  emergencyReserve?: number
  budgetAmounts: number[]
  spent: number
}): BudgetSummary {
  // Existing amounts are Float; use cents for allocation arithmetic.
  const incomeCents = Math.round(monthlyIncome * 100)
  const recurringCents = Math.round(recurringCommittedTotal * 100)
  const reserveCents = Math.round(emergencyReserve * 100)
  const budgetCents = budgetAmounts.reduce(
    (total, amount) => total + Math.round(amount * 100),
    0
  )
  const availableCents = incomeCents - recurringCents - reserveCents

  return {
    monthlyIncome: incomeCents / 100,
    recurringCommittedTotal: recurringCents / 100,
    emergencyReserve: reserveCents / 100,
    availableForBudgets: availableCents / 100,
    variableBudgetAllocated: budgetCents / 100,
    spent,
    freeMoney: (availableCents - budgetCents) / 100,
  }
}
