import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  detectRecurringTransactionSuggestions,
  type DetectableRecurringTransaction,
} from "@/lib/recurring/detection"
import { prisma } from "@/lib/prisma"

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

    const [transactions, recurringTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: {
            in: ["INCOME", "EXPENSE"],
          },
        },
        select: {
          id: true,
          title: true,
          amount: true,
          type: true,
          date: true,
          categoryId: true,
          accountId: true,
          categoryRelation: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.recurringTransaction.findMany({
        where: {
          userId: user.id,
          active: true,
        },
        select: {
          title: true,
          amount: true,
          type: true,
          frequency: true,
          dayOfMonth: true,
          active: true,
          accountId: true,
        },
      }),
    ])
    const confirmedRecurringTransactions: DetectableRecurringTransaction[] =
      recurringTransactions.flatMap((transaction) => {
        if (transaction.type !== "INCOME" && transaction.type !== "EXPENSE") {
          return []
        }

        return [{
          ...transaction,
          type: transaction.type,
        }]
      })
    const suggestions = detectRecurringTransactionSuggestions({
      transactions: transactions.map(({ categoryRelation, ...transaction }) => ({
        ...transaction,
        category: categoryRelation,
      })),
      recurringTransactions: confirmedRecurringTransactions,
    })

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("GET_RECURRING_TRANSACTION_SUGGESTIONS_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
