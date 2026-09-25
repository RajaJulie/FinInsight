import { prisma } from "@/lib/prisma"

export function getBudgetDateRange(month: number, year: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  }
}

export function calculateBudgetProgress(amount: number, spent: number) {
  return {
    spent,
    remaining: amount - spent,
    percentage: (spent / amount) * 100,
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
  const { start, end } = getBudgetDateRange(month, year)
  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      categoryId,
      type: "EXPENSE",
      date: {
        gte: start,
        lt: end,
      },
    },
    _sum: {
      amount: true,
    },
  })

  return result._sum.amount ?? 0
}
