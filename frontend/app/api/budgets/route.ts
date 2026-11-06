/**
 * Liste les budgets du mois avec leur synthese de planification et leur bilan reel.
 * Permet aussi de creer une enveloppe variable sur une categorie de l'utilisateur.
 */
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { getSpentForBudget } from "@/lib/budgets/progress"
import { getMonthlyBudgetActivity } from "@/lib/budgets/monthly-activity"
import { getCumulativeMonthlyResult } from "@/lib/budgets/cumulative-result"
import { InvalidAccountScopeError } from "@/lib/accounts/scope-summary"
import { getEnvelopeRemaining, sumMoney } from "@/lib/budgets/money"
import { calculateBudgetSummary } from "@/lib/budgets/summary"
import { synchronizeLegacyTransactionCategories } from "@/lib/categories/ensure-defaults"
import { prisma } from "@/lib/prisma"
import { isPrismaErrorCode } from "@/lib/prisma-errors"
import {
  budgetPeriodSchema,
  budgetSchema,
} from "@/lib/validations/budget"

async function getCurrentUser() {
  const session = await auth()

  if (!session?.user?.email) return null

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    const searchParams = new URL(request.url).searchParams
    const validation = budgetPeriodSchema.safeParse({
      month: searchParams.get("month"),
      year: searchParams.get("year"),
    })

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Période invalide.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { month, year } = validation.data
    const accountSelection = z.array(z.string().min(1).max(128)).max(100).safeParse(
      searchParams.has("accountIds") ? (searchParams.get("accountIds") ? searchParams.get("accountIds")!.split(",") : []) : undefined
    )
    if (searchParams.has("accountIds") && !accountSelection.success) {
      return NextResponse.json({ message: "Périmètre de comptes invalide." }, { status: 400 })
    }
    const budgets = await prisma.budget.findMany({
      where: {
        userId: user.id,
        month,
        year,
      },
      orderBy: {
        category: {
          name: "asc",
        },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    })
    const categoryIds = budgets.map((budget) => budget.categoryId)
    const { spentByCategory, monthlyIncome, recurringCommittedTotal, pendingPayments, recurringPayments, actualSummary } =
      await getMonthlyBudgetActivity(user.id, month, year)
    const cumulativeResult = await getCumulativeMonthlyResult(user.id, month, year, actualSummary.remaining, accountSelection.success ? accountSelection.data : undefined)
    const spent = sumMoney(categoryIds.map((id) => spentByCategory.get(id) ?? 0))
    const reserve = await prisma.monthlyEmergencyReserve.findUnique({
      where: { userId_year_month: { userId: user.id, year, month } },
      select: { amount: true },
    })

    return NextResponse.json({
      month,
      year,
      pendingPayments,
      recurringPayments,
      actualSummary,
      cumulativeResult,
      summary: calculateBudgetSummary({
        monthlyIncome,
        recurringCommittedTotal,
        emergencyReserve: reserve ? Number(reserve.amount) : 0,
        budgetAmounts: budgets.map((budget) => budget.amount),
        spent,
      }),
      budgets: budgets.map((budget) => {
        const spent = spentByCategory.get(budget.categoryId) ?? 0
        return {
          ...budget,
          spent,
          remaining: getEnvelopeRemaining(budget.amount, spent),
        }
      }),
    })
  } catch (error) {
    if (error instanceof InvalidAccountScopeError) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    console.error("GET_BUDGETS_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { message: "Corps de requête JSON invalide." },
        { status: 400 }
      )
    }

    const validation = budgetSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    await synchronizeLegacyTransactionCategories(user.id)

    const category = await prisma.category.findFirst({
      where: {
        id: validation.data.categoryId,
        userId: user.id,
        type: "EXPENSE",
      },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
      },
    })

    if (!category) {
      return NextResponse.json(
        {
          message:
            "La catégorie doit être une catégorie de dépense appartenant à l’utilisateur.",
        },
        { status: 400 }
      )
    }

    const duplicate = await prisma.budget.findFirst({
      where: {
        userId: user.id,
        categoryId: category.id,
        month: validation.data.month,
        year: validation.data.year,
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json(
        {
          message:
            "Un budget existe déjà pour cette catégorie et cette période.",
        },
        { status: 409 }
      )
    }

    const budget = await prisma.budget.create({
      data: {
        ...validation.data,
        categoryId: category.id,
        userId: user.id,
      },
    })
    const spent = await getSpentForBudget({
      userId: user.id,
      categoryId: budget.categoryId,
      month: budget.month,
      year: budget.year,
    })

    return NextResponse.json(
      {
        message: "Budget créé avec succès.",
        budget: {
          ...budget,
          category,
          spent,
          remaining: getEnvelopeRemaining(budget.amount, spent),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        {
          message:
            "Un budget existe déjà pour cette catégorie et cette période.",
        },
        { status: 409 }
      )
    }

    console.error("CREATE_BUDGET_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
