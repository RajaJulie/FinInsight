/**
 * Confirme le lien entre une depense existante et une charge recurrente accessible.
 * Controle la compatibilite du paiement sans creer, supprimer ou debiter une transaction.
 */
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { isPaymentInRecurringPeriod } from "@/lib/recurring/reconciliation"

const paymentSchema = z.object({ transactionId: z.string().trim().min(1) }).strict()

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    if (!user) return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json({ message: "Corps de requête JSON invalide." }, { status: 400 })
    }
    const validation = paymentSchema.safeParse(body)
    if (!validation.success) return NextResponse.json({ message: "Transaction obligatoire et données invalides." }, { status: 400 })
    const { id } = await context.params
    const result = await prisma.$transaction(async (tx) => {
      const [recurring, transaction] = await Promise.all([
        tx.recurringTransaction.findFirst({
          where: { id, userId: user.id, type: "EXPENSE", account: { userId: user.id }, category: { userId: user.id } },
          include: { sourceTransactions: { select: { transactionId: true } }, activityPeriods: true },
        }),
        tx.transaction.findFirst({ where: { id: validation.data.transactionId, userId: user.id, type: "EXPENSE", account: { userId: user.id } } }),
      ])
      if (!recurring || !transaction) return { status: 404, message: "Charge ou transaction introuvable." }
      if (!isPaymentInRecurringPeriod(transaction, recurring)) return { status: 400, message: "Le paiement doit concerner le même compte et la période de cette charge." }
      const date = transaction.date
      const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
      const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
      const existing = await tx.recurringTransactionSource.findFirst({
        where: { OR: [
          { transactionId: transaction.id },
          { recurringTransactionId: recurring.id, transaction: { date: { gte: start, lt: end } } },
        ] }, select: { id: true },
      })
      if (existing) return { status: 409, message: "Ce paiement est déjà associé, ou cette charge a déjà un paiement confirmé ce mois-ci." }
      await tx.recurringTransactionSource.create({ data: { recurringTransactionId: recurring.id, transactionId: transaction.id } })
      return { status: 201, message: "Paiement rapproché. Aucune transaction bancaire n’a été modifiée." }
    }, { isolationLevel: "Serializable" })
    return NextResponse.json({ message: result.message }, { status: result.status })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && ["P2002", "P2034"].includes(String(error.code))) {
      return NextResponse.json({ message: "Un rapprochement concurrent a eu lieu. Actualisez la liste." }, { status: 409 })
    }
    console.error("CONFIRM_RECURRING_PAYMENT_ERROR", error)
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
