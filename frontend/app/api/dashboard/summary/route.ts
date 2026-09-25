import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  getCategoryAnalytics,
  getCategoryDateRange,
} from "@/lib/categories/analytics"
import { ensureDefaultAccount } from "@/lib/accounts/ensure-default"
import { synchronizeLegacyTransactionCategories } from "@/lib/categories/ensure-defaults"
import { prisma } from "@/lib/prisma"

function getCurrentMonthRange() {
  const now = new Date()

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return {
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

    const { startOfMonth, startOfNextMonth } = getCurrentMonthRange()

    await synchronizeLegacyTransactionCategories(user.id)
    await ensureDefaultAccount(user.id)

    const [
      activeAccounts,
      currentMonthIncome,
      currentMonthExpense,
      categoryAnalysis,
      recentTransactionRows,
    ] = await Promise.all([
      prisma.account.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
        },
        select: {
          type: true,
          initialBalance: true,
          transactions: {
            select: {
              amount: true,
              type: true,
            },
          },
          incomingTransfers: {
            select: {
              amount: true,
            },
          },
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
      getCategoryAnalytics({
        userId: user.id,
        type: "EXPENSE",
        range: getCategoryDateRange(
          "month",
          startOfMonth.getFullYear(),
          startOfMonth.getMonth() + 1
        ),
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
          categoryRelation: {
            select: {
              name: true,
            },
          },
          account: {
            select: {
              name: true,
            },
          },
          destinationAccount: {
            select: {
              name: true,
            },
          },
          date: true,
        },
      }),
    ])

    const accountBalances = activeAccounts.map((account) => ({
      type: account.type,
      balance:
        account.initialBalance +
        account.transactions.reduce(
          (accountBalance, transaction) =>
            accountBalance +
            (transaction.type === "INCOME"
              ? transaction.amount
              : -transaction.amount),
          0
        ) +
        account.incomingTransfers.reduce(
          (incomingBalance, transaction) =>
            incomingBalance + transaction.amount,
          0
        ),
    }))
    const netWorth = accountBalances.reduce(
      (total, account) => total + account.balance,
      0
    )
    const availableBalance = accountBalances
      .filter(
        (account) =>
          account.type === "CHECKING" || account.type === "CASH"
      )
      .reduce((total, account) => total + account.balance, 0)
    const savingsBalance = accountBalances
      .filter((account) => account.type === "SAVINGS")
      .reduce((total, account) => total + account.balance, 0)
    const monthlyIncome = currentMonthIncome._sum.amount ?? 0
    const monthlyExpense = currentMonthExpense._sum.amount ?? 0
    const expenseCategories = categoryAnalysis.categories.map((category) => ({
      category: category.name,
      amount: category.amount,
      percentage: Math.round(category.percentage),
    }))
    const significantIncrease = categoryAnalysis.categories
      .filter(
        (category) =>
          category.percentageChange !== null &&
          category.percentageChange >= 10
      )
      .map((category) => ({
        category: category.name,
        currentAmount: category.amount,
        previousAmount: category.previousAmount,
        percentageChange: Math.round(category.percentageChange ?? 0),
      }))
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
    const recentTransactions = recentTransactionRows.map((transaction) => ({
      id: transaction.id,
      title: transaction.title,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.categoryRelation?.name ?? transaction.category,
      sourceAccountName: transaction.account?.name ?? null,
      destinationAccountName: transaction.destinationAccount?.name ?? null,
      date: transaction.date,
    }))

    return NextResponse.json({
      balance: availableBalance,
      availableBalance,
      netWorth,
      savingsBalance,
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
