import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  calculateBudgetProgress,
  getSpentForBudget,
} from "@/lib/budgets/progress"
import { prisma } from "@/lib/prisma"
import { isPrismaErrorCode } from "@/lib/prisma-errors"
import { updateBudgetSchema } from "@/lib/validations/budget"

type RouteContext = {
  params: Promise<{ id: string }>
}

async function getCurrentUser() {
  const session = await auth()

  if (!session?.user?.email) return null

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    const { id } = await context.params
    const currentBudget = await prisma.budget.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        amount: true,
        month: true,
        year: true,
        categoryId: true,
      },
    })

    if (!currentBudget) {
      return NextResponse.json(
        { message: "Budget introuvable." },
        { status: 404 }
      )
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

    const validation = updateBudgetSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const nextCategoryId =
      validation.data.categoryId ?? currentBudget.categoryId
    const category = await prisma.category.findFirst({
      where: {
        id: nextCategoryId,
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

    const nextMonth = validation.data.month ?? currentBudget.month
    const nextYear = validation.data.year ?? currentBudget.year
    const duplicate = await prisma.budget.findFirst({
      where: {
        id: { not: currentBudget.id },
        userId: user.id,
        categoryId: category.id,
        month: nextMonth,
        year: nextYear,
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

    const budget = await prisma.budget.update({
      where: { id: currentBudget.id },
      data: validation.data,
    })
    const spent = await getSpentForBudget({
      userId: user.id,
      categoryId: budget.categoryId,
      month: budget.month,
      year: budget.year,
    })

    return NextResponse.json({
      message: "Budget modifié avec succès.",
      budget: {
        ...budget,
        category,
        ...calculateBudgetProgress(budget.amount, spent),
      },
    })
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

    console.error("UPDATE_BUDGET_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    const { id } = await context.params
    const budget = await prisma.budget.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true },
    })

    if (!budget) {
      return NextResponse.json(
        { message: "Budget introuvable." },
        { status: 404 }
      )
    }

    await prisma.budget.delete({
      where: { id: budget.id },
    })

    return NextResponse.json({ message: "Budget supprimé avec succès." })
  } catch (error) {
    console.error("DELETE_BUDGET_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
