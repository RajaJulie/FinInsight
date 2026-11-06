/**
 * Fournit les libelles, payloads et messages d'erreur d'activation ou desactivation.
 * Remplace la charge concernee dans une liste sans alterer les autres series.
 */
export type RecurringStatusPatchPayload = {
  active: boolean
}

export type RecurringStatusItem = {
  id: string
  active: boolean
}

export function getRecurringStatusLabel(active: boolean) {
  return active ? "Actif" : "Inactif"
}

export function getRecurringStatusActionLabel(active: boolean) {
  return active ? "Désactiver" : "Réactiver"
}

export function getRecurringStatusPatchPayload(active: boolean) {
  return { active } satisfies RecurringStatusPatchPayload
}

export function replaceRecurringTransactionById<
  Item extends RecurringStatusItem,
>(items: Item[], updatedItem: Item) {
  return items.map((item) => (item.id === updatedItem.id ? updatedItem : item))
}

export function getRecurringStatusErrorMessage(
  status: number,
  message?: string
) {
  if (status === 404) {
    return message ?? "Cette charge récurrente est introuvable."
  }

  if (status === 401) {
    return message ?? "Vous devez être connecté pour modifier cette charge."
  }

  if (status === 400) {
    return message ?? "La modification demandée est invalide."
  }

  return message ?? "Impossible de modifier cette charge récurrente."
}
