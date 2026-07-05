import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const updateTransactionSchema = z
  .object({
    title: z.string().trim().min(1, "Le titre ne doit pas être vide."),
    amount: z.coerce
      .number()
      .positive("Le montant doit être supérieur à 0."),
    type: z.enum(["INCOME", "EXPENSE"]),
    category: z.string().trim().min(1, "La catégorie ne doit pas être vide."),
    date: z.coerce.date("La date doit être valide."),
  })
  .strict()
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ modifiable est requis.",
  })

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Non autorisé." },
        { status: 401 }
      )
    }

    const { id } = await context.params

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

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!transaction) {
      return NextResponse.json(
        { message: "Transaction introuvable." },
        { status: 404 }
      )
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

    const validation = updateTransactionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides.",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const updatedTransaction = await prisma.transaction.update({
      where: {
        id: transaction.id,
      },
      data: validation.data,
    })

    return NextResponse.json(updatedTransaction)
  } catch (error) {
    console.error("UPDATE_TRANSACTION_ERROR", error)

    return NextResponse.json(
      { message: "Erreur serveur." },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Non autorisé." },
        { status: 401 }
      )
    }

    const { id } = await context.params

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

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!transaction) {
      return NextResponse.json(
        { message: "Transaction introuvable." },
        { status: 404 }
      )
    }

    await prisma.transaction.delete({
      where: {
        id: transaction.id,
      },
    })

    return NextResponse.json({
      message: "Transaction supprimée avec succès.",
    })
  } catch (error) {
    console.error("DELETE_TRANSACTION_ERROR", error)

    return NextResponse.json(
      { message: "Erreur serveur." },
      { status: 500 }
    )
  }
}
