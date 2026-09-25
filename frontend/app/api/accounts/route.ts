import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { ensureDefaultAccount } from "@/lib/accounts/ensure-default"
import { serializeAccount } from "@/lib/accounts/serialize"
import { prisma } from "@/lib/prisma"
import { isPrismaErrorCode } from "@/lib/prisma-errors"
import { accountSchema } from "@/lib/validations/account"

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

    await ensureDefaultAccount(user.id)

    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      orderBy: [
        { status: "asc" },
        { isPrimary: "desc" },
        { createdAt: "asc" },
      ],
      include: {
        transactions: {
          select: {
            amount: true,
            type: true,
            date: true,
          },
        },
        incomingTransfers: {
          select: {
            amount: true,
            date: true,
          },
        },
      },
    })
    const items = accounts.map(serializeAccount)
    const activeAccounts = items.filter(
      (account) => account.status === "ACTIVE"
    )
    const primaryAccount =
      activeAccounts.find((account) => account.isPrimary) ??
      activeAccounts[0] ??
      null
    const lastActivity = activeAccounts.reduce<Date | null>(
      (latestDate, account) =>
        account.lastActivity &&
        (!latestDate || account.lastActivity > latestDate)
          ? account.lastActivity
          : latestDate,
      null
    )
    const netWorth = activeAccounts.reduce(
      (total, account) => total + account.currentBalance,
      0
    )
    const savingsBalance = activeAccounts
      .filter((account) => account.type === "SAVINGS")
      .reduce((total, account) => total + account.currentBalance, 0)

    return NextResponse.json({
      accounts: items,
      summary: {
        totalBalance: netWorth,
        netWorth,
        savingsBalance,
        activeCount: activeAccounts.length,
        primaryAccount: primaryAccount
          ? {
              id: primaryAccount.id,
              name: primaryAccount.name,
              currentBalance: primaryAccount.currentBalance,
              currency: primaryAccount.currency,
            }
          : null,
        lastActivity,
      },
    })
  } catch (error) {
    console.error("GET_ACCOUNTS_ERROR", error)

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

    const validation = accountSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const duplicate = await prisma.account.findFirst({
      where: {
        userId: user.id,
        name: {
          equals: validation.data.name,
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

    const accountCount = await prisma.account.count({
      where: { userId: user.id },
    })
    const shouldBePrimary = validation.data.isPrimary || accountCount === 0
    const account = await prisma.$transaction(async (transaction) => {
      if (shouldBePrimary) {
        await transaction.account.updateMany({
          where: { userId: user.id, isPrimary: true },
          data: { isPrimary: false },
        })
      }

      return transaction.account.create({
        data: {
          ...validation.data,
          isPrimary: shouldBePrimary,
          userId: user.id,
        },
      })
    })

    return NextResponse.json(
      {
        message: "Compte créé avec succès.",
        account: {
          ...account,
          currentBalance: account.initialBalance,
          transactionCount: 0,
          lastActivity: null,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { message: "Un compte portant ce nom existe déjà." },
        { status: 409 }
      )
    }

    console.error("CREATE_ACCOUNT_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
