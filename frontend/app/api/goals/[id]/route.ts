/**
 * Gere la consultation d'un objectif et de son historique (GET), ainsi que
 * la modification de ses informations (PATCH). Le service verifie la propriete
 * de l'objectif et conserve les ecritures d'affectation et de liberation.
 */
import { NextResponse } from "next/server"
import { updateGoalSchema } from "@/lib/validations/goal"
import { getGoalForUser, updateGoalForUser } from "@/lib/goals/service"
import { goalErrorResponse, readGoalBody, requireGoalUser } from "@/lib/goals/http"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireGoalUser()
    const { id } = await context.params
    return NextResponse.json(await getGoalForUser(user.id, id))
  } catch (error) { return goalErrorResponse(error, "GET_GOAL_ERROR") }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireGoalUser()
    const { id } = await context.params
    const input = await readGoalBody(request, updateGoalSchema)
    return NextResponse.json(await updateGoalForUser(user.id, id, input))
  } catch (error) { return goalErrorResponse(error, "UPDATE_GOAL_ERROR") }
}
