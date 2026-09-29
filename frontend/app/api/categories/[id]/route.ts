import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { isPrismaErrorCode } from "@/lib/prisma-errors"
import { updateCategorySchema } from "@/lib/validations/category"

type RouteContext = {
  params: Promise<{ id: string }>
}

async function getCurrentUser() {
  const session = await auth()

  if (!session?.user?.email) {
    return null
  }

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
    const category = await prisma.category.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: {
          select: {
            transactions: true,
            budgets: true,
            recurringTransactions: true,
          },
        },
      },
    })

    if (!category) {
      return NextResponse.json(
        { message: "Catégorie introuvable." },
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

    const validation = updateCategorySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    if (
      validation.data.type &&
      validation.data.type !== category.type &&
      (category._count.transactions > 0 ||
        category._count.budgets > 0 ||
        category._count.recurringTransactions > 0)
    ) {
      return NextResponse.json(
        {
          message:
            "Le type ne peut pas être modifié tant que des transactions, budgets ou opérations récurrentes utilisent cette catégorie.",
        },
        { status: 409 }
      )
    }

    const nextType = validation.data.type ?? category.type
    const nextName = validation.data.name ?? category.name
    const duplicate = await prisma.category.findFirst({
      where: {
        id: { not: category.id },
        userId: user.id,
        type: nextType,
        name: {
          equals: nextName,
          mode: "insensitive",
        },
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json(
        { message: "Une catégorie portant ce nom existe déjà pour ce type." },
        { status: 409 }
      )
    }

    const updatedCategory = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.category.update({
        where: { id: category.id },
        data: validation.data,
      })

      if (validation.data.name && validation.data.name !== category.name) {
        await transaction.transaction.updateMany({
          where: {
            categoryId: category.id,
            userId: user.id,
          },
          data: { category: validation.data.name },
        })
      }

      return updated
    })

    return NextResponse.json({
      message: "Catégorie modifiée avec succès.",
      category: {
        ...updatedCategory,
        transactionCount: category._count.transactions,
      },
    })
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { message: "Une catégorie portant ce nom existe déjà pour ce type." },
        { status: 409 }
      )
    }

    console.error("UPDATE_CATEGORY_ERROR", error)

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
    const category = await prisma.category.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: {
          select: {
            transactions: true,
            budgets: true,
            recurringTransactions: true,
          },
        },
      },
    })

    if (!category) {
      return NextResponse.json(
        { message: "Catégorie introuvable." },
        { status: 404 }
      )
    }

    if (category._count.transactions > 0) {
      return NextResponse.json(
        {
          message:
            "Cette catégorie est utilisée par des transactions et ne peut pas être supprimée.",
        },
        { status: 409 }
      )
    }

    if (category._count.budgets > 0) {
      return NextResponse.json(
        {
          message:
            "Cette catégorie est utilisée par des budgets et ne peut pas être supprimée.",
        },
        { status: 409 }
      )
    }

    if (category._count.recurringTransactions > 0) {
      return NextResponse.json(
        {
          message:
            "Cette catégorie est utilisée par des opérations récurrentes et ne peut pas être supprimée.",
        },
        { status: 409 }
      )
    }

    await prisma.category.delete({
      where: { id: category.id },
    })

    return NextResponse.json({ message: "Catégorie supprimée avec succès." })
  } catch (error) {
    console.error("DELETE_CATEGORY_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
