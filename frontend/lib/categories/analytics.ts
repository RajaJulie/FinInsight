import type { TransactionType } from "@/lib/generated/prisma/client"

import { prisma } from "@/lib/prisma"

export type CategoryAnalysisPeriod = "month" | "year" | "all"

export type CategoryDateRange = {
  start: Date | null
  end: Date | null
  previousStart: Date | null
  previousEnd: Date | null
}

export function getCategoryDateRange(
  period: CategoryAnalysisPeriod,
  year: number,
  month: number
): CategoryDateRange {
  if (period === "all") {
    return {
      start: null,
      end: null,
      previousStart: null,
      previousEnd: null,
    }
  }

  if (period === "year") {
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year + 1, 0, 1)),
      previousStart: new Date(Date.UTC(year - 1, 0, 1)),
      previousEnd: new Date(Date.UTC(year, 0, 1)),
    }
  }

  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
    previousStart: new Date(Date.UTC(year, month - 2, 1)),
    previousEnd: new Date(Date.UTC(year, month - 1, 1)),
  }
}

function createDateFilter(start: Date | null, end: Date | null) {
  return start && end ? { gte: start, lt: end } : undefined
}

export async function getCategoryAnalytics({
  userId,
  type,
  range,
}: {
  userId: string
  type: TransactionType
  range: CategoryDateRange
}) {
  const [categories, currentTransactions, previousTransactions] =
    await Promise.all([
      prisma.category.findMany({
        where: { userId, type },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          icon: true,
          color: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          type,
          categoryId: { not: null },
          date: createDateFilter(range.start, range.end),
        },
        select: { categoryId: true, amount: true },
      }),
      range.previousStart && range.previousEnd
        ? prisma.transaction.findMany({
            where: {
              userId,
              type,
              categoryId: { not: null },
              date: createDateFilter(range.previousStart, range.previousEnd),
            },
            select: { categoryId: true, amount: true },
          })
        : Promise.resolve([]),
    ])

  const currentByCategory = new Map<
    string,
    { amount: number; transactionCount: number }
  >()
  const previousByCategory = new Map<string, number>()

  for (const transaction of currentTransactions) {
    if (!transaction.categoryId) continue

    const current = currentByCategory.get(transaction.categoryId) ?? {
      amount: 0,
      transactionCount: 0,
    }
    current.amount += transaction.amount
    current.transactionCount += 1
    currentByCategory.set(transaction.categoryId, current)
  }

  for (const transaction of previousTransactions) {
    if (!transaction.categoryId) continue

    previousByCategory.set(
      transaction.categoryId,
      (previousByCategory.get(transaction.categoryId) ?? 0) + transaction.amount
    )
  }

  const totalAmount = currentTransactions.reduce(
    (total, transaction) => total + transaction.amount,
    0
  )
  const previousTotalAmount = previousTransactions.reduce(
    (total, transaction) => total + transaction.amount,
    0
  )
  const items = categories
    .map((category) => {
      const current = currentByCategory.get(category.id)

      if (!current) return null

      const previousAmount = previousByCategory.get(category.id) ?? 0

      return {
        ...category,
        amount: current.amount,
        transactionCount: current.transactionCount,
        percentage:
          totalAmount > 0 ? (current.amount / totalAmount) * 100 : 0,
        previousAmount,
        percentageChange:
          previousAmount > 0
            ? ((current.amount - previousAmount) / previousAmount) * 100
            : null,
      }
    })
    .filter((category): category is NonNullable<typeof category> => Boolean(category))
    .sort((first, second) => second.amount - first.amount)

  return {
    totalAmount,
    previousTotalAmount,
    percentageChange:
      previousTotalAmount > 0
        ? ((totalAmount - previousTotalAmount) / previousTotalAmount) * 100
        : null,
    usedCategoryCount: items.length,
    topCategory: items[0] ?? null,
    categories: items,
  }
}
