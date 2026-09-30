import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { confirmRecurringTransactionForUser } from "@/lib/recurring/confirmation"
import { prisma } from "@/lib/prisma"

async function getCurrentUser() {
  const session = await auth()

  if (!session?.user?.email) return null

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
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

    const result = await confirmRecurringTransactionForUser({
      userId: user.id,
      body,
    })

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("CONFIRM_RECURRING_TRANSACTION_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
