export type CategoryType = "INCOME" | "EXPENSE"

export const CATEGORY_ICON_VALUES = [
  "utensils",
  "house",
  "car",
  "shopping-bag",
  "gamepad",
  "heart-pulse",
  "repeat",
  "shapes",
  "wallet-cards",
  "sparkles",
  "briefcase",
  "rotate-ccw",
  "circle-dollar-sign",
] as const

export const CATEGORY_ICON_OPTIONS = [
  { value: "utensils", label: "Alimentation" },
  { value: "house", label: "Logement" },
  { value: "car", label: "Transport" },
  { value: "shopping-bag", label: "Shopping" },
  { value: "gamepad", label: "Loisirs" },
  { value: "heart-pulse", label: "Santé" },
  { value: "repeat", label: "Abonnements" },
  { value: "shapes", label: "Autres" },
  { value: "wallet-cards", label: "Salaire" },
  { value: "sparkles", label: "Prime" },
  { value: "briefcase", label: "Freelance" },
  { value: "rotate-ccw", label: "Remboursement" },
  { value: "circle-dollar-sign", label: "Revenus" },
] as const

export const CATEGORY_COLOR_OPTIONS = [
  "#f97316",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#6366f1",
  "#ef4444",
  "#a855f7",
  "#64748b",
  "#22c55e",
  "#eab308",
  "#14b8a6",
  "#3b82f6",
  "#10b981",
] as const

export const DEFAULT_CATEGORY_TEMPLATES: ReadonlyArray<{
  name: string
  type: CategoryType
  icon: (typeof CATEGORY_ICON_VALUES)[number]
  color: string
  isDefault: true
}> = [
  { name: "Alimentation", type: "EXPENSE", icon: "utensils", color: "#f97316", isDefault: true },
  { name: "Logement", type: "EXPENSE", icon: "house", color: "#8b5cf6", isDefault: true },
  { name: "Transport", type: "EXPENSE", icon: "car", color: "#06b6d4", isDefault: true },
  { name: "Shopping", type: "EXPENSE", icon: "shopping-bag", color: "#ec4899", isDefault: true },
  { name: "Loisirs", type: "EXPENSE", icon: "gamepad", color: "#6366f1", isDefault: true },
  { name: "Santé", type: "EXPENSE", icon: "heart-pulse", color: "#ef4444", isDefault: true },
  { name: "Abonnements", type: "EXPENSE", icon: "repeat", color: "#a855f7", isDefault: true },
  { name: "Autres", type: "EXPENSE", icon: "shapes", color: "#64748b", isDefault: true },
  { name: "Salaire", type: "INCOME", icon: "wallet-cards", color: "#22c55e", isDefault: true },
  { name: "Prime", type: "INCOME", icon: "sparkles", color: "#eab308", isDefault: true },
  { name: "Freelance", type: "INCOME", icon: "briefcase", color: "#14b8a6", isDefault: true },
  { name: "Remboursement", type: "INCOME", icon: "rotate-ccw", color: "#3b82f6", isDefault: true },
  { name: "Autres revenus", type: "INCOME", icon: "circle-dollar-sign", color: "#10b981", isDefault: true },
]
