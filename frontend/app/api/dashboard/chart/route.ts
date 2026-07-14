import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

function parseFilters(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get("year"))
  const monthParam = searchParams.get("month") ?? "all"

  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    return { error: "L’année est invalide." } as const
  }

  if (monthParam === "all") {
    return { year, month: "all" as const }
  }

  const month = Number(monthParam)

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "Le mois est invalide." } as const
  }

  return { year, month }
}

export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Non autorisé." },
        { status: 401 }
      )
    }

    const filters = parseFilters(request)

    if ("error" in filters) {
      return NextResponse.json({ message: filters.error }, { status: 400 })
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

    if (filters.month === "all") {
      const startOfYear = new Date(filters.year, 0, 1)
      const startOfNextYear = new Date(filters.year + 1, 0, 1)
      const transactions = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          date: {
            gte: startOfYear,
            lt: startOfNextYear,
          },
        },
        select: {
          amount: true,
          type: true,
          date: true,
        },
      })
      const data = Array.from({ length: 12 }, (_, monthIndex) => ({
        month: `${filters.year}-${String(monthIndex + 1).padStart(2, "0")}`,
        income: 0,
        expense: 0,
      }))

      for (const transaction of transactions) {
        const month = data[transaction.date.getMonth()]

        if (!month) {
          continue
        }

        if (transaction.type === "INCOME") {
          month.income += transaction.amount
        } else {
          month.expense += transaction.amount
        }
      }

      return NextResponse.json({
        mode: "annual",
        year: filters.year,
        data,
      })
    }

    const startOfMonth = new Date(filters.year, filters.month - 1, 1)
    const startOfNextMonth = new Date(filters.year, filters.month, 1)
    const [incomeBeforeMonth, expenseBeforeMonth, monthTransactions] =
      await Promise.all([
        prisma.transaction.aggregate({
          where: {
            userId: user.id,
            type: "INCOME",
            date: {
              lt: startOfMonth,
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
            date: {
              gte: startOfMonth,
              lt: startOfNextMonth,
            },
          },
          select: {
            amount: true,
            type: true,
            date: true,
          },
        }),
      ])

    const openingBalance =
      (incomeBeforeMonth._sum.amount ?? 0) -
      (expenseBeforeMonth._sum.amount ?? 0)
    const dailyChanges = new Map<number, number>()

    for (const transaction of monthTransactions) {
      const day = transaction.date.getDate()
      const signedAmount =
        transaction.type === "INCOME"
          ? transaction.amount
          : -transaction.amount

      dailyChanges.set(day, (dailyChanges.get(day) ?? 0) + signedAmount)
    }

    const daysInMonth = new Date(filters.year, filters.month, 0).getDate()
    let balance = openingBalance
    const data = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      balance += dailyChanges.get(day) ?? 0

      return {
        date: `${filters.year}-${String(filters.month).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`,
        balance,
      }
    })

    return NextResponse.json({
      mode: "monthly",
      year: filters.year,
      month: filters.month,
      openingBalance,
      data,
    })
  } catch (error) {
    console.error("GET_DASHBOARD_CHART_ERROR", error)

    return NextResponse.json(
      { message: "Erreur serveur." },
      { status: 500 }
    )
  }
}
