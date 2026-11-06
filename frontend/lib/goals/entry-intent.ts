/** Une intention garde sa cle apres un echec et bloque les soumissions concurrentes. */
import { GoalRequestError } from "./client"
import type { GoalEntryPayload } from "./contracts"

export function createGoalEntryIntent(generateKey = () => crypto.randomUUID()) {
  let pending = false
  let completed = false
  let uncertain = false
  let operation: { signature: string; payload: GoalEntryPayload } | null = null
  return {
    get uncertain() { return uncertain },
    async run<T>(goalId: string, input: Omit<GoalEntryPayload, "idempotencyKey">, send: (payload: GoalEntryPayload) => Promise<T>) {
      if (pending || completed) return undefined
      const signature = JSON.stringify({ goalId, ...input })
      if (uncertain && operation?.signature !== signature) {
        throw new Error("Vérifiez d'abord le résultat de la même opération avant d'en commencer une autre.")
      }
      if (operation?.signature !== signature) operation = { signature, payload: { ...input, idempotencyKey: generateKey() } }
      pending = true
      try {
        const result = await send(operation.payload)
        completed = true
        uncertain = false
        return result
      } catch (error) {
        // Un echec reseau ou serveur ne prouve pas que l'ecriture n'a pas ete enregistree.
        uncertain ||= !(error instanceof GoalRequestError) || error.status === 0 || error.status >= 500
        throw error
      } finally { pending = false }
    },
  }
}
