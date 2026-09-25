import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  calculateBudgetProgress,
  getBudgetDateRange,
  getSpentForBudget,
} from "@/lib/budgets/progress"
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

    await synchronizeLegacyTransactionCategories(user.id)

    const { month, year } = validation.data
    const { start, end } = getBudgetDateRange(month, year)
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
    const spentGroups =
      categoryIds.length === 0
        ? []
        : await prisma.transaction.groupBy({
            by: ["categoryId"],
            where: {
              userId: user.id,
              categoryId: {
                in: categoryIds,
              },
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
    const spentByCategory = new Map(
      spentGroups.map((group) => [
        group.categoryId,
        group._sum.amount ?? 0,
      ])
    )

    return NextResponse.json({
      month,
      year,
      budgets: budgets.map((budget) => {
        const spent = spentByCategory.get(budget.categoryId) ?? 0

        return {
          ...budget,
          ...calculateBudgetProgress(budget.amount, spent),
        }
      }),
    })
  } catch (error) {
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
          ...calculateBudgetProgress(budget.amount, spent),
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
