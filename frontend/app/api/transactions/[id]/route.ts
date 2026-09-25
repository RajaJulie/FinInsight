import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  transactionSchema,
  updateTransactionSchema,
} from "@/lib/validations/transaction"

const transactionRelations = {
  categoryRelation: {
    select: { name: true },
  },
  account: {
    select: { id: true, name: true },
  },
  destinationAccount: {
    select: { id: true, name: true },
  },
} as const

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

function serializeTransaction<
  T extends {
    category: string
    categoryRelation: { name: string } | null
  },
>({ categoryRelation, ...transaction }: T) {
  return {
    ...transaction,
    category: categoryRelation?.name ?? transaction.category,
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    const { id } = await context.params
    const existingTransaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    })

    if (!existingTransaction) {
      return NextResponse.json(
        { message: "Transaction introuvable." },
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

    const patchValidation = updateTransactionSchema.safeParse(body)

    if (!patchValidation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: patchValidation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const patch = patchValidation.data
    const effectiveType = patch.type ?? existingTransaction.type
    const commonData = {
      title: patch.title ?? existingTransaction.title,
      amount: patch.amount ?? existingTransaction.amount,
      type: effectiveType,
      accountId: patch.accountId ?? existingTransaction.accountId ?? "",
      date: patch.date ?? existingTransaction.date,
    }
    const candidate =
      effectiveType === "TRANSFER"
        ? {
            ...commonData,
            type: "TRANSFER" as const,
            destinationAccountId:
              patch.destinationAccountId ??
              existingTransaction.destinationAccountId ??
              "",
          }
        : {
            ...commonData,
            type: effectiveType,
            categoryId:
              patch.categoryId ?? existingTransaction.categoryId ?? "",
          }
    const validation = transactionSchema.safeParse(candidate)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const sourceAccount = await prisma.account.findFirst({
      where: {
        id: validation.data.accountId,
        userId: user.id,
        status: "ACTIVE",
      },
      select: { id: true },
    })

    if (!sourceAccount) {
      return NextResponse.json(
        { message: "Le compte source est invalide ou archivé." },
        { status: 400 }
      )
    }

    if (validation.data.type === "TRANSFER") {
      const destinationAccount = await prisma.account.findFirst({
        where: {
          id: validation.data.destinationAccountId,
          userId: user.id,
          status: "ACTIVE",
        },
        select: { id: true },
      })

      if (!destinationAccount) {
        return NextResponse.json(
          { message: "Le compte destination est invalide ou archivé." },
          { status: 400 }
        )
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id: existingTransaction.id },
        data: {
          title: validation.data.title,
          amount: validation.data.amount,
          type: "TRANSFER",
          category: "Virement interne",
          categoryId: null,
          accountId: sourceAccount.id,
          destinationAccountId: destinationAccount.id,
          date: validation.data.date,
        },
        include: transactionRelations,
      })

      return NextResponse.json(serializeTransaction(updatedTransaction))
    }

    const category = await prisma.category.findFirst({
      where: {
        id: validation.data.categoryId,
        userId: user.id,
        type: validation.data.type,
      },
      select: { id: true, name: true },
    })

    if (!category) {
      return NextResponse.json(
        { message: "La catégorie sélectionnée est invalide pour ce type." },
        { status: 400 }
      )
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id: existingTransaction.id },
      data: {
        title: validation.data.title,
        amount: validation.data.amount,
        type: validation.data.type,
        category: category.name,
        categoryId: category.id,
        accountId: sourceAccount.id,
        destinationAccountId: null,
        date: validation.data.date,
      },
      include: transactionRelations,
    })

    return NextResponse.json(serializeTransaction(updatedTransaction))
  } catch (error) {
    console.error("UPDATE_TRANSACTION_ERROR", error)

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
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })

    if (!transaction) {
      return NextResponse.json(
        { message: "Transaction introuvable." },
        { status: 404 }
      )
    }

    await prisma.transaction.delete({
      where: { id: transaction.id },
    })

    return NextResponse.json({
      message: "Transaction supprimée avec succès.",
    })
  } catch (error) {
    console.error("DELETE_TRANSACTION_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
