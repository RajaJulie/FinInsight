import { prisma } from "@/lib/prisma"
import { DEFAULT_CATEGORY_TEMPLATES } from "@/lib/categories/constants"

export async function ensureDefaultCategories(userId: string) {
  const categoryCount = await prisma.category.count({
    where: { userId },
  })

  if (categoryCount > 0) {
    return
  }

  await prisma.category.createMany({
    data: DEFAULT_CATEGORY_TEMPLATES.map((category) => ({
      ...category,
      userId,
    })),
    skipDuplicates: true,
  })
}

/**
 * Rattache sans perte les anciennes transactions qui possèdent encore
 * uniquement le champ texte `category`.
 */
export async function synchronizeLegacyTransactionCategories(userId: string) {
  await ensureDefaultCategories(userId)

  const [categories, legacyTransactions] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        categoryId: null,
        type: {
          in: ["INCOME", "EXPENSE"],
        },
      },
      select: {
        id: true,
        category: true,
        type: true,
      },
    }),
  ])

  if (legacyTransactions.length === 0) {
    return
  }

  const categoryByKey = new Map(
    categories.map((category) => [
      `${category.type}:${category.name.trim().toLocaleLowerCase("fr-FR")}`,
      category,
    ])
  )

  await prisma.$transaction(async (transaction) => {
    for (const legacyTransaction of legacyTransactions) {
      const name = legacyTransaction.category.trim()

      if (!name) {
        continue
      }

      const key = `${legacyTransaction.type}:${name.toLocaleLowerCase("fr-FR")}`
      let category = categoryByKey.get(key)

      if (!category) {
        category = await transaction.category.upsert({
          where: {
            userId_type_name: {
              userId,
              type: legacyTransaction.type,
              name,
            },
          },
          update: {},
          create: {
            name,
            type: legacyTransaction.type,
            icon: "shapes",
            color: "#64748b",
            userId,
          },
          select: { id: true, name: true, type: true },
        })
        categoryByKey.set(key, category)
      }

      await transaction.transaction.update({
        where: { id: legacyTransaction.id },
        data: {
          categoryId: category.id,
          category: category.name,
        },
      })
    }
  })
}
