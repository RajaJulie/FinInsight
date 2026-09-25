export type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CASH"
  | "INVESTMENT"
  | "CREDIT"
  | "OTHER"

export type AccountStatus = "ACTIVE" | "ARCHIVED"

export type AccountItem = {
  id: string
  name: string
  type: AccountType
  initialBalance: number
  currentBalance: number
  currency: "EUR"
  icon: string
  color: string
  status: AccountStatus
  isPrimary: boolean
  transactionCount: number
  lastActivity: string | null
  createdAt: string
  updatedAt: string
}

export type AccountsResponse = {
  accounts: AccountItem[]
  summary: {
    totalBalance: number
    netWorth: number
    savingsBalance: number
    activeCount: number
    primaryAccount: {
      id: string
      name: string
      currentBalance: number
      currency: string
    } | null
    lastActivity: string | null
  }
}
