export type CategoryType = "INCOME" | "EXPENSE"

export type CategoryItem = {
  id: string
  name: string
  type: CategoryType
  icon: string
  color: string
  isDefault: boolean
  transactionCount: number
  monthlyTransactionCount: number
  monthlyAmount: number
  createdAt: string
  updatedAt: string
}

export type CategoriesSummary = {
  total: number
  expense: number
  income: number
  mostUsed: {
    id: string
    name: string
    transactionCount: number
  } | null
}

export type CategoriesResponse = {
  categories: CategoryItem[]
  summary: CategoriesSummary
}

export type CategoryAnalysisItem = {
  id: string
  name: string
  type: CategoryType
  icon: string
  color: string
  amount: number
  transactionCount: number
  percentage: number
  previousAmount: number
  percentageChange: number | null
}

export type CategoryAnalysisResponse = {
  filters: {
    period: "month" | "year" | "all"
    year: number
    month: number
    type: CategoryType
  }
  availableYears: number[]
  summary: {
    totalAmount: number
    topCategory: {
      id: string
      name: string
      amount: number
    } | null
    usedCategoryCount: number
    percentageChange: number | null
  }
  categories: CategoryAnalysisItem[]
}
