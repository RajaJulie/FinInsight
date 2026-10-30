import { getMonthlyBudgetActivity } from "@/lib/budgets/monthly-activity"

export function getBudgetDateRange(month: number, year: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  }
}

export async function getSpentForBudget({
  userId,
  categoryId,
  month,
  year,
}: {
  userId: string
  categoryId: string
  month: number
  year: number
}) {
  const activity = await getMonthlyBudgetActivity(userId, month, year)
  return activity.spentByCategory.get(categoryId) ?? 0
}
