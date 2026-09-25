import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { isPrismaErrorCode } from "@/lib/prisma-errors"
import { updateAccountSchema } from "@/lib/validations/account"

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
    const account = await prisma.account.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: {
          select: {
            transactions: true,
            incomingTransfers: true,
          },
        },
      },
    })

    if (!account) {
      return NextResponse.json(
        { message: "Compte introuvable." },
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

    const validation = updateAccountSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const nextName = validation.data.name ?? account.name
    const duplicate = await prisma.account.findFirst({
      where: {
        id: { not: account.id },
        userId: user.id,
        name: {
          equals: nextName,
          mode: "insensitive",
        },
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json(
        { message: "Un compte portant ce nom existe déjà." },
        { status: 409 }
      )
    }

    const isArchiving =
      validation.data.status === "ARCHIVED" && account.status === "ACTIVE"
    const shouldBecomePrimary = validation.data.isPrimary === true
    const isRemovingPrimary =
      account.isPrimary &&
      validation.data.isPrimary === false &&
      !isArchiving
    const nextStatus = validation.data.status ?? account.status

    if (shouldBecomePrimary && nextStatus !== "ACTIVE") {
      return NextResponse.json(
        { message: "Un compte archivé ne peut pas être le compte principal." },
        { status: 409 }
      )
    }

    const replacementAccount = isArchiving || isRemovingPrimary
      ? await prisma.account.findFirst({
          where: {
            userId: user.id,
            id: { not: account.id },
            status: "ACTIVE",
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })
      : null

    if (isArchiving && !replacementAccount) {
      return NextResponse.json(
        { message: "Vous devez conserver au moins un compte actif." },
        { status: 409 }
      )
    }

    if (isRemovingPrimary && !replacementAccount) {
      return NextResponse.json(
        { message: "Un autre compte actif doit devenir le compte principal." },
        { status: 409 }
      )
    }

    const updatedAccount = await prisma.$transaction(async (transaction) => {
      if (shouldBecomePrimary) {
        await transaction.account.updateMany({
          where: {
            userId: user.id,
            id: { not: account.id },
            isPrimary: true,
          },
          data: { isPrimary: false },
        })
      }

      if (
        account.isPrimary &&
        replacementAccount &&
        (isArchiving || isRemovingPrimary)
      ) {
        await transaction.account.update({
          where: { id: account.id },
          data: { isPrimary: false },
        })
        await transaction.account.update({
          where: { id: replacementAccount.id },
          data: { isPrimary: true },
        })
      }

      return transaction.account.update({
        where: { id: account.id },
        data: {
          ...validation.data,
          ...(isArchiving ? { isPrimary: false } : {}),
        },
      })
    })

    return NextResponse.json({
      message: isArchiving
        ? "Compte archivé avec succès."
        : "Compte modifié avec succès.",
      account: {
        ...updatedAccount,
        transactionCount:
          account._count.transactions + account._count.incomingTransfers,
      },
    })
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { message: "Un compte portant ce nom existe déjà." },
        { status: 409 }
      )
    }

    console.error("UPDATE_ACCOUNT_ERROR", error)

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
    const account = await prisma.account.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: {
          select: {
            transactions: true,
            incomingTransfers: true,
          },
        },
      },
    })

    if (!account) {
      return NextResponse.json(
        { message: "Compte introuvable." },
        { status: 404 }
      )
    }

    if (
      account._count.transactions > 0 ||
      account._count.incomingTransfers > 0
    ) {
      return NextResponse.json(
        {
          message:
            "Ce compte contient des transactions et doit être archivé plutôt que supprimé.",
        },
        { status: 409 }
      )
    }

    const accountCount = await prisma.account.count({
      where: { userId: user.id },
    })

    if (accountCount <= 1) {
      return NextResponse.json(
        { message: "Vous devez conserver au moins un compte." },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.account.delete({
        where: { id: account.id },
      })

      if (account.isPrimary) {
        const replacementAccount = await transaction.account.findFirst({
          where: { userId: user.id, status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })

        if (replacementAccount) {
          await transaction.account.update({
            where: { id: replacementAccount.id },
            data: { isPrimary: true },
          })
        }
      }
    })

    return NextResponse.json({ message: "Compte supprimé avec succès." })
  } catch (error) {
    console.error("DELETE_ACCOUNT_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
