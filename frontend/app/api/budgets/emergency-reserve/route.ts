/**
 * Enregistre par PUT la reserve d'urgence planifiee de l'utilisateur pour un mois.
 * Met a jour la planification uniquement, sans creer de depense ni mouvement bancaire.
 */
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { emergencyReserveSchema } from "@/lib/validations/emergency-reserve"

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ message: "Non autorisé." }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: "JSON invalide." }, { status: 400 })
    }
    const validation = emergencyReserveSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { message: "Données invalides.", errors: validation.error.flatten() },
        { status: 400 }
      )
    }
    const { month, year, amount } = validation.data
    const reserve = await prisma.monthlyEmergencyReserve.upsert({
      where: { userId_year_month: { userId: user.id, year, month } },
      create: { userId: user.id, year, month, amount },
      update: { amount },
    })

    return NextResponse.json({
      message: "Réserve enregistrée.",
      reserve: { ...reserve, amount: Number(reserve.amount) },
    })
  } catch (error) {
    console.error("PUT_EMERGENCY_RESERVE_ERROR", error)
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 })
  }
}
