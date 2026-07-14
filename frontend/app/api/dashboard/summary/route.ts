import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

function getCurrentMonthRange() {
  const now = new Date()

  const startOfPreviousMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  )
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return {
    startOfPreviousMonth,
    startOfMonth,
    startOfNextMonth,
  }
}

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Non autorisé." },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        id: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { message: "Utilisateur introuvable." },
        { status: 404 }
      )
    }

    const { startOfPreviousMonth, startOfMonth, startOfNextMonth } =
      getCurrentMonthRange()

    const [
      historicalIncome,
      historicalExpense,
      currentMonthIncome,
      currentMonthExpense,
      expenseCategoryGroups,
      previousMonthExpenseCategoryGroups,
      recentTransactions,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          userId: user.id,
          type: "INCOME",
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.aggregate({
        where: {
          userId: user.id,
          type: "EXPENSE",
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.aggregate({
        where: {
          userId: user.id,
          type: "INCOME",
          date: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.aggregate({
        where: {
          userId: user.id,
          type: "EXPENSE",
          date: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.groupBy({
        by: ["category"],
        where: {
          userId: user.id,
          type: "EXPENSE",
          date: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
        _sum: {
          amount: true,
        },
        orderBy: {
          _sum: {
            amount: "desc",
          },
        },
      }),
      prisma.transaction.groupBy({
        by: ["category"],
        where: {
          userId: user.id,
          type: "EXPENSE",
          date: {
            gte: startOfPreviousMonth,
            lt: startOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          date: "desc",
        },
        take: 5,
        select: {
          id: true,
          title: true,
          amount: true,
          type: true,
          category: true,
          date: true,
        },
      }),
    ])

    const totalIncome = historicalIncome._sum.amount ?? 0
    const totalExpense = historicalExpense._sum.amount ?? 0
    const monthlyIncome = currentMonthIncome._sum.amount ?? 0
    const monthlyExpense = currentMonthExpense._sum.amount ?? 0
    const expenseCategories =
      monthlyExpense === 0
        ? []
        : expenseCategoryGroups.map((group) => {
            const amount = group._sum.amount ?? 0

            return {
              category: group.category,
              amount,
              percentage: Math.round((amount / monthlyExpense) * 100),
            }
          })
    const previousAmountsByCategory = new Map(
      previousMonthExpenseCategoryGroups.map((group) => [
        group.category,
        group._sum.amount ?? 0,
      ])
    )
    const significantIncrease = expenseCategoryGroups
      .map((group) => {
        const currentAmount = group._sum.amount ?? 0
        const previousAmount =
          previousAmountsByCategory.get(group.category) ?? 0

        if (previousAmount === 0) {
          return null
        }

        return {
          category: group.category,
          currentAmount,
          previousAmount,
          percentageChange: Math.round(
            ((currentAmount - previousAmount) / previousAmount) * 100
          ),
        }
      })
      .filter(
        (insight): insight is NonNullable<typeof insight> =>
          insight !== null && insight.percentageChange >= 10
      )
      .sort((a, b) => b.percentageChange - a.percentageChange)[0]

    const monthlyInsight = significantIncrease
      ? {
          ...significantIncrease,
          trend: "increase" as const,
          message: `Vos dépenses en ${significantIncrease.category} ont augmenté de ${significantIncrease.percentageChange} % par rapport au mois dernier.`,
          advice:
            "Essayez de définir un budget plus bas ou de suivre vos dépenses plus régulièrement.",
        }
      : {
          category: null,
          currentAmount: 0,
          previousAmount: 0,
          percentageChange: 0,
          trend: "neutral" as const,
          message: "Aucune hausse significative de vos dépenses ce mois-ci.",
          advice: "Continuez à suivre régulièrement l’évolution de vos dépenses.",
        }
    return NextResponse.json({
      balance: totalIncome - totalExpense,
      monthlyIncome,
      monthlyExpense,
      monthlySaving: monthlyIncome - monthlyExpense,
      expenseCategories,
      recentTransactions,
      monthlyInsight,
    })
  } catch (error) {
    console.error("GET_DASHBOARD_SUMMARY_ERROR", error)

    return NextResponse.json(
      { message: "Erreur serveur." },
      { status: 500 }
    )
  }
}
