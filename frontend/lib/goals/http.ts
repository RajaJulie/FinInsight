/**
 * Regroupe les outils HTTP communs aux routes Objectifs : retrouver l'utilisateur
 * via Auth.js et son email, valider le JSON et convertir les erreurs en reponses
 * coherentes sans exposer les details internes de la base de donnees.
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { GoalApiError } from "./api-errors"
import { GoalRuleError } from "./errors"

export async function requireGoalUser() {
  const session = await auth()
  const user = session?.user?.email ? await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }) : null
  if (!user) throw new GoalApiError(401, "UNAUTHORIZED", "Non autorisé.")
  return user
}

export async function readGoalBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  let body: unknown
  try { body = await request.json() } catch {
    throw new GoalApiError(400, "INVALID_JSON", "Corps de requête JSON invalide.")
  }
  return schema.parse(body)
}

export function goalErrorResponse(error: unknown, context: string) {
  if (error instanceof z.ZodError) return NextResponse.json({ message: "Données invalides.", code: "VALIDATION_ERROR", errors: error.flatten() }, { status: 400 })
  if (error instanceof GoalApiError) return NextResponse.json({ message: error.message, code: error.code }, { status: error.status })
  if (error instanceof GoalRuleError && ["EXCESSIVE_RELEASE", "INSUFFICIENT_UNRESERVED_FUNDS"].includes(error.code)) {
    return NextResponse.json({ message: error.code === "EXCESSIVE_RELEASE" ? "La libération dépasse le montant accumulé." : "Les fonds non réservés du compte sont insuffisants.", code: error.code }, { status: 409 })
  }
  console.error(context, error instanceof Error ? error.name : "UnknownError")
  return NextResponse.json({ message: "Erreur serveur.", code: "SERVER_ERROR" }, { status: 500 })
}
