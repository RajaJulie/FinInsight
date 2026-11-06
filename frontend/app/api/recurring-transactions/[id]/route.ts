/**
 * Modifie ou supprime une charge recurrente appartenant a l'utilisateur.
 * Delegue les changements de dates, de prix et d'activite au service qui preserve l'historique.
 */
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { RecurringActivityValidationError } from "@/lib/recurring/activity-transition"
import { updateRecurringTransactionForUser } from "@/lib/recurring/update"
import { updateRecurringTransactionSchema } from "@/lib/validations/recurring-transaction"

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
    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { message: "Corps de requête JSON invalide." },
        { status: 400 }
      )
    }

    const validation = updateRecurringTransactionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const recurringTransaction = await updateRecurringTransactionForUser(user.id, id, validation.data)
    if (!recurringTransaction) {
      return NextResponse.json({ message: "Opération récurrente introuvable." }, { status: 404 })
    }

    return NextResponse.json({
      message: "Opération récurrente modifiée avec succès.",
      recurringTransaction,
    })
  } catch (error) {
    if (error instanceof RecurringActivityValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    if (typeof error === "object" && error !== null && "code" in error && ["P2002", "P2034"].includes(String(error.code))) {
      return NextResponse.json({ message: "Cette charge a été modifiée simultanément. Actualisez puis réessayez." }, { status: 409 })
    }
    console.error("UPDATE_RECURRING_TRANSACTION_ERROR", error)

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
    const recurringTransaction = await prisma.recurringTransaction.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true },
    })

    if (!recurringTransaction) {
      return NextResponse.json(
        { message: "Opération récurrente introuvable." },
        { status: 404 }
      )
    }

    await prisma.recurringTransaction.delete({
      where: { id: recurringTransaction.id },
    })

    return NextResponse.json({
      message: "Opération récurrente supprimée avec succès.",
    })
  } catch (error) {
    console.error("DELETE_RECURRING_TRANSACTION_ERROR", error)

    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
