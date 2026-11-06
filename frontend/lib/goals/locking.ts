/**
 * Coordonne les ecritures Objectifs par compte dans des transactions Prisma.
 * Verrouille les comptes et les mouvements bancaires pendant les controles,
 * puis retente au plus trois fois les conflits reconnus. Une violation unique
 * impose une relecture de l'operation et ne constitue jamais un succes a elle seule.
 */
import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { GoalApiError } from "./api-errors"

export class GoalSnapshotChanged extends Error {}

function conflictCodes(error: unknown) {
  if (typeof error !== "object" || error === null) return []
  const value = error as { code?: string; meta?: { code?: string; driverAdapterError?: { cause?: { originalCode?: string } } } }
  return [value.code, value.meta?.code, value.meta?.driverAdapterError?.cause?.originalCode]
}

export async function withGoalWrite<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Fresh READ COMMITTED statements after account locks avoid a pre-lock stale snapshot.
      return await prisma.$transaction(work, { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 10000 })
    } catch (error) {
      const codes = conflictCodes(error)
      const retryable = error instanceof GoalSnapshotChanged || codes.some(code => code && ["P2034", "40001", "40P01", "P2002"].includes(code))
      if (!retryable && !codes.some(code => code && ["P2028", "55P03"].includes(code))) throw error
      if (!retryable || attempt === 2) {
        throw new GoalApiError(409, "CONCURRENT_CHANGE", "Une modification concurrente a empêché l'opération. Actualisez puis réessayez avec la même clé.")
      }
      // A unique conflict is retried from scratch; only an actual matching journal row can be replayed.
      await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)))
    }
  }
  throw new Error("Unreachable goal retry state")
}

export async function lockGoalAccounts(tx: Prisma.TransactionClient, userId: string, accountIds: string[]) {
  for (const id of [...new Set(accountIds)].sort()) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Account" WHERE "id" = ${id} AND "userId" = ${userId} FOR UPDATE
    `
    if (rows.length !== 1) throw new GoalApiError(404, "ACCOUNT_NOT_FOUND", "Compte introuvable.")
  }
}

export async function lockGoalBankMovements(tx: Prisma.TransactionClient, userId: string, accountId: string) {
  // Account FOR UPDATE blocks new FK references; SHARE freezes existing movements against edits/deletes.
  await tx.$queryRaw`
    SELECT "id" FROM "Transaction"
    WHERE "userId" = ${userId} AND ("accountId" = ${accountId} OR "destinationAccountId" = ${accountId})
    ORDER BY "id" FOR SHARE
  `
}
