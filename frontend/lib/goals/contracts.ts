/** Contrats JSON des API Objectifs, utilisables sans dependance serveur. */
export type GoalStatus = "ACTIVE" | "PAUSED" | "ARCHIVED"
export type GoalEntryType = "ALLOCATION" | "RELEASE"

export type GoalAccount = {
  id: string
  name: string
  type: string
  currency: string
  status: "ACTIVE" | "ARCHIVED"
  bankBalance: number
  balanceVerified: boolean
  hasFutureEntries: boolean
  reservedAmount: number
  unreservedAmount: number
  underfunded: boolean
  shortfallAmount: number
}

export type GoalWarning = { code: string; message: string }
export type SavingsGoal = {
  id: string
  title: string
  accountId: string
  account: GoalAccount
  targetAmount: number
  targetDate: string | null
  status: GoalStatus
  accumulatedAmount: number
  remainingAmount: number
  excessAmount: number
  progressPercentage: number
  reached: boolean
  createdAt: string
  updatedAt: string
  warnings: GoalWarning[]
}

export type GoalEntry = {
  id: string
  type: GoalEntryType
  amount: number
  effectiveAt: string
  note: string | null
  idempotencyKey: string
  createdAt: string
}
export type SavingsGoalDetail = SavingsGoal & { entries: GoalEntry[] }
export type GoalsResponse = { goals: SavingsGoal[]; accounts: GoalAccount[]; asOf: string }
export type GoalDetailResponse = { goal: SavingsGoalDetail; asOf: string }
export type GoalMutationResponse = { message: string; goal: SavingsGoal }
export type GoalEntryResponse = GoalMutationResponse & {
  replayed: boolean
  entry: GoalEntry
  goal: SavingsGoalDetail
}
export type GoalEntryPayload = { type: GoalEntryType; amount: number; note: string | null; idempotencyKey: string }
