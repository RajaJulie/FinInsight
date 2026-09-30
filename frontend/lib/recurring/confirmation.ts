import {
  detectRecurringTransactionSuggestions,
  normalizeRecurringTitle,
  type DetectableRecurringTransaction,
} from "./detection"
import { prisma } from "../prisma"
import { confirmRecurringTransactionSchema } from "../validations/recurring-transaction"

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
  sourceTransactions: {
    select: {
      transactionId: true,
    },
  },
} as const

export async function confirmRecurringTransactionForUser({
  userId,
  body,
}: {
  userId: string
  body: unknown
}) {
  const validation = confirmRecurringTransactionSchema.safeParse(body)

  if (!validation.success) {
    return {
      status: 400,
      body: {
        message: "Données invalides.",
        errors: validation.error.flatten(),
      },
    } as const
  }

  const suggestions = await getCurrentUserSuggestions(userId)
  const suggestion = suggestions.find(
    (item) => item.suggestionId === validation.data.suggestionId
  )

  if (!suggestion) {
    return {
      status: 404,
      body: { message: "Suggestion introuvable ou déjà confirmée." },
    } as const
  }

  if (validation.data.type && validation.data.type !== suggestion.type) {
    return {
      status: 400,
      body: { message: "Le type doit correspondre à la suggestion détectée." },
    } as const
  }

  const sourceTransactionIds = suggestion.occurrences.map(
    (occurrence) => occurrence.transactionId
  )
  const uniqueSourceTransactionIds = Array.from(new Set(sourceTransactionIds))

  if (uniqueSourceTransactionIds.length !== sourceTransactionIds.length) {
    return {
      status: 409,
      body: { message: "La suggestion contient des sources invalides." },
    } as const
  }

  const [category, account, sourceTransactionCount] = await Promise.all([
    prisma.category.findFirst({
      where: {
        id: validation.data.categoryId,
        userId,
        type: suggestion.type,
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
        userId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    }),
    prisma.transaction.count({
      where: {
        id: {
          in: uniqueSourceTransactionIds,
        },
        userId,
      },
    }),
  ])

  if (!category) {
    return {
      status: 400,
      body: {
        message:
          "La catégorie doit appartenir à l’utilisateur et être compatible avec le type détecté.",
      },
    } as const
  }

  if (!account) {
    return {
      status: 400,
      body: {
        message:
          "Le compte doit être un compte actif appartenant à l’utilisateur.",
      },
    } as const
  }

  if (sourceTransactionCount !== uniqueSourceTransactionIds.length) {
    return {
      status: 409,
      body: { message: "Les transactions sources sont invalides." },
    } as const
  }

  try {
    const recurringTransaction = await prisma.$transaction(async (tx) => {
      const existingSource = await tx.recurringTransactionSource.findFirst({
        where: {
          transactionId: {
            in: uniqueSourceTransactionIds,
          },
        },
        select: {
          id: true,
        },
      })

      if (existingSource) {
        throw new RecurringSuggestionAlreadyConfirmedError()
      }

      const createdRecurringTransaction = await tx.recurringTransaction.create({
        data: {
          title: validation.data.title,
          amount: validation.data.amount,
          type: suggestion.type,
          frequency: validation.data.frequency,
          dayOfMonth: validation.data.dayOfMonth,
          active: validation.data.active,
          userId,
          categoryId: category.id,
          accountId: account.id,
          detectionTitleNorm: normalizeRecurringTitle(suggestion.title),
          detectionAccountId: suggestion.accountId,
          detectionType: suggestion.type,
        },
        select: {
          id: true,
        },
      })

      await tx.recurringTransactionSource.createMany({
        data: uniqueSourceTransactionIds.map((transactionId) => ({
          recurringTransactionId: createdRecurringTransaction.id,
          transactionId,
        })),
      })

      return tx.recurringTransaction.findUniqueOrThrow({
        where: { id: createdRecurringTransaction.id },
        include: recurringTransactionRelations,
      })
    })

    return {
      status: 201,
      body: {
        message: "Suggestion confirmée avec succès.",
        recurringTransaction,
      },
    } as const
  } catch (error) {
    if (
      error instanceof RecurringSuggestionAlreadyConfirmedError ||
      isUniqueConstraintError(error)
    ) {
      return {
        status: 409,
        body: { message: "Suggestion déjà confirmée." },
      } as const
    }

    throw error
  }
}

class RecurringSuggestionAlreadyConfirmedError extends Error {}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

export async function getCurrentUserSuggestions(userId: string) {
  const [transactions, recurringTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
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
        userId,
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
        detectionTitleNorm: true,
        detectionAccountId: true,
        detectionType: true,
        sourceTransactions: {
          select: {
            transactionId: true,
            transaction: {
              select: {
                date: true,
                amount: true,
                title: true,
              },
            },
          },
        },
      },
    }),
  ])
  const confirmedRecurringTransactions: DetectableRecurringTransaction[] =
    recurringTransactions.flatMap((transaction) => {
      if (transaction.type !== "INCOME" && transaction.type !== "EXPENSE") {
        return []
      }

      return [{
        title: transaction.title,
        amount: transaction.amount,
        type: transaction.type,
        frequency: transaction.frequency,
        dayOfMonth: transaction.dayOfMonth,
        active: transaction.active,
        accountId: transaction.accountId,
        detectionTitleNorm: transaction.detectionTitleNorm,
        detectionAccountId: transaction.detectionAccountId,
        detectionType:
          transaction.detectionType === "INCOME" ||
          transaction.detectionType === "EXPENSE"
            ? transaction.detectionType
            : null,
        sourceTransactionIds: transaction.sourceTransactions.map(
          (source) => source.transactionId
        ),
        sourceTransactions: transaction.sourceTransactions.map((source) => ({
          transactionId: source.transactionId,
          date: source.transaction.date.toISOString(),
          amount: source.transaction.amount,
          title: source.transaction.title,
        })),
      }]
    })

  return detectRecurringTransactionSuggestions({
    transactions: transactions.map(({ categoryRelation, ...transaction }) => ({
      ...transaction,
      category: categoryRelation,
    })),
    recurringTransactions: confirmedRecurringTransactions,
  })
}
