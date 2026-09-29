import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { recurringTransactionSchema } from "@/lib/validations/recurring-transaction"

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

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    const recurringTransactions = await prisma.recurringTransaction.findMany({
      where: { userId: user.id },
      orderBy: [{ active: "desc" }, { dayOfMonth: "asc" }, { title: "asc" }],
      include: recurringTransactionRelations,
    })

    return NextResponse.json({ recurringTransactions })
  } catch (error) {
    console.error("GET_RECURRING_TRANSACTIONS_ERROR", error)

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

    const validation = recurringTransactionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const [category, account] = await Promise.all([
      prisma.category.findFirst({
        where: {
          id: validation.data.categoryId,
          userId: user.id,
          type: validation.data.type,
        },
        select: {
          id: true,
          name: true,
          type: true,
          icon: true,
          color: true,
        },
      }),
      prisma.account.findFirst({
        where: {
          id: validation.data.accountId,
          userId: user.id,
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
      }),
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

    const recurringTransaction = await prisma.recurringTransaction.create({
      data: {
        ...validation.data,
        userId: user.id,
      },
      include: recurringTransactionRelations,
    })

    return NextResponse.json(
      {
        message: "Opération récurrente créée avec succès.",
        recurringTransaction,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("CREATE_RECURRING_TRANSACTION_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
