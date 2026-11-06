/**
 * Point d'entree HTTP pour lister les objectifs de l'utilisateur connecte (GET)
 * et en creer un sans affectation initiale (POST). Delegue l'authentification,
 * la validation et les regles metier aux modules partages.
 */
import { NextResponse } from "next/server"
import { createGoalSchema } from "@/lib/validations/goal"
import { createGoalForUser, listGoalsForUser } from "@/lib/goals/service"
import { goalErrorResponse, readGoalBody, requireGoalUser } from "@/lib/goals/http"

export async function GET() {
  try {
    const user = await requireGoalUser()
    return NextResponse.json(await listGoalsForUser(user.id))
  } catch (error) { return goalErrorResponse(error, "GET_GOALS_ERROR") }
}

export async function POST(request: Request) {
  try {
    const user = await requireGoalUser()
    const input = await readGoalBody(request, createGoalSchema)
    return NextResponse.json(await createGoalForUser(user.id, input), { status: 201 })
  } catch (error) { return goalErrorResponse(error, "CREATE_GOAL_ERROR") }
}
