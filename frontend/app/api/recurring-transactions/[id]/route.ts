import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { updateRecurringTransactionSchema } from "@/lib/validations/recurring-transaction"

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

const recurringTransactionRelations = {
  category: {
    select: {
      id: true,
      name: true,
      type: true,
      icon: true,
      color: true,
    },
  },
  account: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
} as const

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    const { id } = await context.params
    const currentRecurringTransaction =
      await prisma.recurringTransaction.findFirst({
        where: {
          id,
          userId: user.id,
        },
        select: {
          id: true,
          type: true,
          categoryId: true,
          accountId: true,
        },
      })

    if (!currentRecurringTransaction) {
      return NextResponse.json(
        { message: "Opération récurrente introuvable." },
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

    const validation = updateRecurringTransactionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const nextType = validation.data.type ?? currentRecurringTransaction.type
    const nextCategoryId =
      validation.data.categoryId ?? currentRecurringTransaction.categoryId
    const nextAccountId =
      validation.data.accountId ?? currentRecurringTransaction.accountId
    const shouldCheckCategory =
      validation.data.categoryId !== undefined ||
      validation.data.type !== undefined
    const shouldCheckAccount = validation.data.accountId !== undefined

    const [category, account] = await Promise.all([
      shouldCheckCategory
        ? prisma.category.findFirst({
            where: {
              id: nextCategoryId,
              userId: user.id,
              type: nextType,
            },
            select: { id: true },
          })
        : Promise.resolve({ id: nextCategoryId }),
      shouldCheckAccount
        ? prisma.account.findFirst({
            where: {
              id: nextAccountId,
              userId: user.id,
              status: "ACTIVE",
            },
            select: { id: true },
          })
        : Promise.resolve({ id: nextAccountId }),
    ])

    if (!category) {
      return NextResponse.json(
        {
          message:
            "La catégorie doit appartenir à l’utilisateur et être compatible avec le type choisi.",
        },
        { status: 400 }
      )
    }

    if (!account) {
      return NextResponse.json(
        {
          message:
            "Le compte doit être un compte actif appartenant à l’utilisateur.",
        },
        { status: 400 }
      )
    }

    const recurringTransaction = await prisma.recurringTransaction.update({
      where: { id: currentRecurringTransaction.id },
      data: validation.data,
      include: recurringTransactionRelations,
    })

    return NextResponse.json({
      message: "Opération récurrente modifiée avec succès.",
      recurringTransaction,
    })
  } catch (error) {
    console.error("UPDATE_RECURRING_TRANSACTION_ERROR", error)

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
    const recurringTransaction = await prisma.recurringTransaction.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true },
    })

    if (!recurringTransaction) {
      return NextResponse.json(
        { message: "Opération récurrente introuvable." },
        { status: 404 }
      )
    }

    await prisma.recurringTransaction.delete({
      where: { id: recurringTransaction.id },
    })

    return NextResponse.json({
      message: "Opération récurrente supprimée avec succès.",
    })
  } catch (error) {
    console.error("DELETE_RECURRING_TRANSACTION_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
