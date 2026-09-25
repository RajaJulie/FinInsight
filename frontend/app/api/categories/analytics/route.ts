import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  getCategoryAnalytics,
  getCategoryDateRange,
} from "@/lib/categories/analytics"
import { synchronizeLegacyTransactionCategories } from "@/lib/categories/ensure-defaults"
import { prisma } from "@/lib/prisma"
import { categoryAnalyticsQuerySchema } from "@/lib/validations/category-analytics"

export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json(
        { message: "Utilisateur introuvable." },
        { status: 404 }
      )
    }

    const url = new URL(request.url)
    const validation = categoryAnalyticsQuerySchema.safeParse({
      period: url.searchParams.get("period") ?? undefined,
      year: url.searchParams.get("year") ?? undefined,
      month: url.searchParams.get("month") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
    })

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Filtres invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    await synchronizeLegacyTransactionCategories(user.id)

    const { period, year, month, type } = validation.data
    const [analysis, transactionDates] = await Promise.all([
      getCategoryAnalytics({
        userId: user.id,
        type,
        range: getCategoryDateRange(period, year, month),
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id },
        _min: { date: true },
        _max: { date: true },
      }),
    ])

    const firstYear = transactionDates._min.date?.getUTCFullYear() ?? year
    const lastYear = transactionDates._max.date?.getUTCFullYear() ?? year
    const minimumYear = Math.min(firstYear, year)
    const maximumYear = Math.max(lastYear, year)
    const availableYears = Array.from(
      { length: maximumYear - minimumYear + 1 },
      (_, index) => maximumYear - index
    )

    return NextResponse.json({
      filters: { period, year, month, type },
      availableYears,
      summary: {
        totalAmount: analysis.totalAmount,
        topCategory: analysis.topCategory
          ? {
              id: analysis.topCategory.id,
              name: analysis.topCategory.name,
              amount: analysis.topCategory.amount,
            }
          : null,
        usedCategoryCount: analysis.usedCategoryCount,
        percentageChange: analysis.percentageChange,
      },
      categories: analysis.categories,
    })
  } catch (error) {
    console.error("GET_CATEGORY_ANALYTICS_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
