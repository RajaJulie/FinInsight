import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { transactionSchema } from "@/lib/validations/transaction"

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

async function getCurrentUser() {
  const session = await auth()

  if (!session?.user?.email) return null

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
}

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      include: transactionRelations,
    })

    return NextResponse.json(transactions.map(serializeTransaction))
  } catch (error) {
    console.error("GET_TRANSACTIONS_ERROR", error)

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

    const validation = transactionSchema.safeParse(body)

    if (!validation.success) {
      const { fieldErrors, formErrors } = validation.error.flatten()

      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: fieldErrors,
          formErrors,
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

      const transaction = await prisma.transaction.create({
        data: {
          title: validation.data.title,
          amount: validation.data.amount,
          type: "TRANSFER",
          category: "Virement interne",
          categoryId: null,
          accountId: sourceAccount.id,
          destinationAccountId: destinationAccount.id,
          date: validation.data.date,
          userId: user.id,
        },
        include: transactionRelations,
      })

      return NextResponse.json(
        {
          message: "Virement interne créé avec succès.",
          transaction: serializeTransaction(transaction),
        },
        { status: 201 }
      )
    }

    const category = await prisma.category.findFirst({
      where: {
        id: validation.data.categoryId,
        userId: user.id,
        type: validation.data.type,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (!category) {
      return NextResponse.json(
        { message: "La catégorie sélectionnée est invalide pour ce type." },
        { status: 400 }
      )
    }

    const transaction = await prisma.transaction.create({
      data: {
        title: validation.data.title,
        amount: validation.data.amount,
        type: validation.data.type,
        category: category.name,
        categoryId: category.id,
        accountId: sourceAccount.id,
        destinationAccountId: null,
        date: validation.data.date,
        userId: user.id,
      },
      include: transactionRelations,
    })

    return NextResponse.json(
      {
        message: "Transaction créée avec succès.",
        transaction: serializeTransaction(transaction),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("CREATE_TRANSACTION_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
