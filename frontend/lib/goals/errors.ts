/**
 * Definit les erreurs metier des calculs Objectifs et leurs codes stables.
 * Ces erreurs restent independantes du transport HTTP et de Prisma.
 */
export type GoalRuleErrorCode =
  | "INVALID_MONEY"
  | "MONEY_OUT_OF_RANGE"
  | "INVALID_ENTRY_TYPE"
  | "NEGATIVE_GOAL_BALANCE"
  | "DUPLICATE_GOAL"
  | "GOAL_NOT_FOUND"
  | "EXCESSIVE_RELEASE"
  | "INSUFFICIENT_UNRESERVED_FUNDS"

export class GoalRuleError extends Error {
  constructor(public readonly code: GoalRuleErrorCode, message: string) {
    super(message)
    this.name = "GoalRuleError"
  }
}
