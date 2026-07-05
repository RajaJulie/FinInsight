import { NextResponse } from "next/server"

import { auth } from "@/auth"
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

    const [
      historicalIncome,
      historicalExpense,
      currentMonthIncome,
      currentMonthExpense,
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
    ])

    const totalIncome = historicalIncome._sum.amount ?? 0
    const totalExpense = historicalExpense._sum.amount ?? 0
    const monthlyIncome = currentMonthIncome._sum.amount ?? 0
    const monthlyExpense = currentMonthExpense._sum.amount ?? 0

    return NextResponse.json({
      balance: totalIncome - totalExpense,
      monthlyIncome,
      monthlyExpense,
      monthlySaving: monthlyIncome - monthlyExpense,
    })
  } catch (error) {
    console.error("GET_DASHBOARD_SUMMARY_ERROR", error)

    return NextResponse.json(
      { message: "Erreur serveur." },
      { status: 500 }
    )
  }
}
