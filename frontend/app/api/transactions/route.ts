import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Non autorisé." },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
    })

    if (!user) {
      return NextResponse.json(
        { message: "Utilisateur introuvable." },
        { status: 404 }
      )
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        date: "desc",
      },
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error("GET_TRANSACTIONS_ERROR", error)

    return NextResponse.json(
      { message: "Erreur serveur." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Non autorisé." },
        { status: 401 }
      )
    }

    const body = await request.json()

    const { title, amount, type, category, date } = body

    if (!title || !amount || !type || !category) {
      return NextResponse.json(
        { message: "Tous les champs sont obligatoires." },
        { status: 400 }
      )
    }

    if (type !== "INCOME" && type !== "EXPENSE") {
      return NextResponse.json(
        { message: "Type de transaction invalide." },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
    })

    if (!user) {
      return NextResponse.json(
        { message: "Utilisateur introuvable." },
        { status: 404 }
      )
    }

    const transaction = await prisma.transaction.create({
      data: {
        title,
        amount: Number(amount),
        type,
        category,
        date: date ? new Date(date) : new Date(),
        userId: user.id,
      },
    })

    return NextResponse.json(
      {
        message: "Transaction créée avec succès.",
        transaction,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("CREATE_TRANSACTION_ERROR", error)

    return NextResponse.json(
      { message: "Erreur serveur." },
      { status: 500 }
    )
  }
}