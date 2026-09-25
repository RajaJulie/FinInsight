import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { synchronizeLegacyTransactionCategories } from "@/lib/categories/ensure-defaults"
import { prisma } from "@/lib/prisma"
import { isPrismaErrorCode } from "@/lib/prisma-errors"
import { categorySchema } from "@/lib/validations/category"

function getCurrentMonthRange() {
  const now = new Date()

  return {
    startOfMonth: new Date(now.getFullYear(), now.getMonth(), 1),
    startOfNextMonth: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  }
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

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    await synchronizeLegacyTransactionCategories(user.id)

    const { startOfMonth, startOfNextMonth } = getCurrentMonthRange()
    const [categories, monthlyTransactions] = await Promise.all([
      prisma.category.findMany({
        where: { userId: user.id },
        orderBy: [{ type: "asc" }, { name: "asc" }],
        include: {
          _count: {
            select: { transactions: true },
          },
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          categoryId: { not: null },
          date: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
        select: {
          categoryId: true,
          amount: true,
        },
      }),
    ])

    const monthlyByCategory = new Map<
      string,
      { amount: number; transactionCount: number }
    >()

    for (const transaction of monthlyTransactions) {
      if (!transaction.categoryId) continue

      const current = monthlyByCategory.get(transaction.categoryId) ?? {
        amount: 0,
        transactionCount: 0,
      }
      current.amount += transaction.amount
      current.transactionCount += 1
      monthlyByCategory.set(transaction.categoryId, current)
    }
    const categoryItems = categories.map((category) => {
      const monthly = monthlyByCategory.get(category.id)

      return {
        id: category.id,
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color,
        isDefault: category.isDefault,
        transactionCount: category._count.transactions,
        monthlyTransactionCount: monthly?.transactionCount ?? 0,
        monthlyAmount: monthly?.amount ?? 0,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }
    })
    const mostUsedCategory = [...categoryItems]
      .filter((category) => category.monthlyTransactionCount > 0)
      .sort(
        (first, second) =>
          second.monthlyTransactionCount - first.monthlyTransactionCount
      )[0]

    return NextResponse.json({
      categories: categoryItems,
      summary: {
        total: categoryItems.length,
        expense: categoryItems.filter((category) => category.type === "EXPENSE")
          .length,
        income: categoryItems.filter((category) => category.type === "INCOME")
          .length,
        mostUsed: mostUsedCategory
          ? {
              id: mostUsedCategory.id,
              name: mostUsedCategory.name,
              transactionCount: mostUsedCategory.monthlyTransactionCount,
            }
          : null,
      },
    })
  } catch (error) {
    console.error("GET_CATEGORIES_ERROR", error)

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

    const validation = categorySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const duplicate = await prisma.category.findFirst({
      where: {
        userId: user.id,
        type: validation.data.type,
        name: {
          equals: validation.data.name,
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

    const category = await prisma.category.create({
      data: {
        ...validation.data,
        userId: user.id,
      },
    })

    return NextResponse.json(
      {
        message: "Catégorie créée avec succès.",
        category: {
          ...category,
          transactionCount: 0,
          monthlyTransactionCount: 0,
          monthlyAmount: 0,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { message: "Une catégorie portant ce nom existe déjà pour ce type." },
        { status: 409 }
      )
    }

    console.error("CREATE_CATEGORY_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
