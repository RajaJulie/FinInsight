/**
 * Enregistre une affectation ou une liberation virtuelle pour un objectif.
 * Renvoie 201 pour une nouvelle ecriture et 200 pour une operation identique
 * deja enregistree avec la meme cle, sans creer de transaction bancaire.
 */
import { NextResponse } from "next/server"
import { createGoalEntrySchema } from "@/lib/validations/goal"
import { createGoalEntryForUser } from "@/lib/goals/service"
import { goalErrorResponse, readGoalBody, requireGoalUser } from "@/lib/goals/http"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireGoalUser()
    const { id } = await context.params
    const input = await readGoalBody(request, createGoalEntrySchema)
    const result = await createGoalEntryForUser(user.id, id, input)
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 })
  } catch (error) { return goalErrorResponse(error, "CREATE_GOAL_ENTRY_ERROR") }
}
