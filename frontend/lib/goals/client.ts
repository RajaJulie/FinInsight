/** Lit les reponses Objectifs et conserve les erreurs HTTP sans exposer de details internes. */
export class GoalRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message)
    this.name = "GoalRequestError"
  }
}

export async function requestGoals<T>(url: string, init?: RequestInit, fetcher: typeof fetch = fetch): Promise<T> {
  let response: Response
  try {
    response = await fetcher(url, { ...init, cache: "no-store" })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error
    throw new GoalRequestError("Connexion impossible. Vérifiez votre connexion puis réessayez.", 0)
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const details = data?.errors
    const messages = [...(details?.formErrors ?? []), ...Object.values(details?.fieldErrors ?? {}).flat()]
      .filter((value): value is string => typeof value === "string")
    const fallback = response.status === 401 ? "Votre session a expiré. Reconnectez-vous."
      : response.status === 404 ? "Cet objectif ou ce compte n'est plus accessible."
      : "Impossible de terminer l'opération. Réessayez."
    throw new GoalRequestError(response.status === 401 ? fallback : messages.length ? messages.join(" ") : data?.message ?? fallback, response.status, data?.code)
  }
  if (!data) throw new GoalRequestError("Réponse du serveur illisible. Rechargez les données.", 500)
  return data as T
}

export function goalErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur est survenue. Réessayez."
}
