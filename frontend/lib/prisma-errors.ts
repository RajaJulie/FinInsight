/**
 * Identifie un code d'erreur Prisma dans une valeur inconnue pour permettre
 * aux routes de traiter les conflits attendus sans assertion de type non verifiee.
 */
export function isPrismaErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  )
}
