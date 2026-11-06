/**
 * Represente une erreur attendue des API Objectifs avec un statut HTTP,
 * un code technique et un message public. Permet au service de signaler
 * un refus sans construire lui-meme de reponse HTTP.
 */
export class GoalApiError extends Error {
  constructor(public readonly status: 400 | 401 | 404 | 409, public readonly code: string, message: string) {
    super(message)
    this.name = "GoalApiError"
  }
}
